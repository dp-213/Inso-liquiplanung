import { redirect } from "next/navigation";

export default async function EstateRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/portal/cases/${id}`);
}
