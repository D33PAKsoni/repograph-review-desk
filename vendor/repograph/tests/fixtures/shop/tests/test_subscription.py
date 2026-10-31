from shop.services.subscription import cancel


def test_cancel_returns_cancelled_status() -> None:
    assert cancel("sub_1")["status"] == "cancelled"
