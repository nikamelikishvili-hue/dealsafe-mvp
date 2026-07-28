export type EvidenceUploadRole = "seller" | "buyer";

export type EvidenceUploadType =
  | "seller_packing_video"
  | "seller_item_photo"
  | "seller_serial_number"
  | "seller_package_weight"
  | "buyer_unboxing_video"
  | "buyer_received_photo"
  | "buyer_damage_photo"
  | "other";

export type EvidenceMediaKind = "image" | "video";

export type EvidencePolicy = {
  role: EvidenceUploadRole;
  kinds: readonly EvidenceMediaKind[];
};

const mebibyte = 1024 * 1024;

export const evidenceImageMaxBytes = 10 * mebibyte;
export const evidenceVideoMaxBytes = 50 * mebibyte;
export const evidenceUploadIntakeTtlSeconds = 15 * 60;
export const evidenceSignedUrlTtlSeconds = 60;

export const evidenceCanonicalMimeTypes = [
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const evidenceSourceImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const evidenceSourceVideoMimeTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const evidencePolicies: Record<EvidenceUploadType, EvidencePolicy> = {
  seller_packing_video: { role: "seller", kinds: ["video"] },
  seller_item_photo: { role: "seller", kinds: ["image"] },
  seller_serial_number: { role: "seller", kinds: ["image"] },
  seller_package_weight: { role: "seller", kinds: ["image"] },
  buyer_unboxing_video: { role: "buyer", kinds: ["video"] },
  buyer_received_photo: { role: "buyer", kinds: ["image"] },
  buyer_damage_photo: { role: "buyer", kinds: ["image"] },
  other: { role: "buyer", kinds: ["image", "video"] },
};

export type DetectedEvidenceFile = {
  extension: "webp" | "mp4" | "webm" | "mov";
  kind: EvidenceMediaKind;
  mimeType: (typeof evidenceCanonicalMimeTypes)[number];
};

export type EvidenceDeclaration = {
  claimedMimeType: string;
  evidenceType: string;
  fileName: string;
  fileSize: number;
  role: string;
};

export type EvidenceValidation =
  | { ok: true; policy: EvidencePolicy }
  | { ok: false; code: string; message: string };

const safeFileNamePattern = /^[^/\\\u0000-\u001f\u007f]{1,160}$/u;
const webpMetadataChunks = new Set(["EXIF", "XMP ", "ICCP"]);
const allowedWebpChunks = new Set(["VP8 ", "VP8L", "VP8X", "ALPH"]);
const mp4Brands = new Set([
  "avc1",
  "dash",
  "isom",
  "iso2",
  "M4V ",
  "mp41",
  "mp42",
  "qt  ",
]);

function policyFor(role: string, evidenceType: string): EvidencePolicy | null {
  if (role !== "seller" && role !== "buyer") return null;
  const policy = evidencePolicies[evidenceType as EvidenceUploadType];
  return policy?.role === role ? policy : null;
}

export function evidenceInputAccept(role: EvidenceUploadRole, evidenceType: EvidenceUploadType) {
  const policy = policyFor(role, evidenceType);
  if (!policy) return "";
  const accepted = [
    ...(policy.kinds.includes("image") ? evidenceSourceImageMimeTypes : []),
    ...(policy.kinds.includes("video") ? evidenceSourceVideoMimeTypes : []),
  ];
  return accepted.join(",");
}

export function evidenceKindForSource(
  role: EvidenceUploadRole,
  evidenceType: EvidenceUploadType,
) {
  const policy = policyFor(role, evidenceType);
  if (!policy || policy.kinds.length !== 1) return null;
  return policy.kinds[0];
}

export function validateEvidenceDeclaration(
  declaration: EvidenceDeclaration,
): EvidenceValidation {
  const policy = policyFor(declaration.role, declaration.evidenceType);
  if (!policy) {
    return {
      ok: false,
      code: "evidence_type_not_allowed",
      message: "Choose an evidence type available to your role.",
    };
  }
  if (!safeFileNamePattern.test(declaration.fileName.trim())) {
    return {
      ok: false,
      code: "file_name_invalid",
      message: "Rename this file using a short, ordinary file name.",
    };
  }
  if (!Number.isSafeInteger(declaration.fileSize) || declaration.fileSize <= 0) {
    return {
      ok: false,
      code: "file_size_invalid",
      message: "This file is empty or its size could not be verified.",
    };
  }
  const kind = declaration.claimedMimeType === "image/webp"
    ? "image"
    : evidenceSourceVideoMimeTypes.includes(
      declaration.claimedMimeType as (typeof evidenceSourceVideoMimeTypes)[number],
    )
    ? "video"
    : null;
  if (!kind || !policy.kinds.includes(kind)) {
    return {
      ok: false,
      code: "file_type_not_allowed",
      message: policy.kinds.length === 1 && policy.kinds[0] === "image"
        ? "This evidence type requires a photo."
        : policy.kinds.length === 1 && policy.kinds[0] === "video"
        ? "This evidence type requires an MP4, MOV, or WebM video."
        : "Choose a supported photo or video.",
    };
  }
  const maximum = kind === "image" ? evidenceImageMaxBytes : evidenceVideoMaxBytes;
  if (declaration.fileSize > maximum) {
    return {
      ok: false,
      code: "file_too_large",
      message: kind === "image"
        ? "Photos must be 10 MB or smaller after privacy processing."
        : "Videos must be 50 MB or smaller.",
    };
  }
  return { ok: true, policy };
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]) {
  return prefix.every((value, index) => bytes[index] === value);
}

function littleEndianUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]
    | bytes[offset + 1] << 8
    | bytes[offset + 2] << 16
    | bytes[offset + 3] << 24
  ) >>> 0;
}

function bigEndianUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000
    + bytes[offset + 1] * 0x10000
    + bytes[offset + 2] * 0x100
    + bytes[offset + 3]
  ) >>> 0;
}

function validMetadataFreeWebp(bytes: Uint8Array) {
  if (
    bytes.length < 20
    || ascii(bytes, 0, 4) !== "RIFF"
    || ascii(bytes, 8, 4) !== "WEBP"
    || littleEndianUint32(bytes, 4) !== bytes.length - 8
  ) return false;
  let offset = 12;
  let primaryImageChunks = 0;
  while (offset + 8 <= bytes.length) {
    const chunk = ascii(bytes, offset, 4);
    const size = littleEndianUint32(bytes, offset + 4);
    if (
      webpMetadataChunks.has(chunk)
      || chunk === "ANIM"
      || chunk === "ANMF"
      || !allowedWebpChunks.has(chunk)
    ) return false;
    if (chunk === "VP8 " || chunk === "VP8L" || chunk === "VP8X") {
      primaryImageChunks += 1;
    }
    const next = offset + 8 + size + (size % 2);
    if (next <= offset || next > bytes.length) return false;
    offset = next;
  }
  return offset === bytes.length && primaryImageChunks === 1;
}

function validIsoBaseMedia(bytes: Uint8Array) {
  if (
    bytes.length < 24
    || ascii(bytes, 4, 4) !== "ftyp"
    || !mp4Brands.has(ascii(bytes, 8, 4))
  ) return null;
  let offset = 0;
  let hasMediaData = false;
  let hasMovieStructure = false;
  while (offset + 8 <= bytes.length) {
    let size = bigEndianUint32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > bytes.length) return null;
      const high = bigEndianUint32(bytes, offset + 8);
      const low = bigEndianUint32(bytes, offset + 12);
      if (high !== 0) return null;
      size = low;
      headerSize = 16;
    } else if (size === 0) {
      size = bytes.length - offset;
    }
    if (size < headerSize || offset + size > bytes.length) return null;
    if (type === "mdat") hasMediaData = true;
    if (type === "moov" || type === "moof") hasMovieStructure = true;
    offset += size;
  }
  if (offset !== bytes.length || !hasMediaData || !hasMovieStructure) return null;
  return ascii(bytes, 8, 4) === "qt  " ? "quicktime" : "mp4";
}

function hasSequence(bytes: Uint8Array, sequence: readonly number[], limit = bytes.length) {
  const end = Math.min(bytes.length, limit) - sequence.length;
  for (let offset = 0; offset <= end; offset += 1) {
    if (sequence.every((value, index) => bytes[offset + index] === value)) return true;
  }
  return false;
}

export function detectEvidenceFile(bytes: Uint8Array): DetectedEvidenceFile | null {
  if (validMetadataFreeWebp(bytes)) {
    return { extension: "webp", kind: "image", mimeType: "image/webp" };
  }
  const isoType = validIsoBaseMedia(bytes);
  if (isoType) {
    if (isoType === "quicktime") {
      return { extension: "mov", kind: "video", mimeType: "video/quicktime" };
    }
    return { extension: "mp4", kind: "video", mimeType: "video/mp4" };
  }
  if (
    bytes.length >= 16
    && hasPrefix(bytes, [0x1a, 0x45, 0xdf, 0xa3])
    && hasSequence(bytes, [0x18, 0x53, 0x80, 0x67], 4096)
    && hasSequence(bytes, [0x42, 0x82], 4096)
    && new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(4096, bytes.length)))
      .toLowerCase()
      .includes("webm")
  ) {
    return { extension: "webm", kind: "video", mimeType: "video/webm" };
  }
  return null;
}

export function validateEvidenceBytes(
  bytes: Uint8Array,
  declaration: EvidenceDeclaration,
): EvidenceValidation & { detected?: DetectedEvidenceFile } {
  const declarationResult = validateEvidenceDeclaration(declaration);
  if (!declarationResult.ok) return declarationResult;
  if (bytes.byteLength !== declaration.fileSize) {
    return {
      ok: false,
      code: "file_size_mismatch",
      message: "The uploaded file size does not match the approved upload.",
    };
  }
  const detected = detectEvidenceFile(bytes);
  if (!detected) {
    return {
      ok: false,
      code: "file_signature_invalid",
      message: "The file contents do not match a supported photo or video format.",
    };
  }
  if (
    !declarationResult.policy.kinds.includes(detected.kind)
    || detected.mimeType !== declaration.claimedMimeType
  ) {
    return {
      ok: false,
      code: "file_signature_mismatch",
      message: "The file contents do not match its selected evidence type.",
    };
  }
  return { ...declarationResult, detected };
}

export function containsEicarTestPattern(bytes: Uint8Array) {
  const marker = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!";
  const limit = Math.min(bytes.length, 1024 * 1024);
  const text = new TextDecoder("latin1").decode(bytes.subarray(0, limit));
  return text.includes(marker);
}

export function safeEvidenceFileName(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f/\\]+/gu, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return normalized || "evidence-file";
}
