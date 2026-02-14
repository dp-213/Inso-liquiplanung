/**
 * Cron-Route für Email-Benachrichtigungen:
 * 1. Approved-Digest: Genehmigte Orders → Email an Buchhaltung (idempotent)
 * 2. Pending-Reminder: Überfällige Orders (> 3 Tage) → einmalige Erinnerung an Approver
 *
 * Aufgerufen alle 30 Min via Cronjob:
 * curl "https://cases.gradify.de/api/cron/order-notifications?secret=$CRON_SECRET"
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentApprover } from "@/lib/approval-engine";
import { sendEmail } from "@/lib/email";
import { approvedDigestEmail, pendingReminderEmail } from "@/lib/email-templates";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { digestsSent: 0, remindersSent: 0, errors: 0 };

  try {
    // ─── 1. Approved-Digest ───────────────────────────────────────────────
    // Orders die APPROVED/AUTO_APPROVED sind aber noch keinen Digest bekommen haben
    const approvedOrders = await prisma.order.findMany({
      where: {
        status: { in: ["APPROVED", "AUTO_APPROVED"] },
        approvalDigestSentAt: null,
        companyTokenId: { not: null },
      },
      include: {
        case: { select: { debtorName: true } },
        companyToken: { select: { id: true, notifyEmail: true } },
      },
    });

    // Gruppiere nach caseId + companyTokenId
    const digestGroups = new Map<string, typeof approvedOrders>();
    for (const order of approvedOrders) {
      if (!order.companyToken?.notifyEmail) continue;
      const key = `${order.caseId}::${order.companyTokenId}`;
      const group = digestGroups.get(key) || [];
      group.push(order);
      digestGroups.set(key, group);
    }

    for (const [, orders] of digestGroups) {
      const first = orders[0];
      const email = first.companyToken!.notifyEmail!;
      const caseName = first.case.debtorName;

      try {
        const tpl = approvedDigestEmail(
          caseName,
          orders.map((o) => ({ creditor: o.creditor, amountCents: o.amountCents })),
        );
        await sendEmail({
          to: email,
          ...tpl,
          context: {
            event: "APPROVED_DIGEST",
            caseId: first.caseId,
            orderIds: orders.map((o) => o.id),
          },
        });
        results.digestsSent++;
      } catch {
        results.errors++;
      }

      // Idempotent: approvalDigestSentAt setzen
      await prisma.order.updateMany({
        where: { id: { in: orders.map((o) => o.id) } },
        data: { approvalDigestSentAt: new Date().toISOString() },
      });
    }

    // ─── 2. Pending-Reminder (> 3 Tage, einmalig) ──────────────────────
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const pendingOrders = await prisma.order.findMany({
      where: {
        status: "PENDING",
        reminderSentAt: null,
        createdAt: { lt: threeDaysAgo },
      },
      include: {
        case: { select: { debtorName: true } },
      },
    });

    // Gruppiere nach caseId + aktuellem Approver
    const reminderGroups = new Map<string, { email: string; caseName: string; orders: typeof pendingOrders }>();

    for (const order of pendingOrders) {
      // Bestimme den aktuellen Approver (Chain-Modus) oder Case-Owner (Legacy)
      const approver = await getCurrentApprover(order.id);
      let approverEmail: string | null = null;

      if (approver?.email) {
        approverEmail = approver.email;
      } else {
        // Legacy: Case-Owner
        const caseOwner = await prisma.case.findUnique({
          where: { id: order.caseId },
          select: { owner: { select: { email: true } } },
        });
        approverEmail = caseOwner?.owner?.email || null;
      }

      if (!approverEmail) continue;

      const key = `${order.caseId}::${approverEmail}`;
      const group = reminderGroups.get(key) || { email: approverEmail, caseName: order.case.debtorName, orders: [] };
      group.orders.push(order);
      reminderGroups.set(key, group);
    }

    for (const [, group] of reminderGroups) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cases.gradify.de";
      const caseId = group.orders[0].caseId;
      const portalUrl = `${appUrl}/portal/cases/${caseId}`;

      try {
        const tpl = pendingReminderEmail(
          group.caseName,
          group.orders.map((o) => ({
            creditor: o.creditor,
            amountCents: o.amountCents,
            createdAt: o.createdAt,
          })),
          portalUrl,
        );
        await sendEmail({
          to: group.email,
          ...tpl,
          context: {
            event: "PENDING_REMINDER",
            caseId,
            orderIds: group.orders.map((o) => o.id),
          },
        });
        results.remindersSent++;
      } catch {
        results.errors++;
      }

      // Einmalig: reminderSentAt setzen
      await prisma.order.updateMany({
        where: { id: { in: group.orders.map((o) => o.id) } },
        data: { reminderSentAt: new Date().toISOString() },
      });
    }

  } catch (error) {
    console.error("[Cron] order-notifications error:", error);
    results.errors++;
  }

  console.log("[Cron] order-notifications complete:", JSON.stringify(results));
  return NextResponse.json({ success: true, ...results });
}
