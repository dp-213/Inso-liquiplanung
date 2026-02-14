/**
 * HTML-Email-Templates für Freigabe-Benachrichtigungen.
 * Inline-CSS für maximale Email-Client-Kompatibilität.
 */

function formatEuro(cents: bigint | number): string {
  const num = typeof cents === "bigint" ? Number(cents) : cents;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(Math.abs(num) / 100);
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
<tr><td style="padding:24px 32px 16px;border-bottom:1px solid #e5e7eb;">
  <span style="font-size:18px;font-weight:700;color:#111827;">${title}</span>
</td></tr>
<tr><td style="padding:24px 32px;">
  ${body}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
  <span style="font-size:12px;color:#9ca3af;">Gradify Cases &ndash; Insolvenz-Liquiditätsplanung</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function linkButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:16px;padding:10px 24px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">${label}</a>`;
}

// ─── Templates ─────────────────────────────────────────────────────────────

/**
 * Neue Einreichung → an Approver / Case-Owner
 */
export function newOrderEmail(
  caseName: string,
  order: { creditor: string; amountCents: bigint; description: string; type: string },
  portalUrl: string,
): { subject: string; html: string } {
  const typeLabel = order.type === "BESTELLUNG" ? "Bestellanfrage" : "Zahlungsanfrage";
  return {
    subject: `${caseName} – Neue ${typeLabel} (${formatEuro(order.amountCents)})`,
    html: layout(`Neue ${typeLabel}`, `
      <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6;">
        Eine neue ${typeLabel} wurde eingereicht und wartet auf Ihre Freigabe.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px;">Gläubiger</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${order.creditor}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Betrag</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${formatEuro(order.amountCents)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Beschreibung</td><td style="padding:8px 0;color:#111827;font-size:14px;">${order.description}</td></tr>
      </table>
      ${linkButton(portalUrl, "Im Portal ansehen")}
    `),
  };
}

/**
 * Chain-Modus: Nächste Stufe → an nächsten Approver
 */
export function chainNextStepEmail(
  caseName: string,
  order: { creditor: string; amountCents: bigint },
  step: { roleName: string; sequence: number; totalSteps: number },
  portalUrl: string,
): { subject: string; html: string } {
  return {
    subject: `${caseName} – Freigabe wartet auf Sie`,
    html: layout("Freigabe wartet auf Sie", `
      <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6;">
        Eine Zahlungsanfrage hat die vorherige Freigabestufe passiert und wartet nun auf Ihre Genehmigung.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px;">Ihre Rolle</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${step.roleName} (Stufe ${step.sequence} von ${step.totalSteps})</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Gläubiger</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${order.creditor}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Betrag</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${formatEuro(order.amountCents)}</td></tr>
      </table>
      ${linkButton(portalUrl, "Jetzt prüfen")}
    `),
  };
}

/**
 * Ablehnung → an Buchhaltung (CompanyToken.notifyEmail)
 */
export function orderRejectedEmail(
  caseName: string,
  order: { creditor: string; amountCents: bigint; description: string },
  reason: string,
): { subject: string; html: string } {
  return {
    subject: `${caseName} – Zahlung abgelehnt: ${order.creditor}`,
    html: layout("Zahlung abgelehnt", `
      <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6;">
        Die folgende Zahlungsanfrage wurde abgelehnt.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px;">Gläubiger</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${order.creditor}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Betrag</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;">${formatEuro(order.amountCents)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Beschreibung</td><td style="padding:8px 0;color:#111827;font-size:14px;">${order.description}</td></tr>
      </table>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;margin:16px 0;">
        <span style="font-size:13px;font-weight:600;color:#991b1b;">Ablehnungsgrund:</span>
        <p style="margin:4px 0 0;font-size:14px;color:#7f1d1d;">${reason}</p>
      </div>
    `),
  };
}

/**
 * Digest: Genehmigte Orders → an Buchhaltung
 */
export function approvedDigestEmail(
  caseName: string,
  orders: { creditor: string; amountCents: bigint }[],
): { subject: string; html: string } {
  const totalCents = orders.reduce((sum, o) => sum + (typeof o.amountCents === "bigint" ? o.amountCents : BigInt(o.amountCents)), 0n);
  const rows = orders
    .map(
      (o) =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;">${o.creditor}</td><td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;text-align:right;">${formatEuro(o.amountCents)}</td></tr>`
    )
    .join("");

  return {
    subject: `${caseName} – ${orders.length} Zahlung${orders.length > 1 ? "en" : ""} freigegeben`,
    html: layout(`${orders.length} Zahlung${orders.length > 1 ? "en" : ""} freigegeben`, `
      <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6;">
        Die folgenden Zahlungsanfragen wurden freigegeben (Summe: ${formatEuro(totalCents)}).
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Gläubiger</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Betrag</th>
        </tr>
        ${rows}
      </table>
    `),
  };
}

/**
 * Reminder: Überfällige Orders → an Approver
 */
export function pendingReminderEmail(
  caseName: string,
  orders: { creditor: string; amountCents: bigint; createdAt: Date | string }[],
  portalUrl: string,
): { subject: string; html: string } {
  const rows = orders
    .map((o) => {
      const created = typeof o.createdAt === "string" ? new Date(o.createdAt) : o.createdAt;
      const daysAgo = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
      return `<tr><td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;">${o.creditor}</td><td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151;text-align:right;">${formatEuro(o.amountCents)}</td><td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#ef4444;text-align:right;">seit ${daysAgo} Tagen</td></tr>`;
    })
    .join("");

  return {
    subject: `${caseName} – ${orders.length} Anfrage${orders.length > 1 ? "n" : ""} warten auf Freigabe`,
    html: layout(`${orders.length} Anfrage${orders.length > 1 ? "n" : ""} warten auf Freigabe`, `
      <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6;">
        Die folgenden Zahlungsanfragen warten seit mehr als 3 Tagen auf Ihre Freigabe.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Gläubiger</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Betrag</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Wartezeit</th>
        </tr>
        ${rows}
      </table>
      ${linkButton(portalUrl, "Im Portal prüfen")}
    `),
  };
}
