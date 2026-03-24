"""
Kaspi Official Merchant API - uses kaspiAPIToken instead of cookies.
Token format: "merchantId:tokenHash" (from kaskyr.com profile endpoint).
Official API base: https://kaspi.kz/shop/api/v2/
"""
import logging
import requests
import time

logger = logging.getLogger(__name__)

API_BASE = "https://kaspi.kz/shop/api/v2"
PRICEFEED_URL = "https://mc.shop.kaspi.kz/pricefeed/upload/merchant/process"


def _api_headers(api_token: str) -> dict:
    return {
        "Authorization": api_token,
        "Content-Type": "application/vnd.api+json",
        "Accept": "application/vnd.api+json",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
    }


def check_token(api_token: str) -> dict:
    """Verify that the kaspiAPIToken is valid."""
    if not api_token:
        return {"ok": False, "message": "API токен не заполнен"}
    try:
        r = requests.get(
            f"{API_BASE}/merchantsproducts/?page[number]=0&page[size]=1",
            headers=_api_headers(api_token),
            timeout=15,
        )
        if r.status_code == 200:
            return {"ok": True, "message": "API токен активен"}
        elif r.status_code in (401, 403):
            return {"ok": False, "message": "API токен недействителен или истёк"}
        else:
            return {"ok": False, "message": f"Kaspi API вернул статус {r.status_code}"}
    except Exception as e:
        logger.error(f"check_token error: {e}")
        return {"ok": False, "message": str(e)}


def get_offers(api_token: str, page: int = 0, size: int = 20) -> dict:
    """
    Get merchant's products/offers from official Kaspi API.
    Returns {"ok": bool, "items": [...], "total": int}
    """
    if not api_token:
        return {"ok": False, "items": [], "total": 0, "message": "Нет API токена"}
    try:
        r = requests.get(
            f"{API_BASE}/merchantsproducts/",
            params={"page[number]": page, "page[size]": size},
            headers=_api_headers(api_token),
            timeout=20,
        )
        if r.status_code == 200:
            data = r.json()
            items = data.get("data", [])
            total = data.get("meta", {}).get("total", len(items))
            return {"ok": True, "items": items, "total": total}
        else:
            logger.error(f"get_offers HTTP {r.status_code}: {r.text[:300]}")
            return {"ok": False, "items": [], "total": 0, "message": f"HTTP {r.status_code}"}
    except Exception as e:
        logger.error(f"get_offers error: {e}")
        return {"ok": False, "items": [], "total": 0, "message": str(e)}


def get_orders(api_token: str, page: int = 0, size: int = 20, status: str = None) -> dict:
    """
    Get orders from official Kaspi API.
    Returns {"ok": bool, "items": [...], "total": int}
    """
    if not api_token:
        return {"ok": False, "items": [], "total": 0, "message": "Нет API токена"}
    try:
        params = {"page[number]": page, "page[size]": size}
        if status:
            params["filter[orders.state]"] = status
        r = requests.get(
            f"{API_BASE}/orders/",
            params=params,
            headers=_api_headers(api_token),
            timeout=20,
        )
        if r.status_code == 200:
            data = r.json()
            items = data.get("data", [])
            total = data.get("meta", {}).get("total", len(items))
            return {"ok": True, "items": items, "total": total}
        else:
            logger.error(f"get_orders HTTP {r.status_code}: {r.text[:300]}")
            return {"ok": False, "items": [], "total": 0, "message": f"HTTP {r.status_code}"}
    except Exception as e:
        logger.error(f"get_orders error: {e}")
        return {"ok": False, "items": [], "total": 0, "message": str(e)}


def get_all_offers(api_token: str, max_pages: int = 20) -> dict:
    """
    Fetch ALL merchant offers via official API (paginated).
    Returns {"ok": bool, "items": [...], "total": int}
    """
    if not api_token:
        return {"ok": False, "items": [], "total": 0, "message": "Нет API токена"}

    all_items = []
    page = 0
    total = None

    while page <= max_pages:
        try:
            r = requests.get(
                f"{API_BASE}/merchantsproducts/",
                params={"page[number]": page, "page[size]": 50},
                headers=_api_headers(api_token),
                timeout=20,
            )
            if r.status_code in (401, 403):
                return {"ok": False, "items": [], "total": 0, "message": "API токен недействителен"}
            if r.status_code != 200:
                if page == 0:
                    return {"ok": False, "items": [], "total": 0, "message": f"HTTP {r.status_code}"}
                break

            data = r.json()
            items = data.get("data", [])
            if total is None:
                total = data.get("meta", {}).get("total", 0)

            all_items.extend(items)

            if len(items) < 50 or len(all_items) >= total:
                break
            page += 1

        except Exception as e:
            logger.error(f"get_all_offers page {page} error: {e}")
            break

    return {"ok": True, "items": all_items, "total": total or len(all_items)}


def parse_offer_to_product(offer: dict) -> dict:
    """
    Convert Kaspi API offer to our product dict.

    MC cabinet format (list?m=...):
    {
      "sku": "154510664_419152358",
      "model": "Название товара",
      "title": "Название товара",
      "cityPrices": [{"value": 8000, "cityId": "750000000"}],
      "availabilities": [{"stockCount": 19, "storeId": "30432443_PP1"}],
      "shopLink": "/p/slug-123/"
    }

    Official JSON:API format:
    {"type": "merchantsproducts", "id": "sku", "attributes": {...}}
    """
    # Official JSON:API format
    if "attributes" in offer and "type" in offer:
        attrs = offer.get("attributes", {})
        return {
            "name": attrs.get("name") or attrs.get("title") or "",
            "sku": offer.get("id") or attrs.get("sku") or "",
            "kaspi_url": attrs.get("kaspiProductLink") or attrs.get("productLink") or "",
            "my_price": float(attrs.get("unitPrice") or attrs.get("price") or 0),
            "stock": int(attrs.get("quantity") or attrs.get("stockCount") or 0),
        }

    # MC cabinet format — exact fields from real API response
    sku = offer.get("sku") or offer.get("masterProductSku") or ""

    # Name: model or title (both usually same)
    name = offer.get("model") or offer.get("title") or offer.get("name") or ""

    # Price: from cityPrices array (take first city) or rangePrice
    my_price = 0.0
    city_prices = offer.get("cityPrices") or []
    if city_prices:
        my_price = float(city_prices[0].get("value") or 0)
    if not my_price:
        range_price = offer.get("rangePrice") or {}
        my_price = float(range_price.get("MIN") or range_price.get("MAX") or 0)

    # Stock: from availabilities array
    stock = 0
    availabilities = offer.get("availabilities") or []
    if availabilities:
        stock = int(availabilities[0].get("stockCount") or 0)
    # Also check stocks array
    if not stock:
        stocks = offer.get("stocks") or []
        if stocks:
            for s in stocks:
                stock_level = s.get("stockLevel") or {}
                for store_key, level in stock_level.items():
                    stock += int(level.get("value") or 0)

    # URL: always use numeric productId from SKU (shopLink slug format doesn't work)
    if sku:
        product_id = sku.split("_")[0]
        kaspi_url = f"https://kaspi.kz/shop/p/-{product_id}/"
    else:
        kaspi_url = ""

    return {
        "name": name,
        "sku": sku,
        "kaspi_url": kaspi_url,
        "my_price": my_price,
        "stock": stock,
    }


def update_price_via_token(
    api_token: str,
    seller_id: str,
    store_id: str,
    city_id: str,
    sku: str,
    new_price: int,
    name: str = "",
    stock: int = 1,
) -> dict:
    """
    Update price using kaspiAPIToken via pricefeed endpoint.
    Falls back to checking official PATCH endpoint if pricefeed fails.
    Returns {"ok": bool, "message": str}
    """
    if not api_token:
        return {"ok": False, "message": "API токен не заполнен"}

    # Method 1: pricefeed endpoint with token auth header
    payload = {
        "merchantUid": seller_id,
        "sku": sku,
        "model": name,
        "availabilities": [
            {
                "available": "yes",
                "storeId": store_id,
                "stockCount": stock if stock > 0 else 1,
            }
        ],
        "cityPrices": [{"cityId": city_id, "value": new_price}],
    }

    headers = {
        "Authorization": api_token,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Origin": "https://kaspi.kz",
        "Referer": "https://kaspi.kz/mc/",
    }

    for attempt in range(1, 4):
        try:
            r = requests.post(PRICEFEED_URL, json=payload, headers=headers, timeout=25)
            if r.status_code in (200, 201, 202, 204):
                logger.info(f"[API token] Price updated: {sku} -> {new_price}₸")
                return {"ok": True, "message": f"Цена обновлена через API: {new_price}₸"}
            if r.status_code in (401, 403):
                return {"ok": False, "message": "API токен недействителен — обновите токен"}
            logger.warning(f"[API token] pricefeed HTTP {r.status_code}: {r.text[:200]}")
        except requests.exceptions.Timeout:
            logger.warning(f"[API token] timeout attempt {attempt}")
        except Exception as e:
            logger.error(f"[API token] exception: {e}")
            return {"ok": False, "message": str(e)}

        if attempt < 3:
            time.sleep(5 * attempt)

    return {"ok": False, "message": "Не удалось обновить цену через API токен"}
