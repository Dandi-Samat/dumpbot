from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Product, User
from api.auth import get_current_user
from services.kaspi_reviews import fetch_reviews

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/{product_id}")
def get_product_reviews(
    product_id: int,
    limit: int = 9,
    filter_type: str = "COMMENT",
    sort: str = "POPULARITY",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    sku = product.sku or ""
    if not sku:
        raise HTTPException(status_code=400, detail="У товара нет SKU")

    product_code = sku.split("_")[0]
    result = fetch_reviews(product_code, limit=limit, filter_type=filter_type, sort=sort)

    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result.get("message", "Ошибка"))

    return {
        **result,
        "product_id": product_id,
        "product_name": product.name,
        "product_code": product_code,
    }


@router.get("/by-sku/{sku}")
def get_reviews_by_sku(
    sku: str,
    limit: int = 9,
    filter_type: str = "COMMENT",
    current_user: User = Depends(get_current_user),
):
    product_code = sku.split("_")[0]
    result = fetch_reviews(product_code, limit=limit, filter_type=filter_type)
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result.get("message", "Ошибка"))
    return {**result, "product_code": product_code}
