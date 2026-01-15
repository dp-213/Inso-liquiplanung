import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AdminSidebar />
      <div className="ml-64">
        <AdminHeader username={session.username} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
