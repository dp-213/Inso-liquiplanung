
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

interface RouteProps {
    params: Promise<{
        id: string; // caseId
    }>;
}

export async function POST(req: NextRequest, { params }: RouteProps) {
    try {
        const session = await requireAuth().catch(() => null);
        const { id: caseId } = await params;

        // If not admin, check customer access
        if (!session?.isAdmin) {
            const { getCustomerSession, checkCaseAccess } = await import("@/lib/customer-auth");
            const customerSession = await getCustomerSession();
            if (!customerSession) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

            const access = await checkCaseAccess(customerSession.customerId, caseId);
            if (!access.hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { label, notifyEmail } = body;

        // Token generieren (einfache UUID, könnte auch komplexer sein)
        const token = uuidv4();

        const companyToken = await prisma.companyToken.create({
            data: {
                caseId,
                token,
                label: label || "Neuer Zugang",
                notifyEmail: notifyEmail || null,
            },
        });

        return NextResponse.json({ success: true, token: companyToken });
    } catch (error) {
        return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
    }
}

export async function GET(req: NextRequest, { params }: RouteProps) {
    try {
        const session = await requireAuth().catch(() => null);
        const { id: caseId } = await params;

        // If not admin, check customer access
        if (!session?.isAdmin) {
            const { getCustomerSession, checkCaseAccess } = await import("@/lib/customer-auth");
            const customerSession = await getCustomerSession();
            if (!customerSession) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

            const access = await checkCaseAccess(customerSession.customerId, caseId);
            if (!access.hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const tokens = await prisma.companyToken.findMany({
            where: { caseId },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ success: true, tokens });
    } catch (error) {
        return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: RouteProps) {
    try {
        const session = await requireAuth().catch(() => null);
        const { id: caseId } = await params;

        if (!session?.isAdmin) {
            const { getCustomerSession, checkCaseAccess } = await import("@/lib/customer-auth");
            const customerSession = await getCustomerSession();
            if (!customerSession) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

            const access = await checkCaseAccess(customerSession.customerId, caseId);
            if (!access.hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { tokenId, notifyEmail } = body;

        if (!tokenId) {
            return NextResponse.json({ error: "tokenId ist erforderlich" }, { status: 400 });
        }

        const updated = await prisma.companyToken.update({
            where: { id: tokenId, caseId },
            data: { notifyEmail: notifyEmail || null },
        });

        return NextResponse.json({ success: true, token: updated });
    } catch (error) {
        return NextResponse.json({ error: "Fehler beim Aktualisieren" }, { status: 500 });
    }
}
