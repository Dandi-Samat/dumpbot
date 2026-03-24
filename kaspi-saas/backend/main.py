from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine
import models
from api import auth, stores, products, repricer, analytics, preorders
from api import orders as orders_api
from api import settings as settings_api
from api import reviews as reviews_api

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Kaspi Seller Dashboard", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def run_migrations():
    """Add new columns to existing tables without dropping data."""
    migrations = [
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS min_price FLOAT DEFAULT 0",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS max_price FLOAT DEFAULT 0",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS position INTEGER",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS position_total INTEGER",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS notes TEXT",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_days INTEGER DEFAULT 0",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_auto BOOLEAN DEFAULT FALSE",
        # phone auth migration
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone ON users (phone)",
        # kaspi api token and session cookies
        "ALTER TABLE stores ADD COLUMN IF NOT EXISTS kaspi_api_token VARCHAR",
        "ALTER TABLE stores ADD COLUMN IF NOT EXISTS mc_session VARCHAR",
        "ALTER TABLE stores ADD COLUMN IF NOT EXISTS mc_sid VARCHAR",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
            except Exception:
                pass
        conn.commit()


app.include_router(auth.router, prefix="/api")
app.include_router(stores.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(repricer.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(preorders.router, prefix="/api")
app.include_router(orders_api.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")
app.include_router(reviews_api.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
