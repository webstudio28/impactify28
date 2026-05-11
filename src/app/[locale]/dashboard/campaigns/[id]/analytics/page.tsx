import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsClient } from "@/components/campaigns/AnalyticsClient";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, status, user_id")
    .eq("id", id)
    .single();

  if (!campaign || campaign.user_id !== user.id) {
    redirect(`/${locale}/dashboard/campaigns`);
  }

  const t = await getTranslations("analytics");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <a href={`/${locale}/dashboard/campaigns`} className="text-sm text-ink-muted hover:text-ink">
          {t("backCampaigns")}
        </a>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{campaign.name}</h1>
        <p className="mt-1 text-sm text-ink-muted capitalize">{t("status")}: {campaign.status}</p>
      </div>
      <AnalyticsClient campaignId={id} />
    </div>
  );
}
