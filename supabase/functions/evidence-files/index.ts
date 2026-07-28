import {
  adminClient,
  handleBrowserRequest,
  json,
  requireUser,
} from "../_shared/common.ts";
import {
  detectEvidenceFile,
  evidenceSignedUrlTtlSeconds,
  evidenceUploadIntakeTtlSeconds,
  safeEvidenceFileName,
  validateEvidenceBytes,
  validateEvidenceDeclaration,
  type EvidenceDeclaration,
  type EvidenceUploadRole,
  type EvidenceUploadType,
} from "../_shared/evidence-policy.ts";
import {
  EvidenceScanError,
  evidenceSha256,
  scanEvidenceBytes,
} from "../_shared/evidence-scan.ts";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EvidenceAction =
  | {
    action: "request-upload";
    claimedMimeType?: string;
    dealId?: string;
    evidenceType?: string;
    fileName?: string;
    fileSize?: number;
    uploaderRole?: string;
  }
  | { action: "finalize-upload"; intakeId?: string }
  | { action: "signed-url"; evidenceId?: string };

type IntakeRecord = {
  id: string;
  deal_id: string;
  user_id: string;
  uploader_role: EvidenceUploadRole;
  evidence_type: EvidenceUploadType;
  storage_path: string;
  original_file_name: string;
  declared_mime_type: string;
  declared_size_bytes: number;
  status:
    | "requested"
    | "processing"
    | "finalized"
    | "rejected"
    | "scan_failed"
    | "expired";
  expires_at: string;
};

type DealAccess = {
  buyer_id: string | null;
  seller_id: string;
  status: string;
};

type IntegrityResult = {
  integrity_status: "verified" | "missing" | "mismatch" | "invalid";
  integrity_checked_at: string;
};

class EvidenceEndpointError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    status = 400,
  ) {
    super(message);
    this.name = "EvidenceEndpointError";
    this.code = code;
    this.status = status;
  }
}

function endpointError(error: unknown) {
  if (error instanceof EvidenceEndpointError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  if (error instanceof EvidenceScanError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  const message = error instanceof Error ? error.message : "";
  if (/session|sign in/i.test(message)) {
    return json({ error: "Your session is invalid or expired.", code: "session_expired" }, 401);
  }
  return json(
    { error: "The secure file service is temporarily unavailable.", code: "evidence_service_error" },
    503,
  );
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "video/mp4") return "mp4";
  throw new EvidenceEndpointError("file_type_not_allowed", "Choose a supported photo or video.");
}

async function dealAccess(dealId: string) {
  const { data, error } = await adminClient()
    .from("deals")
    .select("seller_id,buyer_id,status")
    .eq("id", dealId)
    .maybeSingle();
  if (error || !data) {
    throw new EvidenceEndpointError("deal_not_found", "This deal is unavailable.", 404);
  }
  return data as DealAccess;
}

function requireParticipantRole(
  deal: DealAccess,
  userId: string,
  role: EvidenceUploadRole,
) {
  const authorized = role === "seller"
    ? deal.seller_id === userId
    : deal.buyer_id === userId;
  if (!authorized) {
    throw new EvidenceEndpointError(
      "evidence_access_denied",
      "Only the matching deal participant can add this evidence.",
      403,
    );
  }
  const allowedStatuses = role === "seller"
    ? new Set(["accepted", "disputed"])
    : new Set(["accepted", "completed", "disputed"]);
  if (!allowedStatuses.has(deal.status)) {
    throw new EvidenceEndpointError(
      "evidence_state_invalid",
      "Evidence cannot be added at this stage of the deal.",
      409,
    );
  }
}

async function requestUpload(
  userId: string,
  body: Extract<EvidenceAction, { action: "request-upload" }>,
) {
  const dealId = body.dealId || "";
  if (!uuidPattern.test(dealId)) {
    throw new EvidenceEndpointError("deal_required", "Select a valid deal.");
  }
  const declaration: EvidenceDeclaration = {
    claimedMimeType: body.claimedMimeType || "",
    evidenceType: body.evidenceType || "",
    fileName: body.fileName || "",
    fileSize: body.fileSize || 0,
    role: body.uploaderRole || "",
  };
  const validation = validateEvidenceDeclaration(declaration);
  if (!validation.ok) {
    throw new EvidenceEndpointError(validation.code, validation.message);
  }
  const deal = await dealAccess(dealId);
  requireParticipantRole(
    deal,
    userId,
    declaration.role as EvidenceUploadRole,
  );

  const admin = adminClient();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("evidence_upload_intakes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", tenMinutesAgo);
  if (countError) throw countError;
  if ((count || 0) >= 10) {
    throw new EvidenceEndpointError(
      "upload_rate_limited",
      "Too many files were started. Wait a few minutes and try again.",
      429,
    );
  }

  const intakeId = crypto.randomUUID();
  const extension = extensionForMimeType(declaration.claimedMimeType);
  const path = `${userId}/${dealId}/${intakeId}.${extension}`;
  const expiresAt = new Date(
    Date.now() + evidenceUploadIntakeTtlSeconds * 1000,
  ).toISOString();
  const { error } = await admin.from("evidence_upload_intakes").insert({
    id: intakeId,
    deal_id: dealId,
    user_id: userId,
    uploader_role: declaration.role,
    evidence_type: declaration.evidenceType,
    storage_path: path,
    original_file_name: safeEvidenceFileName(declaration.fileName),
    declared_mime_type: declaration.claimedMimeType,
    declared_size_bytes: declaration.fileSize,
    status: "requested",
    expires_at: expiresAt,
  });
  if (error) throw error;
  return json({
    intakeId,
    path,
    bucket: "deal-evidence-quarantine",
    expiresAt,
  }, 201);
}

async function rejectIntake(
  intake: IntakeRecord,
  status: "rejected" | "scan_failed",
  reasonCode: string,
) {
  const admin = adminClient();
  await admin.from("evidence_upload_intakes").update({
    status,
    rejection_code: reasonCode,
    finalized_at: new Date().toISOString(),
  }).eq("id", intake.id).in("status", ["requested", "processing"]);
  await admin.storage.from("deal-evidence-quarantine").remove([intake.storage_path]);
}

async function finalizeUpload(userId: string, intakeId: string) {
  if (!uuidPattern.test(intakeId)) {
    throw new EvidenceEndpointError("intake_required", "The approved upload was not found.");
  }
  const admin = adminClient();
  const { data, error } = await admin
    .from("evidence_upload_intakes")
    .select("*")
    .eq("id", intakeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    throw new EvidenceEndpointError("intake_not_found", "The approved upload was not found.", 404);
  }
  const intake = data as IntakeRecord;
  if (intake.status !== "requested" || new Date(intake.expires_at).getTime() <= Date.now()) {
    throw new EvidenceEndpointError(
      "intake_expired",
      "This secure upload expired. Choose the file again.",
      410,
    );
  }
  const deal = await dealAccess(intake.deal_id);
  requireParticipantRole(deal, userId, intake.uploader_role);

  const { data: claimed, error: claimError } = await admin
    .from("evidence_upload_intakes")
    .update({ status: "processing" })
    .eq("id", intake.id)
    .eq("user_id", userId)
    .eq("status", "requested")
    .gt("expires_at", new Date().toISOString())
    .select("*")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) {
    throw new EvidenceEndpointError(
      "intake_already_processing",
      "This secure upload is already being reviewed.",
      409,
    );
  }
  const claimedIntake = claimed as IntakeRecord;

  const { data: file, error: downloadError } = await admin.storage
    .from("deal-evidence-quarantine")
    .download(claimedIntake.storage_path);
  if (downloadError || !file) {
    await rejectIntake(claimedIntake, "scan_failed", "upload_incomplete");
    throw new EvidenceEndpointError(
      "upload_incomplete",
      "The file upload did not finish. Choose the file again.",
      409,
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const declaration: EvidenceDeclaration = {
    claimedMimeType: intake.declared_mime_type,
    evidenceType: intake.evidence_type,
    fileName: intake.original_file_name,
    fileSize: intake.declared_size_bytes,
    role: intake.uploader_role,
  };
  const byteValidation = validateEvidenceBytes(bytes, declaration);
  if (!byteValidation.ok || !byteValidation.detected) {
    await rejectIntake(claimedIntake, "rejected", byteValidation.code);
    throw new EvidenceEndpointError(byteValidation.code, byteValidation.message);
  }

  let scan;
  try {
    scan = await scanEvidenceBytes(bytes, {
      fileName: intake.original_file_name,
      mimeType: byteValidation.detected.mimeType,
    });
  } catch (error) {
    const code = error instanceof EvidenceScanError ? error.code : "scanner_unavailable";
    await rejectIntake(claimedIntake, "scan_failed", code);
    throw error;
  }
  if (scan.verdict !== "clean") {
    await rejectIntake(claimedIntake, "rejected", "malware_detected");
    throw new EvidenceEndpointError(
      "malware_detected",
      "This file did not pass the security scan and was not saved.",
      422,
    );
  }

  const finalPath = `${userId}/${intake.deal_id}/${crypto.randomUUID()}.${byteValidation.detected.extension}`;
  const { error: uploadError } = await admin.storage
    .from("deal-evidence")
    .upload(finalPath, bytes, {
      cacheControl: "3600",
      contentType: byteValidation.detected.mimeType,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const now = new Date().toISOString();
  const { data: evidence, error: evidenceError } = await admin
    .from("deal_evidence")
    .insert({
      deal_id: intake.deal_id,
      uploaded_by: userId,
      uploader_role: intake.uploader_role,
      evidence_type: intake.evidence_type,
      storage_path: finalPath,
      file_name: intake.original_file_name,
      mime_type: byteValidation.detected.mimeType,
      detected_mime_type: byteValidation.detected.mimeType,
      file_size_bytes: bytes.byteLength,
      sha256: scan.sha256,
      scan_status: "clean",
      scan_provider: scan.engine,
      scan_reference: scan.scanId,
      scanned_at: now,
      metadata: {
        source: "evidence_files_edge_v1",
        privacy_processed: byteValidation.detected.kind === "image",
      },
    })
    .select(
      "id,deal_id,dispute_id,uploaded_by,uploader_role,evidence_type,file_name,mime_type,detected_mime_type,file_size_bytes,sha256,scan_status,scanned_at,integrity_status,integrity_checked_at,retention_class,retention_until,lifecycle_status,deleted_at,created_at",
    )
    .single();
  if (evidenceError || !evidence) {
    await admin.storage.from("deal-evidence").remove([finalPath]);
    throw evidenceError || new Error("Evidence record was not saved");
  }

  const { data: finalizedIntake, error: intakeError } = await admin
    .from("evidence_upload_intakes")
    .update({
      status: "finalized",
      evidence_id: evidence.id,
      finalized_at: now,
    })
    .eq("id", claimedIntake.id)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();
  if (intakeError || !finalizedIntake) {
    await admin.from("deal_evidence").delete().eq("id", evidence.id);
    await admin.storage.from("deal-evidence").remove([finalPath]);
    throw intakeError || new Error("Evidence intake was not finalized");
  }
  await admin.storage.from("deal-evidence-quarantine").remove([claimedIntake.storage_path]);
  return json({ evidence }, 201);
}

async function userIsCaseReviewer(userId: string, dealId: string) {
  const admin = adminClient();
  const [{ data: profile }, { count }] = await Promise.all([
    admin.from("profiles").select("app_role").eq("id", userId).maybeSingle(),
    admin.from("deal_disputes")
      .select("id", { count: "exact", head: true })
      .eq("deal_id", dealId),
  ]);
  return profile?.app_role === "admin" && (count || 0) > 0;
}

async function recordIntegrityResult(
  evidenceId: string,
  userId: string,
  details: {
    storagePresent: boolean;
    structureValid: boolean;
    observedSha256: string | null;
    observedSizeBytes: number | null;
    observedMimeType: string | null;
  },
) {
  const { data, error } = await adminClient().rpc(
    "record_evidence_integrity_result",
    {
      p_evidence_id: evidenceId,
      p_checked_by: userId,
      p_storage_present: details.storagePresent,
      p_structure_valid: details.structureValid,
      p_observed_sha256: details.observedSha256,
      p_observed_size_bytes: details.observedSizeBytes,
      p_observed_mime_type: details.observedMimeType,
      p_correlation_id: crypto.randomUUID(),
    },
  );
  const result = (Array.isArray(data) ? data[0] : data) as IntegrityResult | null;
  if (error || !result) throw error || new Error("Evidence integrity result was not recorded");
  return result;
}

async function signedUrl(userId: string, evidenceId: string) {
  if (!uuidPattern.test(evidenceId)) {
    throw new EvidenceEndpointError("evidence_required", "The evidence file was not found.");
  }
  const admin = adminClient();
  const { data: evidence, error } = await admin.from("deal_evidence")
    .select(
      "id,deal_id,storage_path,file_name,mime_type,detected_mime_type,file_size_bytes,sha256,scan_status,scanned_at,lifecycle_status,uploader_role,evidence_type,deals(seller_id,buyer_id)",
    )
    .eq("id", evidenceId)
    .maybeSingle();
  const deal = Array.isArray(evidence?.deals) ? evidence?.deals[0] : evidence?.deals;
  if (error || !evidence || !deal) {
    throw new EvidenceEndpointError("evidence_not_found", "The evidence file was not found.", 404);
  }
  if (evidence.scan_status !== "clean") {
    throw new EvidenceEndpointError(
      "evidence_not_cleared",
      "This file is not available until its security review is complete.",
      423,
    );
  }
  if (evidence.lifecycle_status !== "retained") {
    throw new EvidenceEndpointError(
      "evidence_lifecycle_blocked",
      "This file is unavailable while its retention status is under review.",
      423,
    );
  }
  const participant = deal.seller_id === userId || deal.buyer_id === userId;
  const caseReviewer = participant ? false : await userIsCaseReviewer(userId, evidence.deal_id);
  if (!participant && !caseReviewer) {
    throw new EvidenceEndpointError(
      "evidence_access_denied",
      "You do not have access to this evidence file.",
      403,
    );
  }

  const { data: file, error: downloadError } = await admin.storage
    .from("deal-evidence")
    .download(evidence.storage_path);
  if (downloadError || !file) {
    await recordIntegrityResult(evidence.id, userId, {
      storagePresent: false,
      structureValid: false,
      observedSha256: null,
      observedSizeBytes: null,
      observedMimeType: null,
    });
    throw new EvidenceEndpointError(
      "evidence_integrity_failed",
      "This file could not be verified and was not opened.",
      423,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectEvidenceFile(bytes);
  const declaration: EvidenceDeclaration = {
    claimedMimeType: evidence.detected_mime_type || evidence.mime_type || "",
    evidenceType: evidence.evidence_type || "",
    fileName: evidence.file_name || "evidence-file",
    fileSize: Number(evidence.file_size_bytes || 0),
    role: evidence.uploader_role || "",
  };
  const byteValidation = validateEvidenceBytes(bytes, declaration);
  const observedSha256 = await evidenceSha256(bytes);
  const integrity = await recordIntegrityResult(evidence.id, userId, {
    storagePresent: true,
    structureValid: byteValidation.ok,
    observedSha256,
    observedSizeBytes: bytes.byteLength,
    observedMimeType: detected?.mimeType || null,
  });
  if (integrity.integrity_status !== "verified") {
    throw new EvidenceEndpointError(
      "evidence_integrity_failed",
      "This file could not be verified and was not opened.",
      423,
    );
  }

  const { data: signed, error: signedError } = await admin.storage
    .from("deal-evidence")
    .createSignedUrl(evidence.storage_path, evidenceSignedUrlTtlSeconds);
  if (signedError || !signed?.signedUrl) throw signedError || new Error("Signed URL unavailable");
  const expiresAt = new Date(Date.now() + evidenceSignedUrlTtlSeconds * 1000).toISOString();
  const { error: accessError } = await admin.from("evidence_file_access_events").insert({
    evidence_id: evidence.id,
    deal_id: evidence.deal_id,
    accessed_by: userId,
    access_reason: participant ? "participant" : "dispute_case",
    signed_url_expires_at: expiresAt,
  });
  if (accessError) throw accessError;
  return json({
    url: signed.signedUrl,
    expiresAt,
    mimeType: detected?.mimeType || evidence.detected_mime_type,
    fileName: evidence.file_name,
    fileSizeBytes: bytes.byteLength,
    sha256: observedSha256,
    scanStatus: evidence.scan_status,
    scannedAt: evidence.scanned_at,
    integrityStatus: integrity.integrity_status,
    integrityCheckedAt: integrity.integrity_checked_at,
  });
}

Deno.serve((request) =>
  handleBrowserRequest(request, async () => {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    try {
      if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
        throw new EvidenceEndpointError(
          "content_type_invalid",
          "The secure file request is invalid.",
          415,
        );
      }
      const user = await requireUser(request);
      const body = await request.json() as EvidenceAction;
      if (body.action === "request-upload") return await requestUpload(user.id, body);
      if (body.action === "finalize-upload") {
        return await finalizeUpload(user.id, body.intakeId || "");
      }
      if (body.action === "signed-url") {
        return await signedUrl(user.id, body.evidenceId || "");
      }
      throw new EvidenceEndpointError("action_invalid", "The secure file request is invalid.");
    } catch (error) {
      return endpointError(error);
    }
  })
);
