import { adminClient, json, requiredSecret } from "../_shared/common.ts";
import { renderSecurityNotification } from "../_shared/security-notification.ts";

type NotificationJob = {
  notification_id: string;
  target_user_id: string;
  template_key: string;
  payload: unknown;
};

type DeliveryHealth = {
  ready: number;
  retrying: number;
  deadLetter: number;
  oldestPendingMinutes: number;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const senderPattern = /^[^<>\r\n]{1,80} <[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}>$/;

function notificationMode() {
  const mode = (Deno.env.get("DEALIVRA_SECURITY_NOTIFICATION_MODE") || "staged")
    .trim()
    .toLowerCase();
  if (mode !== "staged" && mode !== "enforced") {
    throw new Error("security_notification_mode_invalid");
  }
  return mode;
}

async function secretsMatch(candidate: string, expected: string) {
  if (candidate.length > 512 || expected.length < 32) return false;
  const encoder = new TextEncoder();
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(candidateHash);
  const right = new Uint8Array(expectedHash);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left[index] || 0) ^ (right[index] || 0);
  }
  return difference === 0;
}

async function authorizeWorker(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  const candidate = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  const expected = requiredSecret("DEALIVRA_SECURITY_NOTIFICATION_WORKER_SECRET");
  if (!candidate || !(await secretsMatch(candidate, expected))) {
    throw new Error("security_notification_worker_unauthorized");
  }
}

async function readBoundedJson(response: Response, maximumBytes = 16_384) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error("security_notification_provider_invalid");
  }
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maximumBytes) {
      await reader.cancel();
      throw new Error("security_notification_provider_invalid");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

async function completeDelivery(
  notificationId: string,
  deliveryReference: string,
  failureCode: string | null,
) {
  const { error } = await adminClient().rpc(
    "complete_security_notification_delivery",
    {
      p_notification_id: notificationId,
      p_delivery_reference: deliveryReference,
      p_failure_code: failureCode,
    },
  );
  if (error) throw new Error("security_notification_completion_failed");
}

async function markFailure(notificationId: string, code: string) {
  await completeDelivery(
    notificationId,
    `worker-attempt:${notificationId}`,
    code,
  );
}

function safeCount(value: unknown) {
  return typeof value === "number"
      && Number.isSafeInteger(value)
      && value >= 0
      && value <= 2_147_483_647
    ? value
    : null;
}

async function readDeliveryHealth(): Promise<DeliveryHealth> {
  const { data, error } = await adminClient().rpc(
    "get_security_notification_delivery_health_for_service",
  );
  const row = Array.isArray(data) ? data[0] : null;
  const ready = safeCount(row?.ready_count);
  const retrying = safeCount(row?.retrying_count);
  const deadLetter = safeCount(row?.dead_letter_count);
  const oldestPendingMinutes = safeCount(row?.oldest_pending_age_minutes);
  if (
    error
    || ready === null
    || retrying === null
    || deadLetter === null
    || oldestPendingMinutes === null
  ) {
    throw new Error("security_notification_health_failed");
  }
  return { ready, retrying, deadLetter, oldestPendingMinutes };
}

async function deliver(job: NotificationJob) {
  if (
    !uuidPattern.test(job.notification_id)
    || !uuidPattern.test(job.target_user_id)
    || typeof job.template_key !== "string"
  ) {
    throw new Error("security_notification_job_invalid");
  }

  const admin = adminClient();
  const { data, error } = await admin.auth.admin.getUserById(job.target_user_id);
  const email = data?.user?.email;
  if (
    error
    || !email
    || !data.user.email_confirmed_at
    || email.length > 254
    || /[\r\n]/.test(email)
  ) {
    await markFailure(job.notification_id, "verified_recipient_unavailable");
    return false;
  }

  let content;
  try {
    content = renderSecurityNotification(job.template_key, job.payload);
  } catch {
    await markFailure(job.notification_id, "template_payload_invalid");
    return false;
  }

  const sender = requiredSecret("DEALIVRA_SECURITY_NOTIFICATION_FROM").trim();
  if (!senderPattern.test(sender)) {
    throw new Error("security_notification_sender_invalid");
  }
  const apiKey = requiredSecret("RESEND_API_KEY").trim();
  if (!/^re_[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
    throw new Error("security_notification_provider_invalid");
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `dealivra_security_${job.notification_id}`,
      },
      body: JSON.stringify({
        from: sender,
        to: [email],
        subject: content.subject,
        text: content.text,
        html: content.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    await markFailure(job.notification_id, "provider_unavailable");
    return false;
  }

  const provider = await readBoundedJson(response);
  if (
    !response.ok
    || !provider
    || typeof provider.id !== "string"
    || !uuidPattern.test(provider.id)
  ) {
    await markFailure(
      job.notification_id,
      response.status === 429 || response.status >= 500
        ? "provider_unavailable"
        : "provider_rejected",
    );
    return false;
  }

  await completeDelivery(job.notification_id, `resend:${provider.id}`, null);
  return true;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    await authorizeWorker(request);
    if (notificationMode() !== "enforced") {
      return json({ error: "Security notification delivery is staged." }, 503);
    }

    const admin = adminClient();
    const { data, error } = await admin.rpc(
      "claim_security_notification_delivery_batch",
      { p_limit: 10 },
    );
    if (error || !Array.isArray(data) || data.length > 10) {
      throw new Error("security_notification_claim_failed");
    }

    let sent = 0;
    let failed = 0;
    for (const job of data as NotificationJob[]) {
      try {
        if (await deliver(job)) sent += 1;
        else failed += 1;
      } catch {
        if (uuidPattern.test(job?.notification_id || "")) {
          await markFailure(job.notification_id, "worker_unavailable").catch(() => {});
        }
        failed += 1;
      }
    }

    const queue = await readDeliveryHealth();
    const attentionRequired = queue.deadLetter > 0;
    if (attentionRequired) {
      console.error(JSON.stringify({
        schema: "dealivra.security.notification.v1",
        event: "queue_attention_required",
        code: "dead_letter_present",
        ready_count: queue.ready,
        retrying_count: queue.retrying,
        dead_letter_count: queue.deadLetter,
        oldest_pending_age_minutes: queue.oldestPendingMinutes,
      }));
    }

    return json({
      processed: data.length,
      sent,
      failed,
      queue: {
        ready: queue.ready,
        retrying: queue.retrying,
        dead_letter: queue.deadLetter,
        oldest_pending_minutes: queue.oldestPendingMinutes,
      },
      attention_required: attentionRequired,
    });
  } catch (error) {
    const unauthorized = error instanceof Error
      && error.message === "security_notification_worker_unauthorized";
    console.error(JSON.stringify({
      schema: "dealivra.security.notification.v1",
      event: "worker_failed",
      code: unauthorized ? "worker_unauthorized" : "worker_unavailable",
    }));
    return json(
      { error: unauthorized ? "Unauthorized" : "Security notification delivery is unavailable." },
      unauthorized ? 401 : 503,
    );
  }
});
