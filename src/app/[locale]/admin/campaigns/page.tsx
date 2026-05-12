import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin/auth";
import { CampaignsTable } from "@/components/admin/CampaignsTable";

export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const adminUser = await getAdminUser();
  if (!adminUser) redirect(`/${locale}/dashboard`);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Campaigns</h1>
        <p className="mt-1 text-sm text-zinc-500">
          All campaigns across all users. Filter by status or channel.
        </p>
      </div>
      <CampaignsTable locale={locale} />
    </div>
  );
}
