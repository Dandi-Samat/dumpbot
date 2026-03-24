from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import Product, Store, User
from api.auth import get_current_user
from services.kaspi_parser import kaspi_search, get_seller_position
from services.kaspi_api import get_all_offers, parse_offer_to_product
from services.kaspi_mc import get_offers as get_offers_cookies

router = APIRouter(prefix="/products", tags=["products"])


class ProductCreate(BaseModel):
    store_id: int
    name: str
    sku: Optional[str] = ""
    kaspi_url: Optional[str] = ""
    my_cost: Optional[float] = 0
    my_price: Optional[float] = 0
    min_price: Optional[float] = 0
    max_price: Optional[float] = 0
    stock: Optional[int] = 0
    min_margin: Optional[float] = 500
    reprice_enabled: Optional[bool] = True
    notes: Optional[str] = ""


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    kaspi_url: Optional[str] = None
    my_cost: Optional[float] = None
    my_price: Optional[float] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    stock: Optional[int] = None
    min_margin: Optional[float] = None
    reprice_enabled: Optional[bool] = None
    notes: Optional[str] = None
    preorder_days: Optional[int] = None
    preorder_auto: Optional[bool] = None


@router.get("/")
def list_products(
    store_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Product).filter(Product.user_id == current_user.id)
    if store_id:
        q = q.filter(Product.store_id == store_id)
    products = q.order_by(Product.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "store_id": p.store_id,
            "name": p.name,
            "sku": p.sku,
            "kaspi_url": p.kaspi_url,
            "my_cost": p.my_cost,
            "my_price": p.my_price,
            "min_price": p.min_price,
            "max_price": p.max_price,
            "stock": p.stock,
            "min_margin": p.min_margin,
            "reprice_enabled": p.reprice_enabled,
            "position": p.position,
            "position_total": p.position_total,
            "notes": p.notes,
            "preorder_days": p.preorder_days,
            "preorder_auto": p.preorder_auto,
            "last_dump_at": p.last_dump_at,
            "last_competitor_price": p.last_competitor_price,
            "created_at": p.created_at,
        }
        for p in products
    ]


@router.post("/")
def create_product(
    data: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = db.query(Store).filter(Store.id == data.store_id, Store.user_id == current_user.id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")

    product = Product(
        user_id=current_user.id,
        store_id=data.store_id,
        name=data.name,
        sku=data.sku,
        kaspi_url=data.kaspi_url,
        my_cost=data.my_cost,
        my_price=data.my_price,
        stock=data.stock,
        min_margin=data.min_margin,
        reprice_enabled=data.reprice_enabled,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return {"id": product.id, "name": product.name, "message": "Товар добавлен"}


@router.put("/{product_id}")
def update_product(
    product_id: int,
    data: ProductUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    return {"message": "Обновлено"}


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    db.delete(product)
    db.commit()
    return {"message": "Удалено"}


@router.post("/sync/{store_id}")
def sync_products_from_kaspi(
    store_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Auto-import products from Kaspi Merchant Cabinet.
    Uses API token if available, falls back to cookies.
    Skips products that already exist (by SKU).
    """
    store = db.query(Store).filter(Store.id == store_id, Store.user_id == current_user.id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")

    # Fetch offers from Kaspi
    raw_offers = []
    source = "none"

    if store.kaspi_api_token:
        result = get_all_offers(store.kaspi_api_token)
        if result["ok"] and result["items"]:
            raw_offers = result["items"]
            source = "api_token"

    has_cookies = store.cookies or store.mc_session or store.mc_sid
    if not raw_offers and has_cookies:
        # Fetch all pages via cookies
        page = 0
        while True:
            result = get_offers_cookies(
                store.seller_id,
                cookies_str=store.cookies or "",
                mc_session=store.mc_session or "",
                mc_sid=store.mc_sid or "",
                page=page,
                limit=100,
            )
            if not result["ok"]:
                if not raw_offers:
                    raise HTTPException(status_code=400, detail=result.get("message", "Ошибка получения товаров"))
                break
            batch = result["items"]
            raw_offers.extend(batch)
            source = "cookies"
            if len(batch) < 100:
                break
            page += 1

    if not raw_offers:
        raise HTTPException(status_code=400, detail="Нет доступных товаров. Проверьте API токен или куки.")

    # Get existing SKUs to avoid duplicates
    existing_skus = {
        p.sku for p in db.query(Product).filter(
            Product.user_id == current_user.id,
            Product.store_id == store_id,
            Product.sku != None,
            Product.sku != "",
        ).all()
    }

    added = 0
    updated = 0
    skipped = 0

    for raw in raw_offers:
        parsed = parse_offer_to_product(raw)
        name = parsed.get("name", "").strip()
        sku = parsed.get("sku", "").strip()

        if not name:
            continue

        if sku and sku in existing_skus:
            # Update price and stock for existing product
            existing = db.query(Product).filter(
                Product.user_id == current_user.id,
                Product.store_id == store_id,
                Product.sku == sku,
            ).first()
            if existing:
                if parsed.get("my_price") is not None:
                    existing.my_price = parsed["my_price"]
                if parsed.get("stock") is not None:
                    existing.stock = parsed["stock"]
                if parsed.get("kaspi_url"):
                    existing.kaspi_url = parsed["kaspi_url"]
                updated += 1
            continue

        product = Product(
            user_id=current_user.id,
            store_id=store_id,
            name=name,
            sku=sku,
            kaspi_url=parsed.get("kaspi_url", ""),
            my_price=parsed.get("my_price", 0),
            stock=parsed.get("stock", 0),
            reprice_enabled=True,
        )
        db.add(product)
        if sku:
            existing_skus.add(sku)
        added += 1

    db.commit()

    return {
        "added": added,
        "updated": updated,
        "skipped": skipped,
        "total_from_kaspi": len(raw_offers),
        "source": source,
        "message": f"Добавлено: {added}, обновлено: {updated}",
    }


class PositionData(BaseModel):
    position: Optional[int] = None
    total: Optional[int] = None


@router.post("/{product_id}/save-position")
def save_position(
    product_id: int,
    data: PositionData,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    if data.position is not None:
        product.position = data.position
    if data.total is not None:
        product.position_total = data.total
    db.commit()
    return {"ok": True}


@router.post("/{product_id}/check-position")
def check_position(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    if not product.kaspi_url:
        raise HTTPException(status_code=400, detail="Нет ссылки на Kaspi — добавьте URL товара")

    store = db.query(Store).filter(Store.id == product.store_id).first()
    if not store:
        # Fallback: use any store belonging to this user
        store = db.query(Store).filter(Store.user_id == current_user.id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")

    result = get_seller_position(product.kaspi_url, store.seller_id)
    if result["position"] is not None:
        product.position = result["position"]
        product.position_total = result["total"]
        db.commit()

    return {
        "position": result["position"],
        "total": result["total"],
        "my_price": result["my_price"],
        "prices": result["prices"],
        "competitors": result.get("competitors", []),
        "kaspi_url": product.kaspi_url,
    }


@router.get("/search")
def search_kaspi(
    q: str,
    city_id: str = "750000000",
    current_user: User = Depends(get_current_user),
):
    results = kaspi_search(q, city_id)
    return results
