class Base:
    pass


class Subscription(Base):
    def __init__(self, subscription_id: str) -> None:
        self.id = subscription_id
        self.status = "active"


class Customer(Base):
    def __init__(self, customer_id: str) -> None:
        self.id = customer_id
