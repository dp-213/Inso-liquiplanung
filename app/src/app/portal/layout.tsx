import { getCustomerSession } from "@/lib/customer-auth";
import { isSubdomainRequest } from "@/lib/tenant";
import CustomerHeader from "@/components/portal/CustomerHeader";
import { redirect } from "next/navigation";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCustomerSession();
  const isSubdomain = await isSubdomainRequest();

  if (!session) {
    // Auf Subdomain: /login, auf Hauptdomain: /customer-login
    redirect(isSubdomain ? "/login" : "/customer-login");
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <CustomerHeader
        userName={session.name}
        companyName={session.company}
        logoUrl={session.logoUrl}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
