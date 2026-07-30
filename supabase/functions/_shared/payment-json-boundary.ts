import {
  readBoundedRequestText,
  RequestBodyBoundaryError,
} from "./request-body-boundary.ts";

const defaultMaximumBytes = 8_192;
const contentTypePattern = /^application\/json(?:\s*;\s*charset=utf-8)?$/i;

export class PaymentJsonBoundaryError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("Payment request body was rejected");
    this.name = "PaymentJsonBoundaryError";
    this.code = code;
  }
}

function reject(code: string): never {
  throw new PaymentJsonBoundaryError(code);
}

function normalizedAllowedKeys(allowedKeys: readonly string[]) {
  if (
    !Array.isArray(allowedKeys)
    || allowedKeys.length < 1
    || allowedKeys.length > 12
    || allowedKeys.some(key => !/^[a-z][A-Za-z0-9]{0,39}$/.test(key))
    || new Set(allowedKeys).size !== allowedKeys.length
  ) {
    throw new Error("Payment JSON boundary configuration is invalid");
  }
  return new Set(allowedKeys);
}

export async function readBoundedPaymentJson(
  request: Request,
  allowedKeys: readonly string[],
  maximumBytes = defaultMaximumBytes,
): Promise<Record<string, unknown>> {
  if (
    !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 256
    || maximumBytes > defaultMaximumBytes
  ) {
    throw new Error("Payment JSON boundary configuration is invalid");
  }

  const contentType = request.headers.get("content-type")?.trim() || "";
  if (!contentTypePattern.test(contentType)) reject("content_type_invalid");

  let text: string;
  try {
    text = await readBoundedRequestText(request, maximumBytes);
  } catch (error) {
    if (error instanceof RequestBodyBoundaryError) reject(error.code);
    throw error;
  }
  const actualBytes = new TextEncoder().encode(text).byteLength;
  if (actualBytes < 2) reject("body_empty");
  if (actualBytes > maximumBytes) reject("body_too_large");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    reject("json_invalid");
  }
  if (
    parsed === null
    || typeof parsed !== "object"
    || Array.isArray(parsed)
  ) {
    reject("shape_invalid");
  }

  const allowed = normalizedAllowedKeys(allowedKeys);
  const keys = Object.keys(parsed);
  if (keys.length > allowed.size || keys.some(key => !allowed.has(key))) {
    reject("shape_invalid");
  }
  return parsed as Record<string, unknown>;
}
