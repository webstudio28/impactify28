import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { EmailReadyClient } from "@/components/campaigns/EmailReadyClient";

export default async function EmailReadyPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id, status, channel, email_html")
    .eq("id", id)
    .single();

  if (error || !campaign) {
    redirect(`/${locale}/dashboard/campaigns`);
  }
  if (campaign.channel !== "email" || campaign.status !== "draft") {
    redirect(`/${locale}/dashboard/campaigns`);
  }
  const html = typeof campaign.email_html === "string" ? campaign.email_html.trim() : "";
  if (!html) {
    redirect(`/${locale}/dashboard/campaigns/new?id=${id}`);
  }

  const t = await getTranslations("emailReady");
  return (
    <div>
      <p className="mb-6 text-sm text-ink-muted">{t("intro")}</p>
      <EmailReadyClient campaignId={id} />
    </div>
  );
}
