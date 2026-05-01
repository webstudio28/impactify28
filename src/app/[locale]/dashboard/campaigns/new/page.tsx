import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { CampaignWizard } from "@/components/campaigns/CampaignWizard";

export default async function NewCampaignPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { id?: string };
}) {
  const { locale } = params;
  const t = await getTranslations("newCampaign");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  if (!searchParams.id) {
    const { data, error } = await supabase
      .from("campaigns")
      .insert({ user_id: user.id, name: "New campaign", status: "draft" })
      .select("id")
      .single();

    if (error || !data) {
      redirect(`/${locale}/dashboard/campaigns`);
    }
    redirect(`/${locale}/dashboard/campaigns/new?id=${data.id}`);
  }

  return (
    <Suspense fallback={<div className="mx-auto max-w-xl text-sm text-ink-muted">{t("loadingWizard")}</div>}>
      <CampaignWizard />
    </Suspense>
  );
}
