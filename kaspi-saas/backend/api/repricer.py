from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from database import get_db
from models import Product, Store, PriceHistory, User
from api.auth import get_current_user
from services.repricer import reprice_product, reprice_all, reprice_with_price
from services.kaspi_parser import get_competitor_min_price

router = APIRouter(prefix="/repricer", tags=["repricer"])


@router.post("/run")
def run_repricer(
    store_id: Optional[int] = None,
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run repricer for all products (or specific store)."""
    results = reprice_all(current_user.id, db)
    return {"results": results, "total": len(results)}


@router.post("/product/{product_id}")
def run_product_reprice(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run repricer for a single product."""
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.user_id == current_user.id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    store = db.query(Store).filter(Store.id == product.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")

    result = reprice_product(product, store, db)
    return result


@router.post("/product/{product_id}/run")
def run_single_product(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Full auto-reprice cycle for one product:
    1. Fetch competitor prices from Kaspi API
    2. Find min price excluding our stores
    3. Lower our price to competitor - 1 if needed
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.user_id == current_user.id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    if not product.sku:
        return {"status": "no_sku", "product": product.name}

    store = db.query(Store).filter(Store.id == product.store_id).first()
    if not store:
        store = db.query(Store).filter(Store.user_id == current_user.id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")

    # Get all seller IDs for this user to exclude from competitors
    all_stores = db.query(Store).filter(Store.user_id == current_user.id).all()
    seller_ids = [s.seller_id for s in all_stores if s.seller_id]

    master_sku = product.sku.split("_")[0]
    result = get_competitor_min_price(master_sku, seller_ids)

    if not result["ok"]:
        return {"status": "no_data", "product": product.name, "error": result.get("error", "Kaspi недоступен")}

    if result["min_price"] is None:
        return {"status": "no_competitors", "product": product.name}

    reprice_result = reprice_with_price(product, store, result["min_price"], db)
    reprice_result["total_competitors"] = result["total"]
    return reprice_result


class ApplyRepriceRequest(BaseModel):
    competitor_price: int


@router.post("/product/{product_id}/apply")
def apply_product_reprice(
    product_id: int,
    data: ApplyRepriceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Apply reprice using competitor price fetched from browser."""
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.user_id == current_user.id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    store = db.query(Store).filter(Store.id == product.store_id).first()
    if not store:
        store = db.query(Store).filter(Store.user_id == current_user.id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")

    result = reprice_with_price(product, store, data.competitor_price, db)
    return result


@router.get("/history")
def get_price_history(
    product_id: Optional[int] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(PriceHistory).join(Product).filter(Product.user_id == current_user.id)
    if product_id:
        q = q.filter(PriceHistory.product_id == product_id)
    history = q.order_by(PriceHistory.created_at.desc()).limit(limit).all()
    return [
        {
            "id": h.id,
            "product_id": h.product_id,
            "my_price": h.my_price,
            "competitor_price": h.competitor_price,
            "action": h.action,
            "created_at": h.created_at,
        }
        for h in history
    ]
