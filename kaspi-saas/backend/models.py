from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True)
    name = Column(String)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    plan = Column(String, default="free")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    stores = relationship("Store", back_populates="user")
    products = relationship("Product", back_populates="user")
    preorders = relationship("Preorder", back_populates="user")
    orders = relationship("Order", back_populates="user")


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    seller_id = Column(String)
    store_id = Column(String)
    city_id = Column(String, default="750000000")
    cookies = Column(Text)
    mc_session = Column(String)
    mc_sid = Column(String)
    kaspi_api_token = Column(String)
    is_active = Column(Boolean, default=True)
    last_session_check = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="stores")
    products = relationship("Product", back_populates="store")
    orders = relationship("Order", back_populates="store")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    store_id = Column(Integer, ForeignKey("stores.id"))
    name = Column(String)
    sku = Column(String)
    kaspi_url = Column(String)
    my_cost = Column(Float, default=0)
    my_price = Column(Float, default=0)
    min_price = Column(Float, default=0)
    max_price = Column(Float, default=0)
    stock = Column(Integer, default=0)
    min_margin = Column(Float, default=500)
    reprice_enabled = Column(Boolean, default=True)
    position = Column(Integer)
    position_total = Column(Integer)
    notes = Column(Text)
    preorder_days = Column(Integer, default=0)
    preorder_auto = Column(Boolean, default=False)
    last_dump_at = Column(DateTime(timezone=True))
    last_competitor_price = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="products")
    store = relationship("Store", back_populates="products")
    price_history = relationship("PriceHistory", back_populates="product")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    my_price = Column(Float)
    competitor_price = Column(Float)
    action = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="price_history")


class Preorder(Base):
    __tablename__ = "preorders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    store_id = Column(Integer, ForeignKey("stores.id"))
    customer_name = Column(String)
    customer_phone = Column(String)
    product_name = Column(String)
    product_sku = Column(String)
    quantity = Column(Integer, default=1)
    price = Column(Float)
    status = Column(String, default="new")
    note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="preorders")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)
    kaspi_order_id = Column(String)
    customer_name = Column(String)
    customer_phone = Column(String)
    product_name = Column(String)
    product_sku = Column(String)
    quantity = Column(Integer, default=1)
    price = Column(Float)
    total_price = Column(Float)
    status = Column(String, default="new")
    delivery_type = Column(String)
    address = Column(Text)
    note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="orders")
    store = relationship("Store", back_populates="orders")


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    reprice_step = Column(Float, default=1)
    default_min_margin = Column(Float, default=500)
    whatsapp_token = Column(String)
    whatsapp_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
