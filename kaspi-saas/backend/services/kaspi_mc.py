"""
Kaspi Merchant Cabinet API - ported from bot.py
"""
import time
import logging
import requests

logger = logging.getLogger(__name__)

MC_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://kaspi.kz",
    "Referer": "https://kaspi.kz/mc/",
}


def build_session(
    cookies_str: str = "",
    mc_session: str = "",
    mc_sid: str = "",
) -> requests.Session:
    s = requests.Session()
    s.headers.update(MC_HEADERS)

    # Direct mc-session / mc-sid fields take priority
    if mc_session:
        s.cookies.set("mc-session", mc_session, domain="mc.shop.kaspi.kz")
    if mc_sid:
        s.cookies.set("mc-sid", mc_sid, domain="mc.shop.kaspi.kz")

    # Full cookie string as fallback / additional cookies
    if cookies_str:
        for part in cookies_str.split(";"):
            part = part.strip()
            if "=" in part:
                name, _, value = part.partition("=")
                name = name.strip()
                value = value.strip()
                # Don't overwrite if already set from direct fields
                if name == "mc-session" and mc_session:
                    continue
                if name == "mc-sid" and mc_sid:
                    continue
                if name in ("mc-session", "mc-sid"):
                    s.cookies.set(name, value, domain="mc.shop.kaspi.kz")
                else:
                    s.cookies.set(name, value, domain="kaspi.kz")
    return s


def check_session(seller_id: str, cookies_str: str = "", mc_session: str = "", mc_sid: str = "") -> dict:
    """Returns {"ok": bool, "message": str}"""
    if not cookies_str and not mc_session and not mc_sid:
        return {"ok": False, "message": "Куки не заполнены"}
    try:
        session = build_session(cookies_str, mc_session, mc_sid)
        r = session.get(
            f"https://mc.shop.kaspi.kz/bff/offer-view/list?m={seller_id}&p=0&l=1&a=true",
            timeout=15
        )
        if r.status_code == 200:
            return {"ok": True, "message": "Сессия активна"}
        elif r.status_code in (401, 403):
            return {"ok": False, "message": "Сессия истекла — обновите куки"}
        else:
            return {"ok": False, "message": f"Статус {r.status_code}"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


def get_offers(seller_id: str, cookies_str: str = "", mc_session: str = "", mc_sid: str = "", page: int = 0, limit: int = 100) -> dict:
    """
    Fetch merchant's offers (products) from Kaspi MC cabinet.
    Returns {"ok": bool, "items": [...], "total": int}
    """
    if not cookies_str and not mc_session and not mc_sid:
        return {"ok": False, "items": [], "total": 0, "message": "Куки не заполнены"}
    try:
        session = build_session(cookies_str, mc_session, mc_sid)
        r = session.get(
            f"https://mc.shop.kaspi.kz/bff/offer-view/list",
            params={
                "m": seller_id,
                "p": page,
                "l": limit,
                "a": "true",
                "t": "",
                "c": "",
                "lowStock": "false",
                "notSpecifiedStock": "false",
            },
            timeout=20,
        )
        if r.status_code in (401, 403):
            return {"ok": False, "items": [], "total": 0, "message": "Сессия истекла — обновите куки"}
        if r.status_code != 200:
            return {"ok": False, "items": [], "total": 0, "message": f"HTTP {r.status_code}"}

        data = r.json()
        # Kaspi MC list endpoint returns {"data": [...], "total": N}
        offers = data.get("data") or data.get("merchantOffers") or data.get("offers") or []
        total = data.get("total") or data.get("totalCount") or len(offers)
        return {"ok": True, "items": offers, "total": total}
    except Exception as e:
        logger.error(f"get_offers error: {e}")
        return {"ok": False, "items": [], "total": 0, "message": str(e)}


def update_price(
    seller_id: str,
    store_id: str,
    city_id: str,
    sku: str,
    new_price: int,
    cookies_str: str = "",
    mc_session: str = "",
    mc_sid: str = "",
    name: str = "",
    stock: int = 1,
) -> dict:
    """
    Updates price via Kaspi MC endpoint.
    Returns {"ok": bool, "message": str}
    """
    if not cookies_str and not mc_session and not mc_sid:
        return {"ok": False, "message": "Куки не заполнены"}

    url = "https://mc.shop.kaspi.kz/pricefeed/upload/merchant/process"
    payload = {
        "merchantUid": seller_id,
        "sku": sku,
        "model": name,
        "availabilities": [
            {
                "available": "yes",
                "storeId": store_id,
                "stockCount": stock if stock > 0 else 1
            }
        ],
        "cityPrices": [
            {
                "cityId": city_id,
                "value": new_price
            }
        ]
    }

    for attempt in range(1, 4):
        try:
            session = build_session(cookies_str, mc_session, mc_sid)
            r = session.post(url, json=payload, timeout=25)

            if r.status_code in (200, 201, 202, 204):
                logger.info(f"Price updated: {sku} -> {new_price}₸")
                return {"ok": True, "message": f"Цена обновлена: {new_price}₸"}

            if r.status_code in (401, 403):
                return {"ok": False, "message": "Сессия истекла — обновите куки"}

            logger.error(f"update_price HTTP {r.status_code}: {r.text[:200]}")

        except requests.exceptions.Timeout:
            logger.warning(f"update_price timeout attempt {attempt}")
        except Exception as e:
            logger.error(f"update_price exception: {e}")
            return {"ok": False, "message": str(e)}

        if attempt < 3:
            time.sleep(5 * attempt)

    return {"ok": False, "message": "Не удалось обновить цену после 3 попыток"}
