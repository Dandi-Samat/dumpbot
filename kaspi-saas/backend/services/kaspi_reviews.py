"""
Kaspi public reviews API.
Endpoint: https://kaspi.kz/yml/review-view/api/v1/reviews/product/{productCode}
No auth required — public API.
"""
import logging
import requests

logger = logging.getLogger(__name__)

REVIEWS_URL = "https://kaspi.kz/yml/review-view/api/v1/reviews/product/{product_code}"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://kaspi.kz/",
}


def fetch_reviews(product_code: str, limit: int = 9, filter_type: str = "COMMENT", sort: str = "POPULARITY") -> dict:
    """
    Fetch reviews for a Kaspi product.
    product_code — first part of SKU before '_' (e.g. '154256658')
    Returns {"ok": bool, "reviews": [...], "summary": {...}, "total": int}
    """
    try:
        resp = requests.get(
            REVIEWS_URL.format(product_code=product_code),
            params={
                "baseProductCode": "",
                "orderCode": "",
                "filter": filter_type,
                "sort": sort,
                "limit": limit,
                "merchantCodes": "",
                "withAgg": "true",
            },
            headers=HEADERS,
            timeout=15,
        )
        if resp.status_code != 200:
            return {"ok": False, "reviews": [], "summary": {}, "total": 0, "message": f"HTTP {resp.status_code}"}

        data = resp.json()
        reviews = data.get("data") or []
        summary = data.get("summary") or {}
        group_summary = data.get("groupSummary") or []
        total = next((g["total"] for g in group_summary if g["id"] == "ALL"), len(reviews))

        return {
            "ok": True,
            "reviews": reviews,
            "summary": summary,
            "group_summary": group_summary,
            "total": total,
            "images_count": data.get("imagesSummaryCount", 0),
        }
    except Exception as e:
        logger.error(f"fetch_reviews error for {product_code}: {e}")
        return {"ok": False, "reviews": [], "summary": {}, "total": 0, "message": str(e)}
