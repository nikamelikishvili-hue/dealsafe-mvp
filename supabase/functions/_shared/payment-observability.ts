const correlationHeader = "X-Dealivra-Correlation-Id";
const codePattern = /^[a-z0-9_]{1,64}$/;
const operationPattern = /^[a-z0-9-]{3,64}$/;
const stripeRequestPattern = /^req_[A-Za-z0-9_]{6,255}$/;
const safeIdentifierPattern = /^[A-Za-z0-9_.:-]{1,255}$/;

export type PaymentOperationContext = {
  correlationId: string;
  operation: string;
  startedAt: number;
};

type PaymentErrorOptions = {
  retryable?: boolean;
  severity?: "warning" | "error";
  providerStatus?: number;
  providerRequestId?: string;
  providerCode?: string;
};

export class PaymentOperationError extends Error {
  readonly code: string;
  readonly publicMessage: string;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly severity: "warning" | "error";
  readonly providerStatus?: number;
  readonly providerRequestId?: string;
  readonly providerCode?: string;

  constructor(
    code: string,
    publicMessage: string,
    httpStatus: number,
    options: PaymentErrorOptions = {},
  ) {
    super(code);
    this.name = "PaymentOperationError";
    this.code = codePattern.test(code) ? code : "payment_operation_failed";
    this.publicMessage = publicMessage.slice(0, 240);
    this.httpStatus = Number.isInteger(httpStatus) && httpStatus >= 400 && httpStatus <= 599
      ? httpStatus
      : 500;
    this.retryable = options.retryable === true;
    this.severity = options.severity || (this.httpStatus >= 500 ? "error" : "warning");
    this.providerStatus = options.providerStatus;
    this.providerRequestId = stripeRequestPattern.test(options.providerRequestId || "")
      ? options.providerRequestId
      : undefined;
    this.providerCode = codePattern.test(options.providerCode || "")
      ? options.providerCode
      : undefined;
  }
}

export function startPaymentOperation(operation: string): PaymentOperationContext {
  return {
    correlationId: crypto.randomUUID(),
    operation: operationPattern.test(operation) ? operation : "payment-operation",
    startedAt: Date.now(),
  };
}

export function paymentError(
  code: string,
  publicMessage: string,
  httpStatus = 400,
  options: PaymentErrorOptions = {},
) {
  return new PaymentOperationError(code, publicMessage, httpStatus, options);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function safeProviderCode(value: unknown) {
  return typeof value === "string" && codePattern.test(value)
    ? value
    : undefined;
}

export function stripeProviderError(response: Response, payload: unknown) {
  const provider = record(record(payload).error);
  const providerCode = safeProviderCode(provider.code)
    || safeProviderCode(provider.decline_code)
    || safeProviderCode(provider.type)
    || `http_${response.status}`;
  const providerRequestId = response.headers.get("request-id") || undefined;

  if (response.status === 429 || providerCode === "rate_limit_error") {
    return paymentError(
      "provider_rate_limited",
      "The payment provider is busy. Please wait a moment and try again.",
      503,
      {
        retryable: true,
        providerStatus: response.status,
        providerRequestId,
        providerCode,
      },
    );
  }

  if (
    response.status >= 500
    || providerCode === "api_connection_error"
    || providerCode === "api_error"
  ) {
    return paymentError(
      "provider_unavailable",
      "The payment provider is temporarily unavailable. Please try again later.",
      503,
      {
        retryable: true,
        providerStatus: response.status,
        providerRequestId,
        providerCode,
      },
    );
  }

  if (response.status === 401 || providerCode === "authentication_error") {
    return paymentError(
      "provider_configuration_error",
      "Secure payment service is temporarily unavailable.",
      503,
      {
        providerStatus: response.status,
        providerRequestId,
        providerCode,
      },
    );
  }

  return paymentError(
    "provider_request_rejected",
    "The payment provider could not complete this request. Please review the payment details or contact support.",
    502,
    {
      providerStatus: response.status,
      providerRequestId,
      providerCode,
    },
  );
}

export function stripeNetworkError() {
  return paymentError(
    "provider_network_error",
    "The payment provider could not be reached. Please try again later.",
    503,
    { retryable: true },
  );
}

function normalizeError(error: unknown) {
  if (error instanceof PaymentOperationError) return error;
  const message = error instanceof Error ? error.message : "";
  if (/^Sign in is required$/i.test(message)) {
    return paymentError("authentication_required", "Sign in is required.", 401);
  }
  if (/^Your session is invalid or expired$/i.test(message)) {
    return paymentError(
      "session_expired",
      "Your session expired. Please sign in again.",
      401,
    );
  }
  if (/^Multi-factor verification is required$/i.test(message)) {
    return paymentError(
      "mfa_required",
      "Verify your authenticator before continuing.",
      403,
    );
  }
  return paymentError(
    "payment_service_error",
    "Secure payment service is temporarily unavailable.",
    500,
  );
}

type PaymentLogDetails = {
  event: string;
  outcome: "succeeded" | "failed" | "duplicate" | "in_progress" | "warning";
  severity?: "info" | "warning" | "error";
  errorCode?: string;
  httpStatus?: number;
  retryable?: boolean;
  providerStatus?: number;
  providerRequestId?: string;
  providerCode?: string;
  commandId?: string | null;
  dealId?: string | null;
  providerEventId?: string | null;
};

function safeIdentifier(value: string | null | undefined) {
  return value && safeIdentifierPattern.test(value) ? value : undefined;
}

export function recordPaymentLog(
  context: PaymentOperationContext,
  details: PaymentLogDetails,
) {
  const severity = details.severity
    || (details.outcome === "failed" ? "error" : details.outcome === "warning" ? "warning" : "info");
  const entry = {
    schema: "dealivra.payment.operation.v1",
    timestamp: new Date().toISOString(),
    severity,
    operation: context.operation,
    event: codePattern.test(details.event) ? details.event : "payment_event",
    outcome: details.outcome,
    correlation_id: context.correlationId,
    duration_ms: Math.max(0, Date.now() - context.startedAt),
    ...(codePattern.test(details.errorCode || "") ? { error_code: details.errorCode } : {}),
    ...(Number.isInteger(details.httpStatus) ? { http_status: details.httpStatus } : {}),
    ...(typeof details.retryable === "boolean" ? { retryable: details.retryable } : {}),
    ...(Number.isInteger(details.providerStatus) ? { provider_status: details.providerStatus } : {}),
    ...(stripeRequestPattern.test(details.providerRequestId || "")
      ? { provider_request_id: details.providerRequestId }
      : {}),
    ...(codePattern.test(details.providerCode || "") ? { provider_code: details.providerCode } : {}),
    ...(safeIdentifier(details.commandId) ? { command_id: details.commandId } : {}),
    ...(safeIdentifier(details.dealId) ? { deal_id: details.dealId } : {}),
    ...(safeIdentifier(details.providerEventId) ? { provider_event_id: details.providerEventId } : {}),
  };
  const serialized = JSON.stringify(entry);
  if (severity === "error") console.error(serialized);
  else if (severity === "warning") console.warn(serialized);
  else console.info(serialized);
}

export function recordPaymentSuccess(
  context: PaymentOperationContext,
  event: string,
  details: Omit<PaymentLogDetails, "event" | "outcome" | "severity"> = {},
) {
  recordPaymentLog(context, { ...details, event, outcome: "succeeded", severity: "info" });
}

export function paymentErrorResponse(
  context: PaymentOperationContext,
  error: unknown,
  details: Pick<PaymentLogDetails, "commandId" | "dealId" | "providerEventId"> = {},
) {
  const normalized = normalizeError(error);
  recordPaymentLog(context, {
    ...details,
    event: "request_failed",
    outcome: "failed",
    severity: normalized.severity,
    errorCode: normalized.code,
    httpStatus: normalized.httpStatus,
    retryable: normalized.retryable,
    providerStatus: normalized.providerStatus,
    providerRequestId: normalized.providerRequestId,
    providerCode: normalized.providerCode,
  });
  return paymentJson(context, {
    error: normalized.publicMessage,
    code: normalized.code,
    correlationId: context.correlationId,
    retryable: normalized.retryable,
  }, normalized.httpStatus);
}

export function paymentJson(
  context: PaymentOperationContext,
  body: unknown,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      [correlationHeader]: context.correlationId,
    },
  });
}

export function withPaymentCorrelation(
  response: Response,
  context: PaymentOperationContext,
) {
  const headers = new Headers(response.headers);
  headers.set(correlationHeader, context.correlationId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function providerRequestId(error: unknown) {
  return error instanceof PaymentOperationError ? error.providerRequestId : undefined;
}

export { correlationHeader };
