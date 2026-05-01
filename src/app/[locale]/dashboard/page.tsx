import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardHomePage() {
  const t = await getTranslations("dashboard");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ count: campaignCount }, { count: audienceCount }] = await Promise.all([
    supabase.from("campaigns").select("*", { count: "exact", head: true }),
    supabase.from("audiences").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t("title")}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {t("signedInAs")} <span className="text-ink">{user?.email}</span>
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-ink-muted">{t("campaigns")}</p>
          <p className="mt-2 text-3xl font-semibold">{campaignCount ?? 0}</p>
          <Link
            href="/dashboard/campaigns"
            className="mt-4 inline-block text-sm font-medium text-accent hover:text-accent-hover"
          >
            {t("viewCampaigns")}
          </Link>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-ink-muted">{t("audiences")}</p>
          <p className="mt-2 text-3xl font-semibold">{audienceCount ?? 0}</p>
          <Link
            href="/dashboard/audience/phones"
            className="mt-4 inline-block text-sm font-medium text-accent hover:text-accent-hover"
          >
            {t("managePhones")}
          </Link>
        </div>
      </div>
      <Link
        href="/dashboard/campaigns/new"
        className="inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-hover"
      >
        {t("createCampaign")}
      </Link>
    </div>
  );
}
