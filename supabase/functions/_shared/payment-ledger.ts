import { adminClient } from "./common.ts";
import {
  type PaymentOperationContext,
  recordPaymentLog,
} from "./payment-observability.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const eventPattern = /^evt_[A-Za-z0-9_]{8,255}$/;
const stripeRequestPattern = /^req_[A-Za-z0-9_]{6,255}$/;

export async function linkFinancialCommandObservation(
  context: PaymentOperationContext,
  commandId: string | null,
  claimToken: string | null,
  stripeRequestId?: string,
) {
  if (!uuidPattern.test(commandId || "") || !uuidPattern.test(claimToken || "")) return;
  const values: Record<string, string> = { correlation_id: context.correlationId };
  if (stripeRequestPattern.test(stripeRequestId || "")) {
    values.provider_request_id = stripeRequestId!;
  }
  const { data, error } = await adminClient()
    .from("stripe_financial_commands")
    .update(values)
    .eq("id", commandId!)
    .eq("claim_token", claimToken!)
    .select("id")
    .maybeSingle();
  if (error || !data?.id) {
    recordPaymentLog(context, {
      event: "command_correlation_write_failed",
      outcome: "warning",
      severity: "warning",
      errorCode: "ledger_observation_failed",
      commandId,
    });
  }
}

export async function linkWebhookObservation(
  context: PaymentOperationContext,
  eventId: string | null,
  claimToken: string | null,
) {
  if (!eventPattern.test(eventId || "") || !uuidPattern.test(claimToken || "")) return;
  const { data, error } = await adminClient()
    .from("stripe_webhook_events")
    .update({ correlation_id: context.correlationId })
    .eq("id", eventId!)
    .eq("claim_token", claimToken!)
    .select("id")
    .maybeSingle();
  if (error || !data?.id) {
    recordPaymentLog(context, {
      event: "webhook_correlation_write_failed",
      outcome: "warning",
      severity: "warning",
      errorCode: "ledger_observation_failed",
      providerEventId: eventId,
    });
  }
}
