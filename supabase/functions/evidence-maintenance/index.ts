import {
  adminClient,
  handleBrowserRequest,
  json,
  requireUser,
} from "../_shared/common.ts";
import {
  detectEvidenceFile,
  validateEvidenceBytes,
  type EvidenceDeclaration,
} from "../_shared/evidence-policy.ts";
import { evidenceSha256 } from "../_shared/evidence-scan.ts";

type MaintenanceJob = {
  job_id: string;
  lease_token: string;
  job_type: "integrity_check" | "quarantine_cleanup" | "evidence_delete";
  evidence_id: string | null;
  intake_id: string | null;
  bucket_name: "deal-evidence" | "deal-evidence-quarantine";
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  detected_mime_type: string | null;
  file_size_bytes: number | null;
  sha256: string | null;
  uploader_role: string | null;
  evidence_type: string | null;
};

type IntegrityResult = {
  integrity_status: "verified" | "missing" | "mismatch" | "invalid";
  integrity_checked_at: string;
};

type AdminAction =
  | { action: "snapshot" }
  | { action: "refresh-inventory" }
  | { action: "approve-deletion"; evidenceId?: string; reason?: string }
  | {
    action: "place-legal-hold";
    evidenceId?: string;
    reason?: string;
  }
  | {
    action: "release-legal-hold";
    evidenceId?: string;
    holdKey?: string;
    reason?: string;
  }
  | { action: "acknowledge-alert"; alertId?: string };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maintenanceHeader = "x-dealivra-maintenance-secret";

class MaintenanceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function maintenanceErrorResponse(error: unknown) {
  if (error instanceof MaintenanceError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  return json({
    error: "Evidence maintenance could not complete safely.",
    code: "maintenance_failed",
  }, 500);
}

function boundedReason(value: unknown) {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < 10 || reason.length > 1000) {
    throw new MaintenanceError(
      "reason_invalid",
      "Record a reason between 10 and 1,000 characters.",
    );
  }
  return reason;
}

function requiredUuid(value: unknown, code: string, message: string) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new MaintenanceError(code, message);
  }
  return value;
}

async function requireOperator(userId: string) {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("app_role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || !["admin", "compliance"].includes(data.app_role)) {
    throw new MaintenanceError(
      "operator_access_denied",
      "Evidence lifecycle access is restricted.",
      403,
    );
  }
}

async function adminSnapshot(userId: string) {
  const { data, error } = await adminClient().rpc(
    "get_evidence_lifecycle_admin_snapshot",
    { p_actor_id: userId },
  );
  if (error || !data) throw error || new Error("Lifecycle snapshot unavailable");
  return json(data);
}

async function handleAdminAction(
  userId: string,
  body: AdminAction,
) {
  await requireOperator(userId);
  const admin = adminClient();

  if (body.action === "snapshot") return await adminSnapshot(userId);

  if (body.action === "refresh-inventory") {
    const { data, error } = await admin.rpc(
      "refresh_evidence_lifecycle_inventory",
    );
    if (error) throw error;
    return json({ inventory: data });
  }

  if (body.action === "approve-deletion") {
    const evidenceId = requiredUuid(
      body.evidenceId,
      "evidence_required",
      "Choose an evidence record to review.",
    );
    const { data, error } = await admin.rpc("approve_evidence_deletion", {
      p_evidence_id: evidenceId,
      p_actor_id: userId,
      p_reason: boundedReason(body.reason),
      p_correlation_id: crypto.randomUUID(),
    });
    if (error || !data) throw error || new Error("Deletion approval failed");
    return json({ jobId: data });
  }

  if (body.action === "place-legal-hold") {
    const evidenceId = requiredUuid(
      body.evidenceId,
      "evidence_required",
      "Choose an evidence record for the legal hold.",
    );
    const { data, error } = await admin.rpc(
      "record_evidence_legal_hold_event",
      {
        p_evidence_id: evidenceId,
        p_actor_id: userId,
        p_action: "placed",
        p_reason: boundedReason(body.reason),
        p_hold_key: null,
        p_correlation_id: crypto.randomUUID(),
      },
    );
    if (error || !data) throw error || new Error("Legal hold was not recorded");
    return json({ holdKey: data });
  }

  if (body.action === "release-legal-hold") {
    const evidenceId = requiredUuid(
      body.evidenceId,
      "evidence_required",
      "Choose an evidence record for the legal hold release.",
    );
    const holdKey = requiredUuid(
      body.holdKey,
      "hold_required",
      "The active legal hold was not found.",
    );
    const { data, error } = await admin.rpc(
      "record_evidence_legal_hold_event",
      {
        p_evidence_id: evidenceId,
        p_actor_id: userId,
        p_action: "released",
        p_reason: boundedReason(body.reason),
        p_hold_key: holdKey,
        p_correlation_id: crypto.randomUUID(),
      },
    );
    if (error || !data) {
      throw error || new Error("Legal hold release was not recorded");
    }
    return json({ holdKey: data });
  }

  if (body.action === "acknowledge-alert") {
    const alertId = requiredUuid(
      body.alertId,
      "alert_required",
      "Choose an alert to acknowledge.",
    );
    const { error } = await admin.rpc(
      "acknowledge_evidence_lifecycle_alert",
      {
        p_alert_id: alertId,
        p_actor_id: userId,
        p_correlation_id: crypto.randomUUID(),
      },
    );
    if (error) throw error;
    return json({ acknowledged: true });
  }

  throw new MaintenanceError(
    "action_invalid",
    "The evidence lifecycle request is invalid.",
  );
}

async function recordIntegrity(
  job: MaintenanceJob,
  secret: string,
) {
  if (!job.evidence_id) throw new Error("Integrity job has no evidence record");
  const admin = adminClient();
  const { data: file, error: downloadError } = await admin.storage
    .from(job.bucket_name)
    .download(job.storage_path);

  let storagePresent = false;
  let structureValid = false;
  let observedSha256: string | null = null;
  let observedSizeBytes: number | null = null;
  let observedMimeType: string | null = null;

  if (!downloadError && file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectEvidenceFile(bytes);
    const declaration: EvidenceDeclaration = {
      claimedMimeType: job.detected_mime_type || job.mime_type || "",
      evidenceType: job.evidence_type || "",
      fileName: job.file_name || "evidence-file",
      fileSize: Number(job.file_size_bytes || 0),
      role: job.uploader_role || "",
    };
    const validation = validateEvidenceBytes(bytes, declaration);
    storagePresent = true;
    structureValid = validation.ok;
    observedSha256 = await evidenceSha256(bytes);
    observedSizeBytes = bytes.byteLength;
    observedMimeType = detected?.mimeType || null;
  }

  const { data, error } = await admin.rpc(
    "record_evidence_integrity_result",
    {
      p_evidence_id: job.evidence_id,
      p_checked_by: null,
      p_storage_present: storagePresent,
      p_structure_valid: structureValid,
      p_observed_sha256: observedSha256,
      p_observed_size_bytes: observedSizeBytes,
      p_observed_mime_type: observedMimeType,
      p_correlation_id: crypto.randomUUID(),
    },
  );
  const result = (Array.isArray(data) ? data[0] : data) as IntegrityResult | null;
  if (error || !result) throw error || new Error("Integrity result was not saved");

  const outcome = result.integrity_status === "verified"
    ? "integrity_completed"
    : "integrity_failed";
  const completion = await admin.rpc("complete_evidence_maintenance_job", {
    p_maintenance_secret: secret,
    p_job_id: job.job_id,
    p_lease_token: job.lease_token,
    p_outcome: outcome,
    p_error_code: result.integrity_status === "verified"
      ? null
      : `integrity_${result.integrity_status}`,
    p_details: {
      integrityStatus: result.integrity_status,
      integrityCheckedAt: result.integrity_checked_at,
    },
  });
  if (completion.error) throw completion.error;
  return result.integrity_status === "verified";
}

async function removeAndVerify(job: MaintenanceJob, secret: string) {
  const admin = adminClient();
  const { error: removeError } = await admin.storage
    .from(job.bucket_name)
    .remove([job.storage_path]);
  if (removeError) throw removeError;

  const { data: remaining, error: verificationError } = await admin.storage
    .from(job.bucket_name)
    .download(job.storage_path);
  if (remaining || !verificationError) {
    throw new Error("Storage object still exists after delete");
  }

  const outcome = job.job_type === "evidence_delete"
    ? "evidence_deleted"
    : "quarantine_deleted";
  const { error } = await admin.rpc("complete_evidence_maintenance_job", {
    p_maintenance_secret: secret,
    p_job_id: job.job_id,
    p_lease_token: job.lease_token,
    p_outcome: outcome,
    p_error_code: null,
    p_details: {
      bucket: job.bucket_name,
      absenceVerified: true,
      verifiedAt: new Date().toISOString(),
    },
  });
  if (error) throw error;
}

function safeFailureCode(job: MaintenanceJob) {
  if (job.job_type === "integrity_check") return "integrity_worker_failed";
  if (job.job_type === "quarantine_cleanup") {
    return "quarantine_delete_failed";
  }
  return "evidence_delete_failed";
}

async function failJob(
  job: MaintenanceJob,
  secret: string,
) {
  await adminClient().rpc("complete_evidence_maintenance_job", {
    p_maintenance_secret: secret,
    p_job_id: job.job_id,
    p_lease_token: job.lease_token,
    p_outcome: "failed",
    p_error_code: safeFailureCode(job),
    p_details: { retryable: true },
  });
}

async function runScheduled(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const contentType = request.headers.get("Content-Type")?.toLowerCase() || "";
  if (!contentType.startsWith("application/json")) {
    return json({ error: "Unsupported content type" }, 415);
  }

  const secret = request.headers.get(maintenanceHeader)?.trim() || "";
  const body = await request.json().catch(() => ({})) as {
    action?: string;
    limit?: number;
  };
  if (body.action !== "run") {
    throw new MaintenanceError(
      "action_invalid",
      "The scheduled maintenance request is invalid.",
    );
  }
  const limit = Number.isInteger(body.limit)
    ? Math.max(1, Math.min(25, Number(body.limit)))
    : 20;
  const workerId = crypto.randomUUID();
  const { data, error } = await adminClient().rpc(
    "claim_evidence_maintenance_jobs",
    {
      p_maintenance_secret: secret,
      p_limit: limit,
      p_worker_id: workerId,
    },
  );
  if (error) {
    throw new MaintenanceError(
      "maintenance_auth_failed",
      "Scheduled evidence maintenance was not authorized.",
      403,
    );
  }

  const jobs = (data || []) as MaintenanceJob[];
  let succeeded = 0;
  let failed = 0;
  let integrityBlocked = 0;

  for (const job of jobs) {
    try {
      if (job.job_type === "integrity_check") {
        if (!await recordIntegrity(job, secret)) integrityBlocked += 1;
      } else {
        await removeAndVerify(job, secret);
      }
      succeeded += 1;
    } catch {
      failed += 1;
      await failJob(job, secret).catch(() => {});
    }
  }

  return json({
    workerId,
    claimed: jobs.length,
    succeeded,
    failed,
    integrityBlocked,
  });
}

Deno.serve((request) => {
  const scheduledSecret = request.headers.get(maintenanceHeader)?.trim();
  if (scheduledSecret) {
    return runScheduled(request).catch(maintenanceErrorResponse);
  }

  return handleBrowserRequest(request, async () => {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    try {
      if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
        throw new MaintenanceError(
          "content_type_invalid",
          "The evidence lifecycle request is invalid.",
          415,
        );
      }
      const user = await requireUser(request);
      const body = await request.json() as AdminAction;
      return await handleAdminAction(user.id, body);
    } catch (error) {
      return maintenanceErrorResponse(error);
    }
  });
});
