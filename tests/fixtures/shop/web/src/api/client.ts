import { SubscriptionService } from "@/domain/subscription";

export function cancelSubscription(id: string): Promise<Response> {
  return new SubscriptionService("/api").cancel(id);
}
