from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import Order, Store, User
from api.auth import get_current_user
from services.kaspi_graphql import (
    fetch_orders, format_destination, get_current_step, kaspi_status_to_local
)

router = APIRouter(prefix="/orders", tags=["orders"])


class OrderCreate(BaseModel):
    kaspi_order_id: Optional[str] = ""
    customer_name: Optional[str] = ""
    customer_phone: Optional[str] = ""
    product_name: str
    product_sku: Optional[str] = ""
    quantity: Optional[int] = 1
    price: Optional[float] = 0
    total_price: Optional[float] = 0
    status: Optional[str] = "new"
    delivery_type: Optional[str] = ""
    address: Optional[str] = ""
    note: Optional[str] = ""
    store_id: Optional[int] = None


class OrderUpdate(BaseModel):
    status: Optional[str] = None
    note: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    address: Optional[str] = None


def order_to_dict(o):
    return {
        "id": o.id,
        "kaspi_order_id": o.kaspi_order_id,
        "customer_name": o.customer_name,
        "customer_phone": o.customer_phone,
        "product_name": o.product_name,
        "product_sku": o.product_sku,
        "quantity": o.quantity,
        "price": o.price,
        "total_price": o.total_price,
        "status": o.status,
        "delivery_type": o.delivery_type,
        "address": o.address,
        "note": o.note,
        "store_id": o.store_id,
        "created_at": o.created_at,
        "updated_at": o.updated_at,
    }


@router.get("/")
def list_orders(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Order).filter(Order.user_id == current_user.id)
    if status:
        q = q.filter(Order.status == status)
    return [order_to_dict(o) for o in q.order_by(Order.created_at.desc()).all()]


@router.post("/")
def create_order(
    data: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = Order(user_id=current_user.id, **data.model_dump())
    db.add(order)
    db.commit()
    db.refresh(order)
    return order_to_dict(order)


@router.put("/{order_id}")
def update_order(
    order_id: int,
    data: OrderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(order, field, value)
    db.commit()
    return order_to_dict(order)


@router.post("/sync-kaspi")
def sync_orders_from_kaspi(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sync orders from Kaspi MC via GraphQL API.
    Uses mc-session/mc-sid from the first available store.
    """
    stores = db.query(Store).filter(Store.user_id == current_user.id).all()
    if not stores:
        raise HTTPException(status_code=400, detail="Нет привязанных магазинов")

    # Find store with cookies
    store = None
    for s in stores:
        if s.mc_session or s.mc_sid or s.cookies:
            store = s
            break
    if not store:
        raise HTTPException(status_code=400, detail="Добавьте mc-session / mc-sid в настройках магазина")

    # Fetch all pages from all tabs (Kaspi filters orders by tab)
    TABS = [
        "KASPI_DELIVERY_CARGO_ASSEMBLY",
        "KASPI_DELIVERY_TRANSMITTED",
        "KASPI_DELIVERY_WAIT_FOR_COURIER",
        "KASPI_DELIVERY_WAIT_FOR_POINT_DELIVERY",
        "KASPI_DELIVERY_RETURN_REQUEST",
        "PICKUP",
        "DELIVERY",
        "NEW",
    ]

    all_orders = []
    seen_codes = set()
    fetch_error = None

    for tab in TABS:
        page = 0
        while True:
            result = fetch_orders(
                seller_id=store.seller_id,
                cookies_str=store.cookies or "",
                mc_session=store.mc_session or "",
                mc_sid=store.mc_sid or "",
                page=page,
                page_size=50,
                tab=tab,
            )
            if not result["ok"]:
                fetch_error = result.get("message")
                break
            batch = result["orders"]
            for o in batch:
                code = str(o.get("code") or "")
                if code and code not in seen_codes:
                    all_orders.append(o)
                    seen_codes.add(code)
            if len(batch) < 50:
                break
            page += 1

    if not all_orders and fetch_error:
        raise HTTPException(status_code=400, detail=fetch_error)

    # Existing kaspi order codes
    existing_codes = {
        o.kaspi_order_id for o in db.query(Order).filter(
            Order.user_id == current_user.id,
            Order.kaspi_order_id != None,
            Order.kaspi_order_id != "",
        ).all()
    }

    added = 0
    updated = 0

    for raw in all_orders:
        code = str(raw.get("code") or "")
        if not code:
            continue

        entries = raw.get("entries") or []
        product_name = ""
        product_sku = ""
        quantity = 1
        if entries:
            mp = entries[0].get("merchantProduct") or {}
            product_name = mp.get("name") or ""
            product_sku = mp.get("code") or ""
            quantity = entries[0].get("quantity") or 1
            if len(entries) > 1:
                # Multiple products in one order
                all_names = [
                    ((e.get("merchantProduct") or {}).get("name") or "")
                    for e in entries
                ]
                product_name = ", ".join(n for n in all_names if n)

        customer = raw.get("customer") or {}
        customer_name = f"{customer.get('firstName', '')} {customer.get('lastName', '')}".strip()
        total_price = float(raw.get("totalPrice") or 0)
        address = format_destination(raw.get("destination"))
        kaspi_status = raw.get("status") or ""
        local_status = kaspi_status_to_local(kaspi_status)
        current_step = get_current_step(raw.get("steps") or [])
        delivery = raw.get("delivery") or {}
        planned_date = delivery.get("plannedDeliveryDate") or ""
        delivery_zone = raw.get("deliveryZone") or ""
        delivery_mode = delivery.get("mode") or ""

        note = f"{current_step}" if current_step else ""
        if planned_date:
            from datetime import datetime
            try:
                dt = datetime.fromisoformat(planned_date.replace("Z", "+00:00"))
                note += f" · до {dt.strftime('%d.%m %H:%M')}" if note else f"до {dt.strftime('%d.%m %H:%M')}"
            except Exception:
                pass

        delivery_type = delivery_zone or delivery_mode

        if code in existing_codes:
            # Update status
            order = db.query(Order).filter(
                Order.user_id == current_user.id,
                Order.kaspi_order_id == code,
            ).first()
            if order:
                order.status = local_status
                order.address = address
                order.note = note
                updated += 1
        else:
            order = Order(
                user_id=current_user.id,
                store_id=store.id,
                kaspi_order_id=code,
                customer_name=customer_name,
                product_name=product_name,
                product_sku=product_sku,
                quantity=quantity,
                price=total_price / quantity if quantity else total_price,
                total_price=total_price,
                status=local_status,
                delivery_type=delivery_type,
                address=address,
                note=note,
            )
            db.add(order)
            existing_codes.add(code)
            added += 1

    db.commit()
    return {
        "added": added,
        "updated": updated,
        "total_from_kaspi": len(all_orders),
        "message": f"Добавлено: {added}, обновлено: {updated}",
    }


@router.delete("/{order_id}")
def delete_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    db.delete(order)
    db.commit()
    return {"message": "Удалено"}
