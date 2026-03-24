"""
Kaspi Merchant Cabinet GraphQL API
Uses mc-session / mc-sid session cookies.
Endpoint: https://mc.shop.kaspi.kz/bff/graphql
"""
import logging
from services.kaspi_mc import build_session

logger = logging.getLogger(__name__)

GRAPHQL_URL = "https://mc.shop.kaspi.kz/bff/graphql"

GET_ORDERS_QUERY = """
query getOrders($merchantId: ID!, $page: Int, $pageSize: Int, $tab: String) {
  merchant(id: $merchantId) {
    id
    orders {
      orders(page: $page, pageSize: $pageSize, tab: $tab) {
        total
        orders {
          code
          customer { firstName lastName }
          totalPrice
          creationTime
          modificationTime
          status
          entries {
            merchantProduct { code name }
            totalPrice
            quantity
          }
          destination {
            __typename
            ... on Postomat {
              id
              postomatAddress
              city { name }
            }
            ... on OrderAddress {
              streetName
              streetNumber
              building
              city { name }
            }
          }
          warehouse { id name }
          steps { status step plannedTime }
          kaspiDelivery
          deliveryZone
          delivery {
            plannedDeliveryDate
            transmissionPlanningDate
            mode
          }
          cancelReason
        }
      }
    }
  }
}
"""


def fetch_orders(
    seller_id: str,
    cookies_str: str = "",
    mc_session: str = "",
    mc_sid: str = "",
    page: int = 0,
    page_size: int = 50,
    tab: str = None,
) -> dict:
    """
    Fetch orders from Kaspi MC via GraphQL.
    Returns {"ok": bool, "orders": [...], "total": int}
    """
    if not cookies_str and not mc_session and not mc_sid:
        return {"ok": False, "orders": [], "total": 0, "message": "Куки не заполнены"}

    try:
        variables = {
            "merchantId": seller_id,
            "page": page,
            "pageSize": page_size,
        }
        if tab:
            variables["tab"] = tab

        session = build_session(cookies_str, mc_session, mc_sid)
        resp = session.post(
            GRAPHQL_URL,
            json={
                "operationName": "getOrders",
                "variables": variables,
                "query": GET_ORDERS_QUERY,
            },
            params={"opName": "getOrders"},
            headers={"Content-Type": "application/json"},
            timeout=25,
        )

        if resp.status_code in (401, 403):
            return {"ok": False, "orders": [], "total": 0, "message": "Сессия истекла — обновите куки"}
        if resp.status_code != 200:
            return {"ok": False, "orders": [], "total": 0, "message": f"HTTP {resp.status_code}"}

        data = resp.json()
        if "errors" in data:
            err_msg = data["errors"][0].get("message", str(data["errors"])) if data["errors"] else "GraphQL error"
            return {"ok": False, "orders": [], "total": 0, "message": err_msg}

        merchant = data.get("data", {}).get("merchant", {}) or {}
        orders_data = merchant.get("orders", {}).get("orders", {}) or {}
        orders = orders_data.get("orders") or []
        total = orders_data.get("total") or len(orders)

        return {"ok": True, "orders": orders, "total": total}
    except Exception as e:
        logger.error(f"fetch_orders error: {e}")
        return {"ok": False, "orders": [], "total": 0, "message": str(e)}


def format_destination(destination: dict) -> str:
    """Convert Kaspi destination object to address string."""
    if not destination:
        return ""
    typename = destination.get("__typename", "")
    city = (destination.get("city") or {}).get("name", "")

    if typename == "Postomat":
        addr = destination.get("postomatAddress", "")
        return f"{city}, Постомат: {addr}" if city else addr

    # OrderAddress
    parts = [
        destination.get("streetName", ""),
        destination.get("streetNumber", ""),
        destination.get("building", ""),
    ]
    addr = " ".join(p for p in parts if p).strip()
    return f"{city}, {addr}" if city and addr else city or addr


def get_current_step(steps: list) -> str:
    """Return the current delivery step label."""
    step_labels = {
        "TRANSMISSION": "Сборка",
        "TRANSIT": "В пути",
        "DELIVERY": "Доставка",
        "PICKUP": "Постамат",
        "ACCEPTANCE": "Принят",
        "APPROVAL": "Одобрен",
    }
    for step in (steps or []):
        if step.get("status") == "CURRENT":
            return step_labels.get(step.get("step", ""), step.get("step", ""))
    return ""


def kaspi_status_to_local(kaspi_status: str) -> str:
    mapping = {
        "ACCEPTED": "confirmed",
        "COMPLETED": "done",
        "CANCELLED": "cancelled",
        "KASPI_DELIVERY": "shipped",
        "PICKUP": "shipped",
    }
    return mapping.get(kaspi_status, "new")
