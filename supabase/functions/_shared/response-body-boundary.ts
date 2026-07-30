const maximumConfiguredBytes = 1_048_576;

export type ResponseBodyBoundaryCode =
  | "content_length_invalid"
  | "response_too_large"
  | "response_unreadable";

export class ResponseBodyBoundaryError extends Error {
  readonly code: ResponseBodyBoundaryCode;

  constructor(code: ResponseBodyBoundaryCode) {
    super("Remote response body was rejected");
    this.name = "ResponseBodyBoundaryError";
    this.code = code;
  }
}

export async function readBoundedResponseText(
  response: Response,
  maximumBytes: number,
) {
  if (
    !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 1
    || maximumBytes > maximumConfiguredBytes
  ) {
    throw new Error("Response body boundary configuration is invalid");
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new ResponseBodyBoundaryError("content_length_invalid");
    }
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes)) {
      throw new ResponseBodyBoundaryError("content_length_invalid");
    }
    if (declaredBytes > maximumBytes) {
      throw new ResponseBodyBoundaryError("response_too_large");
    }
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      totalBytes += result.value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ResponseBodyBoundaryError("response_too_large");
      }
      chunks.push(result.value);
    }
  } catch (error) {
    if (error instanceof ResponseBodyBoundaryError) throw error;
    throw new ResponseBodyBoundaryError("response_unreadable");
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
    throw new ResponseBodyBoundaryError("response_unreadable");
  }
}
