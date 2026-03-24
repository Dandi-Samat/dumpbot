from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import Preorder, User
from api.auth import get_current_user

router = APIRouter(prefix="/preorders", tags=["preorders"])

STATUSES = ["new", "confirmed", "shipped", "done", "cancelled"]


class PreorderCreate(BaseModel):
    store_id: int
    customer_name: str
    customer_phone: str
    product_name: str
    product_sku: Optional[str] = ""
    quantity: int = 1
    price: float
    note: Optional[str] = ""


class PreorderUpdate(BaseModel):
    status: Optional[str] = None
    note: Optional[str] = None
    price: Optional[float] = None


@router.get("/")
def list_preorders(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Preorder).filter(Preorder.user_id == current_user.id)
    if status:
        q = q.filter(Preorder.status == status)
    orders = q.order_by(Preorder.created_at.desc()).all()
    return [
        {
            "id": o.id,
            "store_id": o.store_id,
            "customer_name": o.customer_name,
            "customer_phone": o.customer_phone,
            "product_name": o.product_name,
            "product_sku": o.product_sku,
            "quantity": o.quantity,
            "price": o.price,
            "total": o.price * o.quantity,
            "status": o.status,
            "note": o.note,
            "created_at": o.created_at,
            "updated_at": o.updated_at,
        }
        for o in orders
    ]


@router.post("/")
def create_preorder(
    data: PreorderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = Preorder(
        user_id=current_user.id,
        store_id=data.store_id,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        product_name=data.product_name,
        product_sku=data.product_sku,
        quantity=data.quantity,
        price=data.price,
        note=data.note,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return {"id": order.id, "message": "Предзаказ создан"}


@router.put("/{order_id}")
def update_preorder(
    order_id: int,
    data: PreorderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Preorder).filter(Preorder.id == order_id, Preorder.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Предзаказ не найден")
    if data.status and data.status not in STATUSES:
        raise HTTPException(status_code=400, detail=f"Статус должен быть одним из: {STATUSES}")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(order, field, value)
    db.commit()
    return {"message": "Обновлено"}


@router.delete("/{order_id}")
def delete_preorder(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Preorder).filter(Preorder.id == order_id, Preorder.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Предзаказ не найден")
    db.delete(order)
    db.commit()
    return {"message": "Удалено"}


@router.get("/stats")
def preorder_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(Preorder).filter(Preorder.user_id == current_user.id).all()
    by_status = {}
    for s in STATUSES:
        count = sum(1 for o in orders if o.status == s)
        total = sum(o.price * o.quantity for o in orders if o.status == s)
        by_status[s] = {"count": count, "total": total}
    return {
        "total_orders": len(orders),
        "total_revenue": sum(o.price * o.quantity for o in orders if o.status == "done"),
        "by_status": by_status,
    }
