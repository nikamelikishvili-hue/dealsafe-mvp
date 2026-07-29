const caseReferencePattern = /^[A-Z0-9][A-Z0-9._/-]{7,63}$/;
const supportedTemplates = new Set([
  "privileged_mfa_recovery_opened",
  "privileged_mfa_recovery_identity_verified",
  "privileged_mfa_recovery_approved",
  "privileged_mfa_recovery_rejected",
  "privileged_mfa_recovery_completed",
]);

type SecurityNotificationContent = {
  subject: string;
  text: string;
  html: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeCaseReference(payload: unknown) {
  const value = record(payload).case_reference;
  if (typeof value !== "string" || !caseReferencePattern.test(value)) {
    throw new Error("security_notification_payload_invalid");
  }
  return value;
}

function safeCooldown(payload: unknown) {
  const value = record(payload).cooldown_until;
  if (typeof value !== "string" || value.length > 40) {
    throw new Error("security_notification_payload_invalid");
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error("security_notification_payload_invalid");
  }
  return new Date(timestamp).toISOString();
}

export function renderSecurityNotification(
  templateKey: string,
  payload: unknown,
): SecurityNotificationContent {
  if (!supportedTemplates.has(templateKey)) {
    throw new Error("security_notification_template_invalid");
  }

  const caseReference = safeCaseReference(payload);
  let subject: string;
  let heading: string;
  let message: string;

  switch (templateKey) {
    case "privileged_mfa_recovery_opened":
      subject = "Security notice: account recovery opened";
      heading = "An account recovery case was opened";
      message = "Dealivra opened a controlled recovery review for your privileged account.";
      break;
    case "privileged_mfa_recovery_identity_verified":
      subject = "Security notice: identity review recorded";
      heading = "Identity review was recorded";
      message = "An authorized operator recorded the required identity re-verification step.";
      break;
    case "privileged_mfa_recovery_approved":
      subject = "Security notice: account recovery approved";
      heading = "Account recovery was approved";
      message = "A separate authorized reviewer approved the recovery case.";
      break;
    case "privileged_mfa_recovery_rejected":
      subject = "Security notice: account recovery rejected";
      heading = "Account recovery was rejected";
      message = "A separate authorized reviewer rejected the recovery case.";
      break;
    default: {
      const cooldownUntil = safeCooldown(payload);
      subject = "Security notice: account recovery completed";
      heading = "Account recovery was completed";
      message = `Existing sessions and authenticators were revoked. MFA, email, and payout changes are locked until ${cooldownUntil}.`;
    }
  }

  const instruction = "If you did not expect this activity, sign in through dealivra.com and contact Dealivra using the official support path.";
  const text = [
    heading,
    "",
    message,
    `Case reference: ${caseReference}`,
    "",
    instruction,
    "",
    "Dealivra will never ask for your password, authenticator code, recovery code, or API key by email.",
  ].join("\n");
  const html = [
    '<!doctype html><html><body style="margin:0;background:#f4f7fb;color:#0f1d33;font-family:Arial,sans-serif">',
    '<div style="max-width:600px;margin:0 auto;padding:32px 20px">',
    '<div style="background:#ffffff;border:1px solid #dbe4ef;border-radius:16px;padding:28px">',
    '<p style="margin:0 0 12px;color:#087f73;font-size:13px;font-weight:700;letter-spacing:.08em">DEALIVRA SECURITY</p>',
    `<h1 style="margin:0 0 18px;font-size:24px;line-height:1.3">${escapeHtml(heading)}</h1>`,
    `<p style="margin:0 0 14px;line-height:1.6">${escapeHtml(message)}</p>`,
    `<p style="margin:0 0 20px;line-height:1.6"><strong>Case reference:</strong> ${escapeHtml(caseReference)}</p>`,
    `<p style="margin:0 0 14px;line-height:1.6">${escapeHtml(instruction)}</p>`,
    '<p style="margin:0;color:#53657d;font-size:13px;line-height:1.6">Dealivra will never ask for your password, authenticator code, recovery code, or API key by email.</p>',
    "</div></div></body></html>",
  ].join("");

  return { subject, text, html };
}
