import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { SendDueMessages } from "./SendDueMessages";

export default async function CampaignsPage() {
  const t = await getTranslations("campaigns");
  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at, scheduled_at")
    .order("created_at", { ascending: false });

  const hasQueued = (campaigns ?? []).some((c) => c.status === "queued");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <SendDueMessages show={hasQueued} />
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
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t("colName")}</th>
              <th className="px-4 py-3 font-medium">{t("colStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("colSchedule")}</th>
              <th className="px-4 py-3 font-medium">{t("colCreated")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {(campaigns ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-muted">
                  {t("empty")}{" "}
                  <Link href="/dashboard/campaigns/new" className="font-medium text-accent hover:text-accent-hover">
                    {t("createOne")}
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              campaigns?.map((c) => (
                <tr key={c.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                  <td className="px-4 py-3 capitalize text-ink-muted">{c.status}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : t("dash")}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : t("dash")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status === "draft" ? (
                      <Link
                        href={`/dashboard/campaigns/new?id=${c.id}`}
                        className="inline-flex rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-surface-muted"
                      >
                        {t("continue")}
                      </Link>
                    ) : (
                      <span className="text-ink-muted">{t("dash")}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
