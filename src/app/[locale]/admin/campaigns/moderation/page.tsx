import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ModerationQueueClient, type ModerationRow } from "@/components/admin/ModerationQueueClient";

export const dynamic = "force-dynamic";

const SELECT = "id, name, status, channel, created_at, user_id, profiles ( business_name )";

export default async function AdminCampaignModerationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const adminUser = await getAdminUser();
  if (!adminUser) redirect(`/${locale}/dashboard`);

  const t = await getTranslations("adminModeration");
  const db = createAdminClient();

  const { data: pending, error: dbErr } = await db
    .from("campaigns")
    .select(SELECT)
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false });

  if (dbErr) {
    console.error("[AdminCampaignModerationPage] query error:", dbErr.message);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("subtitle")}</p>
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-500">{t("pendingTitle")}</h2>
        <ModerationQueueClient locale={locale} pending={(pending ?? []) as ModerationRow[]} />
      </section>
    </div>
  );
}
