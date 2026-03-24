from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import Store, User
from api.auth import get_current_user
from services.kaspi_mc import check_session
from services.kaspi_api import check_token

router = APIRouter(prefix="/stores", tags=["stores"])


class StoreCreate(BaseModel):
    seller_id: str
    store_id: Optional[str] = ""
    city_id: str = "750000000"
    mc_session: Optional[str] = ""
    mc_sid: Optional[str] = ""
    cookies: Optional[str] = ""
    kaspi_api_token: Optional[str] = ""


class StoreUpdate(BaseModel):
    cookies: Optional[str] = None
    mc_session: Optional[str] = None
    mc_sid: Optional[str] = None
    kaspi_api_token: Optional[str] = None
    city_id: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/")
def list_stores(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stores = db.query(Store).filter(Store.user_id == current_user.id).all()
    return [
        {
            "id": s.id,
            "seller_id": s.seller_id,
            "store_id": s.store_id,
            "city_id": s.city_id,
            "is_active": s.is_active,
            "cookies": s.cookies,
            "kaspi_api_token": s.kaspi_api_token,
            "mc_session": s.mc_session,
            "mc_sid": s.mc_sid,
            "auth_method": "api_token" if s.kaspi_api_token else ("session" if (s.mc_session or s.mc_sid) else ("cookies" if s.cookies else "none")),
            "last_session_check": s.last_session_check,
            "created_at": s.created_at,
        }
        for s in stores
    ]


@router.post("/")
def create_store(data: StoreCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = Store(
        user_id=current_user.id,
        seller_id=data.seller_id,
        store_id=data.store_id,
        city_id=data.city_id,
        mc_session=data.mc_session,
        mc_sid=data.mc_sid,
        cookies=data.cookies,
        kaspi_api_token=data.kaspi_api_token,
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return {"id": store.id, "seller_id": store.seller_id, "message": "Магазин добавлен"}


@router.put("/{store_id}")
def update_store(
    store_id: int,
    data: StoreUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = db.query(Store).filter(Store.id == store_id, Store.user_id == current_user.id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")
    if data.cookies is not None:
        store.cookies = data.cookies
    if data.mc_session is not None:
        store.mc_session = data.mc_session
    if data.mc_sid is not None:
        store.mc_sid = data.mc_sid
    if data.kaspi_api_token is not None:
        store.kaspi_api_token = data.kaspi_api_token
    if data.city_id is not None:
        store.city_id = data.city_id
    if data.is_active is not None:
        store.is_active = data.is_active
    db.commit()
    return {"message": "Обновлено"}


@router.get("/{store_id}/check-session")
def check_store_session(
    store_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    store = db.query(Store).filter(Store.id == store_id, Store.user_id == current_user.id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")
    from datetime import datetime
    store.last_session_check = datetime.utcnow()
    db.commit()
    # Check API token first, then cookies
    if store.kaspi_api_token:
        result = check_token(store.kaspi_api_token)
        result["method"] = "api_token"
        if not result["ok"] and (store.mc_session or store.mc_sid or store.cookies):
            fallback = check_session(store.seller_id, store.cookies or "", store.mc_session or "", store.mc_sid or "")
            fallback["method"] = "session_fallback"
            return fallback
        return result
    result = check_session(store.seller_id, store.cookies or "", store.mc_session or "", store.mc_sid or "")
    result["method"] = "session" if (store.mc_session or store.mc_sid) else "cookies"
    return result


@router.delete("/{store_id}")
def delete_store(store_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == store_id, Store.user_id == current_user.id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Магазин не найден")
    db.delete(store)
    db.commit()
    return {"message": "Удалено"}
