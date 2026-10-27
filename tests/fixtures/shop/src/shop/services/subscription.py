from ..models import Subscription
from . import audit
from .billing import charge


def cancel(subscription_id: str) -> dict:
    sub = Subscription(subscription_id)
    charge(sub, 0)
    audit.record("cancel", subscription_id)
    return {"id": subscription_id, "status": "cancelled"}
