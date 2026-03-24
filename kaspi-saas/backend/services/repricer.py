"""
Repricer service - core dumping logic
"""
import logging
from datetime import datetime
from sqlalchemy.orm import Session

from models import Product, PriceHistory, Store
from services.kaspi_parser import kaspi_search, get_competitor_prices
from services.kaspi_mc import update_price
from services.kaspi_api import update_price_via_token

logger = logging.getLogger(__name__)


def reprice_product(product: Product, store: Store, db: Session) -> dict:
    """
    Run repricer for a single product.
    Returns result dict with status and details.
    """
    name = product.name
    sku = product.sku
    my_cost = product.my_cost or 0
    stock = product.stock or 0
    min_margin = product.min_margin or 500

    # Find URL if missing
    url = product.kaspi_url
    if not url:
        results = kaspi_search(name)
        if results:
            url = results[0]["url"]
            product.kaspi_url = url
        else:
            return {"status": "error", "message": "Товар не найден на Kaspi", "product": name}

    # Get competitor prices
    prices = get_competitor_prices(url)
    if not prices:
        return {"status": "no_prices", "message": "Цены конкурентов не найдены", "product": name}

    min_competitor = prices[0]
    product.last_competitor_price = min_competitor
    my_price = product.my_price or (min_competitor + 500)
    min_allowed = my_cost + min_margin

    # Already cheaper
    if my_price <= min_competitor:
        _save_history(db, product.id, my_price, min_competitor, "already_lower")
        return {
            "status": "already_lower",
            "message": f"Уже дешевле ({my_price}₸ ≤ {min_competitor}₸)",
            "product": name,
            "my_price": my_price,
            "competitor_price": min_competitor,
        }

    new_price = min_competitor - 1

    # Margin protection
    if new_price < min_allowed:
        _save_history(db, product.id, my_price, min_competitor, "blocked")
        return {
            "status": "blocked",
            "message": f"Демпинг заблокирован (мин. {min_allowed}₸, конкурент {min_competitor}₸)",
            "product": name,
            "my_price": my_price,
            "competitor_price": min_competitor,
        }

    if not sku:
        return {
            "status": "no_sku",
            "message": "Нет SKU — добавьте SKU в настройках товара",
            "product": name,
            "competitor_price": min_competitor,
            "suggested_price": new_price,
        }

    # Update price — API token first, cookies fallback
    if store.kaspi_api_token:
        result = update_price_via_token(
            api_token=store.kaspi_api_token,
            seller_id=store.seller_id,
            store_id=store.store_id,
            city_id=store.city_id,
            sku=sku,
            new_price=new_price,
            name=name,
            stock=stock,
        )
        if not result["ok"] and store.cookies:
            logger.warning(f"API token failed for {sku}, falling back to cookies")
            result = update_price(
                seller_id=store.seller_id,
                store_id=store.store_id,
                city_id=store.city_id,
                sku=sku,
                new_price=new_price,
                cookies_str=store.cookies or "",
                mc_session=store.mc_session or "",
                mc_sid=store.mc_sid or "",
                name=name,
                stock=stock,
            )
    else:
        result = update_price(
            seller_id=store.seller_id,
            store_id=store.store_id,
            city_id=store.city_id,
            sku=sku,
            new_price=new_price,
            cookies_str=store.cookies or "",
            mc_session=store.mc_session or "",
            mc_sid=store.mc_sid or "",
            name=name,
            stock=stock,
        )

    if result["ok"]:
        product.my_price = new_price
        product.last_dump_at = datetime.utcnow()
        _save_history(db, product.id, new_price, min_competitor, "lowered")
        db.commit()
        return {
            "status": "success",
            "message": f"{my_price}₸ → {new_price}₸ (конкурент {min_competitor}₸)",
            "product": name,
            "old_price": my_price,
            "new_price": new_price,
            "competitor_price": min_competitor,
        }
    else:
        _save_history(db, product.id, my_price, min_competitor, "error")
        return {
            "status": "error",
            "message": result["message"],
            "product": name,
            "competitor_price": min_competitor,
        }


def reprice_all(user_id: int, db: Session) -> list[dict]:
    products = db.query(Product).filter(
        Product.user_id == user_id,
        Product.reprice_enabled == True
    ).all()

    if not products:
        return [{"status": "empty", "message": "Нет товаров для демпинга"}]

    results = []
    import time
    for product in products:
        store = db.query(Store).filter(Store.id == product.store_id).first()
        if not store:
            results.append({"status": "error", "product": product.name, "message": "Магазин не найден"})
            continue
        result = reprice_product(product, store, db)
        results.append(result)
        time.sleep(2)

    return results


def reprice_with_price(product: Product, store: Store, competitor_price: int, db: Session) -> dict:
    """
    Apply reprice using pre-fetched competitor price (fetched from browser).
    competitor_price should already exclude our store.
    """
    name = product.name
    sku = product.sku
    my_cost = product.my_cost or 0
    stock = product.stock or 0
    min_margin = product.min_margin or 500
    my_price = product.my_price or 0

    min_allowed = my_cost + min_margin
    # Respect min_price floor if set
    if product.min_price and product.min_price > 0:
        min_allowed = max(min_allowed, product.min_price)

    product.last_competitor_price = competitor_price

    # Already cheaper or equal — no action needed
    if my_price > 0 and my_price <= competitor_price:
        _save_history(db, product.id, my_price, competitor_price, "already_lower")
        db.commit()
        return {
            "status": "already_lower",
            "message": f"Уже дешевле ({my_price}₸ ≤ {competitor_price}₸)",
            "product": name,
            "my_price": my_price,
        }

    new_price = competitor_price - 1

    if new_price < min_allowed:
        _save_history(db, product.id, my_price, competitor_price, "blocked")
        db.commit()
        return {
            "status": "blocked",
            "message": f"Заблокировано (мин. {min_allowed}₸, конкурент {competitor_price}₸)",
            "product": name,
            "my_price": my_price,
            "competitor_price": competitor_price,
        }

    if not sku:
        db.commit()
        return {"status": "no_sku", "message": "Нет SKU", "product": name}

    # Update price — API token first, cookies fallback
    if store.kaspi_api_token:
        result = update_price_via_token(
            api_token=store.kaspi_api_token,
            seller_id=store.seller_id,
            store_id=store.store_id,
            city_id=store.city_id,
            sku=sku,
            new_price=new_price,
            name=name,
            stock=stock,
        )
        if not result["ok"] and (store.mc_session or store.cookies):
            result = update_price(
                seller_id=store.seller_id,
                store_id=store.store_id,
                city_id=store.city_id,
                sku=sku,
                new_price=new_price,
                cookies_str=store.cookies or "",
                mc_session=store.mc_session or "",
                mc_sid=store.mc_sid or "",
                name=name,
                stock=stock,
            )
    else:
        result = update_price(
            seller_id=store.seller_id,
            store_id=store.store_id,
            city_id=store.city_id,
            sku=sku,
            new_price=new_price,
            cookies_str=store.cookies or "",
            mc_session=store.mc_session or "",
            mc_sid=store.mc_sid or "",
            name=name,
            stock=stock,
        )

    if result["ok"]:
        old_price = my_price
        product.my_price = new_price
        product.last_dump_at = datetime.utcnow()
        _save_history(db, product.id, new_price, competitor_price, "lowered")
        db.commit()
        return {
            "status": "success",
            "product": name,
            "old_price": old_price,
            "new_price": new_price,
            "competitor_price": competitor_price,
        }
    else:
        _save_history(db, product.id, my_price, competitor_price, "error")
        db.commit()
        return {
            "status": "error",
            "message": result["message"],
            "product": name,
        }


def _save_history(db: Session, product_id: int, my_price: float, competitor_price: float, action: str):
    h = PriceHistory(
        product_id=product_id,
        my_price=my_price,
        competitor_price=competitor_price,
        action=action,
    )
    db.add(h)
    db.commit()
