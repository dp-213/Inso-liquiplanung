
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { OrderSubmissionForm } from "./OrderSubmissionForm";

interface PageProps {
    params: Promise<{
        token: string;
    }>;
}

export default async function SubmitOrderPage({ params }: PageProps) {
    const { token } = await params;

    // Token validieren
    const companyToken = await prisma.companyToken.findUnique({
        where: { token },
        include: {
            case: {
                select: {
                    debtorName: true,
                    caseNumber: true,
                },
            },
        },
    });

    if (!companyToken || !companyToken.isActive) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Freigabeanfrage
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        für das Verfahren <strong>{companyToken.case.debtorName}</strong>
                        <br />
                        <span className="text-xs text-gray-500">
                            Az: {companyToken.case.caseNumber}
                        </span>
                    </p>
                </div>

                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
                    <OrderSubmissionForm token={token} />
                </div>

                <div className="text-center text-xs text-gray-400">
                    <p>
                        Eingereicht via Inso-Liquiplanung Token-Link.
                        <br />
                        Zugang bereitgestellt für: {companyToken.label}
                    </p>
                </div>
            </div>
        </div>
    );
}
