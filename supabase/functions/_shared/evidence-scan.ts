import { containsEicarTestPattern } from "./evidence-policy.ts";

export type EvidenceScanVerdict = {
  engine: string;
  scanId: string;
  sha256: string;
  verdict: "clean" | "malicious";
};

export class EvidenceScanError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    status = 503,
  ) {
    super(message);
    this.name = "EvidenceScanError";
    this.code = code;
    this.status = status;
  }
}

const sha256Pattern = /^[0-9a-f]{64}$/;
const scannerReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export async function evidenceSha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function configuredScannerUrl() {
  const raw = Deno.env.get("DEALIVRA_MALWARE_SCANNER_URL")?.trim() || "";
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || parsed.hash
      || parsed.origin === "https://dealivra.com"
      || parsed.origin === "https://www.dealivra.com"
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

async function boundedJson(response: Response) {
  const declaredLength = Number(response.headers.get("Content-Length") || "0");
  if (declaredLength > 16_384) {
    throw new EvidenceScanError(
      "scanner_response_invalid",
      "The security scanner returned an invalid response.",
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 16_384) {
    throw new EvidenceScanError(
      "scanner_response_invalid",
      "The security scanner returned an invalid response.",
    );
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    throw new EvidenceScanError(
      "scanner_response_invalid",
      "The security scanner returned an invalid response.",
    );
  }
}

export function validateScannerVerdict(
  value: Record<string, unknown>,
  expectedSha256: string,
): EvidenceScanVerdict {
  const verdict = value.verdict;
  const sha256 = typeof value.sha256 === "string" ? value.sha256.toLowerCase() : "";
  const scanId = typeof value.scanId === "string" ? value.scanId : "";
  const engine = typeof value.engine === "string" ? value.engine : "";
  if (
    (verdict !== "clean" && verdict !== "malicious")
    || !sha256Pattern.test(sha256)
    || sha256 !== expectedSha256
    || !scannerReferencePattern.test(scanId)
    || !scannerReferencePattern.test(engine)
  ) {
    throw new EvidenceScanError(
      "scanner_response_invalid",
      "The security scanner returned an invalid response.",
    );
  }
  return { verdict, sha256, scanId, engine };
}

export async function scanEvidenceBytes(
  bytes: Uint8Array,
  details: { fileName: string; mimeType: string },
) {
  const sha256 = await evidenceSha256(bytes);
  if (containsEicarTestPattern(bytes)) {
    return {
      verdict: "malicious",
      sha256,
      scanId: "local-eicar-precheck",
      engine: "dealivra-precheck",
    } satisfies EvidenceScanVerdict;
  }

  const scannerUrl = configuredScannerUrl();
  const scannerToken = Deno.env.get("DEALIVRA_MALWARE_SCANNER_TOKEN")?.trim() || "";
  if (!scannerUrl || scannerToken.length < 24) {
    throw new EvidenceScanError(
      "scanner_unavailable",
      "Secure file scanning is temporarily unavailable. Please try again later.",
    );
  }

  let response: Response;
  try {
    response = await fetch(scannerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${scannerToken}`,
        "Content-Type": "application/octet-stream",
        "X-Content-SHA256": sha256,
        "X-Detected-Mime-Type": details.mimeType,
        "X-File-Name": encodeURIComponent(details.fileName).slice(0, 512),
      },
      body: bytes,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new EvidenceScanError(
      "scanner_unavailable",
      "Secure file scanning is temporarily unavailable. Please try again later.",
    );
  }
  if (!response.ok) {
    throw new EvidenceScanError(
      "scanner_unavailable",
      "Secure file scanning is temporarily unavailable. Please try again later.",
    );
  }
  return validateScannerVerdict(await boundedJson(response), sha256);
}
