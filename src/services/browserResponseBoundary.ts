const defaultMaximumJsonBytes = 1_048_576;
const defaultRequestTimeoutMs = 30_000;
const maximumConfiguredBytes = 4_194_304;
const maximumEvidenceBytes = 52_428_800;
const maximumConfiguredTimeoutMs = 120_000;
const jsonMediaTypePattern =
  /^(?:application\/json|application\/(?:[\w.-]+\+)?json|application\/vnd\.pgrst\.(?:object|array)\+json)(?:\s*;.*)?$/i;

export type BrowserResponseBoundaryCode =
  | 'content_length_invalid'
  | 'content_type_invalid'
  | 'json_invalid'
  | 'response_size_mismatch'
  | 'response_too_large'
  | 'response_unreadable';

export class BrowserResponseBoundaryError extends Error {
  readonly code: BrowserResponseBoundaryCode;

  constructor(code: BrowserResponseBoundaryCode) {
    super('Remote response was rejected');
    this.name = 'BrowserResponseBoundaryError';
    this.code = code;
  }
}

function assertMaximumBytes(maximumBytes: number) {
  if (
    !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 1
    || maximumBytes > maximumConfiguredBytes
  ) {
    throw new Error('Browser response boundary configuration is invalid');
  }
}

function declaredLength(response: Response, maximumBytes: number) {
  const rawLength = response.headers.get('content-length');
  if (rawLength === null) return;
  if (!/^\d+$/.test(rawLength)) {
    throw new BrowserResponseBoundaryError('content_length_invalid');
  }
  const parsedLength = Number(rawLength);
  if (!Number.isSafeInteger(parsedLength)) {
    throw new BrowserResponseBoundaryError('content_length_invalid');
  }
  if (parsedLength > maximumBytes) {
    throw new BrowserResponseBoundaryError('response_too_large');
  }
}

async function readBoundedBytes(response: Response, maximumBytes: number) {
  assertMaximumBytes(maximumBytes);
  declaredLength(response, maximumBytes);

  if (!response.body) return new Uint8Array();

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
        throw new BrowserResponseBoundaryError('response_too_large');
      }
      chunks.push(result.value);
    }
  } catch (error) {
    if (error instanceof BrowserResponseBoundaryError) throw error;
    throw new BrowserResponseBoundaryError('response_unreadable');
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function decodeUtf8(bytes: Uint8Array) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new BrowserResponseBoundaryError('response_unreadable');
  }
}

export async function readBoundedText(
  response: Response,
  maximumBytes = 65_536,
) {
  const bytes = await readBoundedBytes(response, maximumBytes);
  return decodeUtf8(bytes);
}

export async function readBoundedJson(
  response: Response,
  maximumBytes = defaultMaximumJsonBytes,
): Promise<unknown> {
  const bytes = await readBoundedBytes(response, maximumBytes);
  if (bytes.byteLength === 0) return null;

  const mediaType = response.headers.get('content-type')?.trim() ?? '';
  if (!jsonMediaTypePattern.test(mediaType)) {
    throw new BrowserResponseBoundaryError('content_type_invalid');
  }

  try {
    return JSON.parse(decodeUtf8(bytes)) as unknown;
  } catch (error) {
    if (error instanceof BrowserResponseBoundaryError) throw error;
    throw new BrowserResponseBoundaryError('json_invalid');
  }
}

export async function readExactArrayBuffer(
  response: Response,
  expectedBytes: number,
) {
  assertExpectedBinaryBytes(expectedBytes);

  const rawLength = response.headers.get('content-length');
  if (rawLength !== null) {
    if (!/^\d+$/.test(rawLength) || Number(rawLength) !== expectedBytes) {
      throw new BrowserResponseBoundaryError('response_size_mismatch');
    }
  }
  return readExactByteStream(response.body, expectedBytes);
}

function assertExpectedBinaryBytes(expectedBytes: number) {
  if (
    !Number.isSafeInteger(expectedBytes)
    || expectedBytes < 1
    || expectedBytes > maximumEvidenceBytes
  ) {
    throw new Error('Browser binary boundary configuration is invalid');
  }
}

async function readExactByteStream(
  stream: ReadableStream<Uint8Array> | null,
  expectedBytes: number,
) {
  if (!stream) {
    throw new BrowserResponseBoundaryError('response_size_mismatch');
  }

  const reader = stream.getReader();
  const bytes = new Uint8Array(expectedBytes);
  let offset = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (result.value.byteLength > expectedBytes - offset) {
        await reader.cancel().catch(() => undefined);
        throw new BrowserResponseBoundaryError('response_size_mismatch');
      }
      bytes.set(result.value, offset);
      offset += result.value.byteLength;
    }
  } catch (error) {
    if (error instanceof BrowserResponseBoundaryError) throw error;
    throw new BrowserResponseBoundaryError('response_unreadable');
  } finally {
    reader.releaseLock();
  }

  if (offset !== expectedBytes) {
    throw new BrowserResponseBoundaryError('response_size_mismatch');
  }
  return bytes.buffer;
}

export async function readExactBlobArrayBuffer(
  blob: Blob,
  expectedBytes = blob.size,
) {
  assertExpectedBinaryBytes(expectedBytes);
  if (blob.size !== expectedBytes) {
    throw new BrowserResponseBoundaryError('response_size_mismatch');
  }

  try {
    return await readExactByteStream(blob.stream(), expectedBytes);
  } catch (error) {
    if (error instanceof BrowserResponseBoundaryError) throw error;
    throw new BrowserResponseBoundaryError('response_unreadable');
  }
}

export async function fetchWithDeadline(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = defaultRequestTimeoutMs,
) {
  if (
    !Number.isSafeInteger(timeoutMs)
    || timeoutMs < 1
    || timeoutMs > maximumConfiguredTimeoutMs
  ) {
    throw new Error('Browser request deadline configuration is invalid');
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  return fetch(input, {
    ...init,
    signal,
  });
}
