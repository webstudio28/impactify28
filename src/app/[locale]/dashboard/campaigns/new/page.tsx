import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { CampaignWizard } from "@/components/campaigns/CampaignWizard";

export default async function NewCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { locale } = await params;
  const search = await searchParams;
  const t = await getTranslations("newCampaign");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) {
    const { error: profileErr } = await supabase
      .from("profiles")
      .insert({ id: user.id, business_name: "My business" });
    if (profileErr) {
      redirect(`/${locale}/dashboard/campaigns?error=no_profile`);
    }
  }

  if (!search.id) {
    const { data, error } = await supabase
      .from("campaigns")
      .insert({ user_id: user.id, name: "New campaign", status: "draft" })
      .select("id")
      .single();

    if (error || !data) {
      redirect(`/${locale}/dashboard/campaigns?error=campaign_insert`);
    }
    redirect(`/${locale}/dashboard/campaigns/new?id=${data.id}`);
  }

  return (
    <Suspense fallback={<div className="mx-auto max-w-xl text-sm text-ink-muted">{t("loadingWizard")}</div>}>
      <CampaignWizard />
    </Suspense>
  );
}
