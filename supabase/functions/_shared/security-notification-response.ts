import {
  readBoundedResponseText,
  ResponseBodyBoundaryError,
} from "./response-body-boundary.ts";

const maximumProviderBytes = 16_384;
const jsonContentTypePattern = /^application\/json(?:\s*;.*)?$/i;

export async function readSecurityNotificationProviderJson(
  response: Response,
) {
  const contentType = response.headers.get("content-type")?.trim() || "";
  if (!jsonContentTypePattern.test(contentType)) return null;

  let text: string;
  try {
    text = await readBoundedResponseText(response, maximumProviderBytes);
  } catch (error) {
    if (error instanceof ResponseBodyBoundaryError) return null;
    throw error;
  }
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
