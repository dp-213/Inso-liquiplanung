/**
 * Email-Versand via Resend mit Feature-Flag und Structured Logging.
 *
 * - EMAIL_ENABLED=true → Emails werden gesendet (Production)
 * - EMAIL_ENABLED fehlt oder false → Emails werden geloggt aber nicht gesendet
 */

import { Resend } from "resend";

const FROM = "Gradify Cases <noreply@updates.gradify.de>";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  context: {
    event: string;
    caseId: string;
    orderIds?: string[];
  };
}

export async function sendEmail(opts: SendEmailOpts): Promise<void> {
  const logPayload = {
    ...opts.context,
    recipient: opts.to,
    subject: opts.subject,
  };

  if (process.env.EMAIL_ENABLED !== "true") {
    console.log("[Email] SKIPPED (disabled)", JSON.stringify(logPayload));
    return;
  }

  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    console.log("[Email] SENT", JSON.stringify(logPayload));
  } catch (error) {
    console.error(
      "[Email] FAILED",
      JSON.stringify({ ...logPayload, error: String(error) })
    );
  }
}
