"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type LinkStat = {
  code: string;
  original_url: string;
  short_url: string;
  clicks: number;
  created_at: string;
};

type AnalyticsPayload = {
  campaign: { id: string; name: string; status: string; channel: string };
  counts: { sent: number; failed: number; pending: number; total: number };
  links: LinkStat[];
  totalClicks: number;
  ctr: number;
};

export function AnalyticsClient({ campaignId }: { campaignId: string }) {
  const t = useTranslations("analytics");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/campaigns/${campaignId}/analytics`);
      const json = (await res.json()) as AnalyticsPayload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? t("loadFailed"));
        return;
      }
      setData(json);
    }
    void load();
  }, [campaignId, t]);

  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-ink-muted">{t("loading")}</p>;
  }

  const { counts, links, totalClicks, ctr } = data;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("sent")} value={counts.sent} color="emerald" />
        <StatCard label={t("failed")} value={counts.failed} color="red" />
        <StatCard label={t("pending")} value={counts.pending} color="amber" />
        <StatCard label={t("clicks")} value={totalClicks} color="accent" />
      </div>

      {/* CTR */}
      {counts.sent > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("ctr")}</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{ctr}%</p>
          <p className="mt-1 text-xs text-ink-muted">{t("ctrHint", { clicks: totalClicks, sent: counts.sent })}</p>
        </div>
      )}

      {/* Links */}
      {links.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">{t("linksTitle")}</h2>
          </div>
          <ul className="divide-y divide-zinc-50">
            {links.map((link) => (
              <li key={link.code} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-xs font-mono font-medium text-accent">{link.short_url}</p>
                    <p className="truncate text-xs text-ink-muted">{link.original_url}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold text-ink">{link.clicks}</p>
                    <p className="text-[11px] text-ink-muted">{t("clicks")}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {links.length === 0 && (
        <p className="text-sm text-ink-muted">{t("noLinks")}</p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "red" | "amber" | "accent";
}) {
  const bg = {
    emerald: "bg-emerald-50 border-emerald-100",
    red: "bg-red-50 border-red-100",
    amber: "bg-amber-50 border-amber-100",
    accent: "bg-accent/5 border-accent/20",
  }[color];

  const text = {
    emerald: "text-emerald-900",
    red: "text-red-900",
    amber: "text-amber-900",
    accent: "text-accent",
  }[color];

  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${text}`}>{value}</p>
    </div>
  );
}
