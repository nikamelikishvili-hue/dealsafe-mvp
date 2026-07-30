const maximumConfiguredBytes = 50 * 1024 * 1024;

export type BinaryBodyBoundaryCode =
  | "body_invalid"
  | "body_unreadable"
  | "size_invalid"
  | "size_mismatch";

export class BinaryBodyBoundaryError extends Error {
  readonly code: BinaryBodyBoundaryCode;

  constructor(code: BinaryBodyBoundaryCode) {
    super("Binary body was rejected");
    this.name = "BinaryBodyBoundaryError";
    this.code = code;
  }
}

type BinaryBody = {
  readonly size: number;
  stream(): ReadableStream<Uint8Array>;
};

export async function readExactBinaryBody(
  body: BinaryBody,
  expectedBytes: number,
  maximumBytes: number,
) {
  if (
    !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 1
    || maximumBytes > maximumConfiguredBytes
    || !Number.isSafeInteger(expectedBytes)
    || expectedBytes < 1
    || expectedBytes > maximumBytes
  ) {
    throw new Error("Binary body boundary configuration is invalid");
  }
  if (
    !body
    || typeof body !== "object"
    || !Number.isSafeInteger(body.size)
    || body.size < 0
    || typeof body.stream !== "function"
  ) {
    throw new BinaryBodyBoundaryError("body_invalid");
  }
  if (body.size !== expectedBytes) {
    throw new BinaryBodyBoundaryError("size_mismatch");
  }

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = body.stream();
  } catch {
    throw new BinaryBodyBoundaryError("body_unreadable");
  }
  if (!stream || typeof stream.getReader !== "function") {
    throw new BinaryBodyBoundaryError("body_invalid");
  }

  const output = new Uint8Array(expectedBytes);
  const reader = stream.getReader();
  let offset = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) {
        await reader.cancel().catch(() => undefined);
        throw new BinaryBodyBoundaryError("body_unreadable");
      }
      const nextOffset = offset + result.value.byteLength;
      if (nextOffset > expectedBytes || nextOffset > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BinaryBodyBoundaryError("size_mismatch");
      }
      output.set(result.value, offset);
      offset = nextOffset;
    }
  } catch (error) {
    if (error instanceof BinaryBodyBoundaryError) throw error;
    throw new BinaryBodyBoundaryError("body_unreadable");
  } finally {
    reader.releaseLock();
  }
  if (offset !== expectedBytes) {
    throw new BinaryBodyBoundaryError("size_mismatch");
  }
  return output;
}
