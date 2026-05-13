import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { CampaignSendPoller, CampaignsTable } from "./CampaignsClient";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations("campaigns");
  const locale = await getLocale();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: campaigns, error: listError } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at, scheduled_at, moderation_note")
    .order("created_at", { ascending: false });

  const list = campaigns ?? [];
  const needsAutoSend = list.some((c) => c.status === "running" || c.status === "queued");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <CampaignSendPoller enabled={needsAutoSend} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t("subtitle")}</p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-hover"
        >
          {t("createNew")}
        </Link>
      </div>
      {listError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {t("fetchError", { message: listError.message })}
        </p>
      ) : null}
      {sp.error === "campaign_insert" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("bannerCampaignInsert")}
        </p>
      ) : null}
      {sp.error === "no_profile" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("bannerNoProfile")}
        </p>
      ) : null}
      <CampaignsTable campaigns={list} dash={t("dash")} locale={locale} />
    </div>
  );
}
