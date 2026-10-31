export class SubscriptionService {
  constructor(private base: string) {}

  async cancel(id: string): Promise<Response> {
    return fetch(`${this.base}/subscriptions/${id}/cancel`);
  }
}

export function isActive(subscription: { status: string }): boolean {
  return subscription.status === "active";
}
