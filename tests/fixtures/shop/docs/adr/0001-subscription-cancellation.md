# ADR 0001: Subscription cancellation

Subscription cancellation is owned by `services/subscription.py` and must call
the billing service so refunds are recorded. The HTTP endpoint is exposed by
the API router. Tests for cancellation live in `tests/test_subscription.py`.

Dynamic plugin loading is not covered by the static dependency graph.
