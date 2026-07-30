import {
  readBoundedRequestText,
  RequestBodyBoundaryError,
} from "./request-body-boundary.ts";

const defaultMaximumBytes = 16_384;
const contentTypePattern = /^application\/json(?:\s*;\s*charset=utf-8)?$/i;
const keyPattern = /^[a-z][A-Za-z0-9]{0,39}$/;

export class EvidenceJsonBoundaryError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("Evidence request body was rejected");
    this.name = "EvidenceJsonBoundaryError";
    this.code = code;
  }
}

function reject(code: string): never {
  throw new EvidenceJsonBoundaryError(code);
}

function normalizedActions(
  actionKeys: Readonly<Record<string, readonly string[]>>,
) {
  const entries = Object.entries(actionKeys);
  if (
    entries.length < 1
    || entries.length > 12
    || entries.some(([action, keys]) =>
      !/^[a-z][a-z-]{0,39}$/.test(action)
      || keys.length < 1
      || keys.length > 12
      || keys[0] !== "action"
      || keys.some(key => !keyPattern.test(key))
      || new Set(keys).size !== keys.length
    )
  ) {
    throw new Error("Evidence JSON boundary configuration is invalid");
  }
  return new Map(entries.map(([action, keys]) => [action, new Set(keys)]));
}

export async function readBoundedEvidenceJson(
  request: Request,
  actionKeys: Readonly<Record<string, readonly string[]>>,
  maximumBytes = defaultMaximumBytes,
): Promise<Record<string, unknown>> {
  if (
    !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 256
    || maximumBytes > defaultMaximumBytes
  ) {
    throw new Error("Evidence JSON boundary configuration is invalid");
  }

  const actions = normalizedActions(actionKeys);
  const contentType = request.headers.get("content-type")?.trim() || "";
  if (!contentTypePattern.test(contentType)) reject("content_type_invalid");

  let text: string;
  try {
    text = await readBoundedRequestText(request, maximumBytes);
  } catch (error) {
    if (error instanceof RequestBodyBoundaryError) reject(error.code);
    throw error;
  }
  if (new TextEncoder().encode(text).byteLength < 2) reject("body_empty");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    reject("json_invalid");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    reject("shape_invalid");
  }

  const body = parsed as Record<string, unknown>;
  if (typeof body.action !== "string") reject("action_invalid");
  const allowed = actions.get(body.action);
  if (!allowed) reject("action_invalid");
  const keys = Object.keys(body);
  if (keys.length > allowed.size || keys.some(key => !allowed.has(key))) {
    reject("shape_invalid");
  }
  return body;
}
