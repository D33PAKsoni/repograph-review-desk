from .subscription import cancel


def charge(sub, amount: int) -> None:
    return None


def refund(subscription_id: str) -> dict:
    return cancel(subscription_id)
