from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import UserSettings, User
from api.auth import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    reprice_step: Optional[float] = None
    default_min_margin: Optional[float] = None
    whatsapp_token: Optional[str] = None
    whatsapp_enabled: Optional[bool] = None


def get_or_create_settings(user_id: int, db: Session) -> UserSettings:
    settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if not settings:
        settings = UserSettings(user_id=user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/")
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = get_or_create_settings(current_user.id, db)
    return {
        "reprice_step": s.reprice_step,
        "default_min_margin": s.default_min_margin,
        "whatsapp_token": s.whatsapp_token or "",
        "whatsapp_enabled": s.whatsapp_enabled,
    }


@router.put("/")
def update_settings(
    data: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = get_or_create_settings(current_user.id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(s, field, value)
    db.commit()
    return {"message": "Сохранено"}
