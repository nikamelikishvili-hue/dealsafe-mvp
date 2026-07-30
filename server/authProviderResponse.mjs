import {
  readBoundedResponseText,
  ResponseBodyBoundaryError,
} from './responseBodyBoundary.mjs';

const defaultMaximumBytes = 262_144;
const jsonContentTypePattern = /^application\/json(?:\s*;.*)?$/i;

export class AuthProviderResponseBoundaryError extends Error {
  constructor(code) {
    super('Authentication provider response was rejected.');
    this.name = 'AuthProviderResponseBoundaryError';
    this.code = code;
  }
}

function reject(code) {
  throw new AuthProviderResponseBoundaryError(code);
}

export async function readBoundedAuthProviderJson(
  response,
  {
    allowEmpty = false,
    maximumBytes = defaultMaximumBytes,
  } = {},
) {
  if (
    !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 1_024
    || maximumBytes > defaultMaximumBytes
  ) {
    throw new Error('Authentication provider response boundary configuration is invalid.');
  }
  if (!(response instanceof Response)) reject('response_invalid');

  let text;
  try {
    text = await readBoundedResponseText(response, maximumBytes);
  } catch (error) {
    if (error instanceof ResponseBodyBoundaryError) reject(error.code);
    throw error;
  }
  const actualBytes = new TextEncoder().encode(text).byteLength;
  if (actualBytes === 0) {
    if (allowEmpty) return null;
    reject('response_empty');
  }
  if (actualBytes > maximumBytes) reject('response_too_large');

  const contentType = response.headers.get('content-type')?.trim() || '';
  if (!jsonContentTypePattern.test(contentType)) reject('content_type_invalid');

  try {
    return JSON.parse(text);
  } catch {
    reject('json_invalid');
  }
}
