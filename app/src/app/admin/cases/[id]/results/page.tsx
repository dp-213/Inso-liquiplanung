import { redirect } from "next/navigation";

export default async function ResultsRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/cases/${id}/dashboard`);
}
