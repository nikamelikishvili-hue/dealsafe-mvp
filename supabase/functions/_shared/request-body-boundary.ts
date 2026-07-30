const maximumConfiguredBytes = 262_144;

export type RequestBodyBoundaryCode =
  | "body_too_large"
  | "body_unreadable"
  | "content_length_invalid";

export class RequestBodyBoundaryError extends Error {
  readonly code: RequestBodyBoundaryCode;

  constructor(code: RequestBodyBoundaryCode) {
    super("Request body was rejected");
    this.name = "RequestBodyBoundaryError";
    this.code = code;
  }
}

export async function readBoundedRequestText(
  request: Request,
  maximumBytes: number,
) {
  if (
    !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 1
    || maximumBytes > maximumConfiguredBytes
  ) {
    throw new Error("Request body boundary configuration is invalid");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new RequestBodyBoundaryError("content_length_invalid");
    }
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes)) {
      throw new RequestBodyBoundaryError("content_length_invalid");
    }
    if (declaredBytes > maximumBytes) {
      throw new RequestBodyBoundaryError("body_too_large");
    }
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      totalBytes += result.value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyBoundaryError("body_too_large");
      }
      chunks.push(result.value);
    }
  } catch (error) {
    if (error instanceof RequestBodyBoundaryError) throw error;
    throw new RequestBodyBoundaryError("body_unreadable");
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new RequestBodyBoundaryError("body_unreadable");
  }
}
