export const paymentCapabilityEnvironment = Object.freeze({
  seller_onboarding: "DEALIVRA_SELLER_ONBOARDING_MODE",
  checkout: "DEALIVRA_CHECKOUT_MODE",
  payout_release: "DEALIVRA_PAYOUT_RELEASE_MODE",
  refund: "DEALIVRA_REFUND_MODE",
} as const);

export type PaymentCapability = keyof typeof paymentCapabilityEnvironment;
type EnvironmentReader = (name: string) => string | undefined;

export type PaymentCapabilityDecision = Readonly<{
  allowed: boolean;
  capability: PaymentCapability;
  mode: "disabled" | "sandbox" | "invalid";
  code: "payment_capability_disabled" | "payment_configuration_invalid" | null;
}>;

export function paymentCapabilityDecision(
  capability: PaymentCapability,
  readEnvironment: EnvironmentReader,
): PaymentCapabilityDecision {
  const variable = paymentCapabilityEnvironment[capability];
  const raw = readEnvironment(variable);
  const mode = typeof raw === "string"
    ? raw.trim()
    : "disabled";

  if (mode === "sandbox") {
    return Object.freeze({
      allowed: true,
      capability,
      mode,
      code: null,
    });
  }
  if (mode === "disabled" || mode === "") {
    return Object.freeze({
      allowed: false,
      capability,
      mode: "disabled",
      code: "payment_capability_disabled",
    });
  }
  return Object.freeze({
    allowed: false,
    capability,
    mode: "invalid",
    code: "payment_configuration_invalid",
  });
}
