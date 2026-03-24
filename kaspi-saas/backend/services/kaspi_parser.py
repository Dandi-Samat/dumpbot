"""
Kaspi price parser - ported from bot.py
"""
import re
import json
import time
import logging
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://kaspi.kz/",
}


def kaspi_search(query: str, city_id: str = "750000000") -> list[dict]:
    results = []
    try:
        r = requests.get(
            "https://kaspi.kz/yml/result-consumer",
            params={"q": query, "i": 0, "c": city_id, "sort": 1, "ui": 0},
            headers=BROWSER_HEADERS,
            timeout=15
        )
        if r.status_code == 200 and r.text.strip():
            data = r.json()
            for item in data.get("data", {}).get("cards", [])[:5]:
                name = item.get("title", "")
                url = "https://kaspi.kz" + item.get("url", "")
                price = item.get("unitPrice", 0)
                if name:
                    results.append({"name": name, "url": url, "price": price})
        if results:
            return results
    except Exception as e:
        logger.error(f"kaspi_search error: {e}")

    # Fallback HTML parse
    try:
        r2 = requests.get(
            "https://kaspi.kz/shop/search/",
            params={"q": query, "c": city_id},
            headers=BROWSER_HEADERS,
            timeout=15
        )
        if r2.status_code == 200:
            soup = BeautifulSoup(r2.text, "html.parser")
            for card in soup.select(".item-card")[:5]:
                name_el = card.select_one(".item-card__name a")
                price_el = card.select_one(".item-card__prices-price")
                if name_el:
                    href = name_el.get("href", "")
                    name = name_el.get_text(strip=True)
                    price = 0
                    if price_el:
                        clean = re.sub(r"[^\d]", "", price_el.get_text())
                        price = int(clean) if clean else 0
                    results.append({
                        "name": name,
                        "url": "https://kaspi.kz" + href if href.startswith("/") else href,
                        "price": price
                    })
    except Exception as e:
        logger.error(f"kaspi_search fallback error: {e}")

    return results


def get_seller_position(product_url: str, seller_id: str) -> dict:
    """
    Find our seller's position using Kaspi offers API.
    product_url: https://kaspi.kz/shop/p/-{masterSku}/ OR any url (masterSku extracted from it)
    seller_id: our merchantId
    Returns {"position": int|None, "total": int, "my_price": int|None, "prices": [int], "competitors": [...]}
    """
    try:
        # Extract masterSku from url: https://kaspi.kz/shop/p/-154256658/ → "154256658"
        master_sku = product_url.rstrip("/").split("-")[-1]
        if not master_sku.isdigit():
            logger.error(f"Cannot extract masterSku from url: {product_url}")
            return {"position": None, "total": 0, "my_price": None, "prices": [], "competitors": []}

        r = requests.get(
            f"https://kaspi.kz/yml/offer-view/offers/{master_sku}",
            headers={**BROWSER_HEADERS, "Accept": "application/json"},
            timeout=15,
        )
        if r.status_code != 200:
            return {"position": None, "total": 0, "my_price": None, "prices": [], "competitors": []}

        data = r.json()
        offers = data.get("offers") or []
        total = data.get("offersCount") or data.get("total") or len(offers)

        # Offers are already sorted by Kaspi (position = index + 1)
        prices = [int(o.get("price") or 0) for o in offers if o.get("price")]
        competitors = [
            {
                "position": idx + 1,
                "merchantId": o.get("merchantId", ""),
                "merchantName": o.get("merchantName", ""),
                "price": int(o.get("price") or 0),
                "rating": o.get("merchantRating"),
                "reviewsCount": o.get("merchantReviewsQuantity", 0),
                "kaspiDelivery": o.get("kaspiDelivery", False),
                "deliveryDuration": o.get("deliveryDuration", ""),
            }
            for idx, o in enumerate(offers)
        ]

        # Find our position by merchantId
        position = None
        my_price = None
        for idx, o in enumerate(offers):
            if str(o.get("merchantId", "")) == str(seller_id):
                position = idx + 1
                my_price = int(o.get("price") or 0)
                break

        return {
            "position": position,
            "total": total,
            "my_price": my_price,
            "prices": prices,
            "competitors": competitors,
        }
    except Exception as e:
        logger.error(f"get_seller_position error: {e}")
        return {"position": None, "total": 0, "my_price": None, "prices": [], "competitors": []}


def get_competitor_min_price(master_sku: str, seller_ids: list) -> dict:
    """
    Fetch competitor prices from Kaspi offers API, excluding our own stores.
    Returns {"ok": bool, "min_price": int|None, "total": int, "competitors": [...]}
    Retries on 429 (rate limit).
    """
    url = f"https://kaspi.kz/yml/offer-view/offers/{master_sku}"
    my_ids = {str(s) for s in seller_ids}

    for attempt in range(3):
        try:
            r = requests.get(
                url,
                headers={**BROWSER_HEADERS, "Accept": "application/json"},
                timeout=15,
            )
            if r.status_code == 429:
                wait = 5 * (attempt + 1)
                logger.warning(f"Kaspi 429 for {master_sku}, retrying in {wait}s")
                time.sleep(wait)
                continue
            if r.status_code != 200:
                return {"ok": False, "min_price": None, "total": 0, "competitors": []}

            data = r.json()
            offers = data.get("offers") or []
            total = data.get("offersCount") or len(offers)

            competitors = [
                {
                    "merchantId": str(o.get("merchantId", "")),
                    "merchantName": o.get("merchantName", ""),
                    "price": int(o.get("price") or 0),
                    "position": idx + 1,
                }
                for idx, o in enumerate(offers)
                if str(o.get("merchantId", "")) not in my_ids and o.get("price")
            ]

            if not competitors:
                return {"ok": True, "min_price": None, "total": total, "competitors": []}

            min_price = min(c["price"] for c in competitors if c["price"] > 0)
            return {"ok": True, "min_price": min_price, "total": total, "competitors": competitors}

        except Exception as e:
            logger.error(f"get_competitor_min_price error: {e}")
            return {"ok": False, "min_price": None, "total": 0, "competitors": []}

    return {"ok": False, "min_price": None, "total": 0, "competitors": [], "error": "rate_limited"}


def get_competitor_prices(product_url: str) -> list[int]:
    try:
        r = requests.get(product_url, headers=BROWSER_HEADERS, timeout=20)
        if not r:
            return []
        html = r.text
        prices = []
        soup = BeautifulSoup(html, "html.parser")

        next_data = soup.find("script", {"id": "__NEXT_DATA__"})
        if next_data and next_data.string:
            raw = json.loads(next_data.string)
            prices = _extract_prices_from_json(raw)

        if not prices:
            found = re.findall(r'"price"\s*:\s*(\d{4,7})', html)
            prices = [int(p) for p in found if 1000 < int(p) < 10_000_000]

        if not prices:
            for el in soup.select(".item-card__prices-price, .price, [data-zone-name='price'] span"):
                clean = re.sub(r"[^\d]", "", el.get_text(strip=True))
                if clean and 4 <= len(clean) <= 7:
                    prices.append(int(clean))

        return sorted(set(p for p in prices if 1000 < p < 10_000_000))
    except Exception as e:
        logger.error(f"get_competitor_prices error: {e}")
        return []


def _extract_prices_from_json(obj, depth=0) -> list[int]:
    if depth > 15:
        return []
    prices = []
    if isinstance(obj, dict):
        for key, val in obj.items():
            if key.lower() in ("price", "unitprice", "offerprice", "minprice"):
                try:
                    p = int(float(val))
                    if 1000 < p < 10_000_000:
                        prices.append(p)
                except (TypeError, ValueError):
                    pass
            prices.extend(_extract_prices_from_json(val, depth + 1))
    elif isinstance(obj, list):
        for item in obj:
            prices.extend(_extract_prices_from_json(item, depth + 1))
    return prices
