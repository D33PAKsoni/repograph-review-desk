from fastapi import APIRouter

from ..services.subscription import cancel

router = APIRouter()


@router.post("/subscriptions/{subscription_id}/cancel")
def cancel_subscription(subscription_id: str) -> dict:
    return cancel(subscription_id)
