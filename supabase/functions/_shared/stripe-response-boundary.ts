import {
  readBoundedResponseText,
  ResponseBodyBoundaryError,
} from "./response-body-boundary.ts";

const defaultMaximumBytes = 262_144;
const jsonContentTypePattern = /^application\/json(?:\s*;.*)?$/i;

export class StripeResponseBoundaryError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("Stripe response was rejected");
    this.name = "StripeResponseBoundaryError";
    this.code = code;
  }
}

function reject(code: string): never {
  throw new StripeResponseBoundaryError(code);
}

export async function readBoundedStripeJson(
  response: Response,
  maximumBytes = defaultMaximumBytes,
): Promise<Record<string, unknown>> {
  if (
    !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 1_024
    || maximumBytes > defaultMaximumBytes
  ) {
    throw new Error("Stripe response boundary configuration is invalid");
  }

  const contentType = response.headers.get("content-type")?.trim() || "";
  if (!jsonContentTypePattern.test(contentType)) reject("content_type_invalid");

  let text: string;
  try {
    text = await readBoundedResponseText(response, maximumBytes);
  } catch (error) {
    if (error instanceof ResponseBodyBoundaryError) reject(error.code);
    throw error;
  }
  const actualBytes = new TextEncoder().encode(text).byteLength;
  if (actualBytes < 2) reject("response_empty");
  if (actualBytes > maximumBytes) reject("response_too_large");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    reject("json_invalid");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    reject("shape_invalid");
  }
  return parsed as Record<string, unknown>;
}
