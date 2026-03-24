from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Product, PriceHistory, User, Order
from api.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def get_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.user_id == current_user.id).all()
    total = len(products)
    active = sum(1 for p in products if p.reprice_enabled)
    winning = sum(1 for p in products if p.my_price and p.last_competitor_price and p.my_price <= p.last_competitor_price)
    losing = sum(1 for p in products if p.my_price and p.last_competitor_price and p.my_price > p.last_competitor_price)

    history = db.query(PriceHistory).join(Product).filter(
        Product.user_id == current_user.id
    ).order_by(PriceHistory.created_at.desc()).limit(100).all()

    total_lowered = sum(1 for h in history if h.action == "lowered")
    total_blocked = sum(1 for h in history if h.action == "blocked")

    orders = db.query(Order).filter(Order.user_id == current_user.id).all()
    total_orders = len(orders)
    revenue = sum(o.total_price or 0 for o in orders if o.status != "cancelled")
    new_orders = sum(1 for o in orders if o.status == "new")
    from datetime import datetime, date
    today = date.today()
    orders_today = sum(1 for o in orders if o.created_at and o.created_at.date() == today)

    return {
        "products": {
            "total": total,
            "active": active,
            "winning": winning,
            "losing": losing,
        },
        "repricer": {
            "total_lowered": total_lowered,
            "total_blocked": total_blocked,
        },
        "orders": {
            "total": total_orders,
            "new": new_orders,
            "today": orders_today,
            "revenue": revenue,
        }
    }


@router.get("/price-history")
def price_history_chart(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.user_id == current_user.id
    ).first()
    if not product:
        return []

    history = db.query(PriceHistory).filter(
        PriceHistory.product_id == product_id
    ).order_by(PriceHistory.created_at.asc()).limit(200).all()

    return [
        {
            "date": h.created_at.isoformat(),
            "my_price": h.my_price,
            "competitor_price": h.competitor_price,
            "action": h.action,
        }
        for h in history
    ]


@router.get("/top-products")
def top_products(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.user_id == current_user.id).all()
    result = []
    for p in products:
        lowered_count = db.query(PriceHistory).filter(
            PriceHistory.product_id == p.id,
            PriceHistory.action == "lowered"
        ).count()
        result.append({
            "id": p.id,
            "name": p.name,
            "my_price": p.my_price,
            "last_competitor_price": p.last_competitor_price,
            "lowered_count": lowered_count,
            "last_dump_at": p.last_dump_at,
        })
    return sorted(result, key=lambda x: x["lowered_count"], reverse=True)[:10]
