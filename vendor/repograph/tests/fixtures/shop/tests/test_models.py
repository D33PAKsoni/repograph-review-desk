from shop.models import Subscription


def test_subscription_starts_active() -> None:
    assert Subscription("sub_1").status == "active"
