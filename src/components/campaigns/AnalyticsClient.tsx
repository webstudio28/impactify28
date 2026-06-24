"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { isCampaignLiveStatus } from "@/lib/campaigns/status-client";

type LinkStat = {
  code: string;
  original_url: string;
  short_url: string;
  clicks: number;
  created_at: string;
};

type SalesPayload = {
  conversionCount: number;
  revenueTotal: number;
  currency: string;
  windowEnd: string | null;
  isStale: boolean;
  campaignToken: string | null;
};

type AnalyticsPayload = {
  campaign: {
    id: string;
    name: string;
    status: string;
    channel: string;
    started_at?: string | null;
  };
  counts: { sent: number; failed: number; pending: number; total: number; opened?: number };
  links: LinkStat[];
  totalClicks: number;
  ctr: number;
  live?: {
    open_count: number;
    click_count: number;
    unique_click_count: number;
    updated_at?: string;
  } | null;
};

export function AnalyticsClient({ campaignId }: { campaignId: string }) {
  const t = useTranslations("analytics");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveUpdating, setLiveUpdating] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [sales, setSales] = useState<SalesPayload | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);

  const loadSales = useCallback(async () => {
    setSalesLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/sales`, { cache: "no-store" });
      const json = (await res.json()) as SalesPayload & { error?: string };
      if (res.ok) setSales(json);
    } finally {
      setSalesLoading(false);
    }
  }, [campaignId]);

  const load = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/analytics`, { cache: "no-store" });
      const json = (await res.json()) as AnalyticsPayload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? t("loadFailed"));
        return false;
      }
      setError(null);
      setData(json);
      return true;
    } finally {
      setMetricsLoading(false);
    }
  }, [campaignId, t]);

  useEffect(() => {
    void load();
    void loadSales();
  }, [load, loadSales]);

  const isLive = data ? isCampaignLiveStatus(data.campaign.status) : false;

  useEffect(() => {
    if (!isLive) return;
    const intervalId = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [isLive, load]);

  useEffect(() => {
    if (!isLive) return;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`campaign_metrics:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaign_metrics_live",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          const row = payload.new as {
            open_count?: number;
            click_count?: number;
            unique_click_count?: number;
            updated_at?: string;
          };
          setLiveUpdating(true);
          setData((prev) => {
            if (!prev) return prev;
            const openCount = Number(row.open_count ?? prev.counts.opened ?? 0);
            const clickCount = Number(row.click_count ?? prev.totalClicks);
            const sent = prev.counts.sent;
            const ctrDenominator = sent;
            const ctrRaw = ctrDenominator > 0 ? (clickCount / ctrDenominator) * 100 : 0;
            const ctr = Math.min(100, Math.round(ctrRaw * 10) / 10);
            return {
              ...prev,
              counts: { ...prev.counts, opened: openCount },
              totalClicks: clickCount,
              ctr,
              live: {
                open_count: openCount,
                click_count: clickCount,
                unique_click_count: Number(row.unique_click_count ?? 0),
                updated_at: row.updated_at,
              },
            };
          });
          window.setTimeout(() => setLiveUpdating(false), 600);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, isLive]);

  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-ink-muted">{t("loading")}</p>;
  }

  const { counts, links, totalClicks, ctr, campaign } = data;
  const isEmail = campaign.channel === "email";
  const ctrDenominator = counts.sent;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isLive ? (
          <p className="text-xs text-ink-muted">
            {liveUpdating ? t("liveUpdating") : t("liveHint")}
          </p>
        ) : (
          <p className="text-xs text-ink-muted">{t("resultsRefreshHint")}</p>
        )}
        <button
          type="button"
          onClick={() => void load()}
          disabled={metricsLoading}
          className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-zinc-50 disabled:opacity-50"
        >
          {metricsLoading ? t("liveUpdating") : t("salesRefresh")}
        </button>
      </div>

      <div className={`grid grid-cols-2 gap-3 ${isEmail ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-4"}`}>
        {isEmail ? <StatCard label={t("sent")} value={counts.sent} color="emerald" /> : null}
        <StatCard label={t("failed")} value={counts.failed} color="red" />
        <StatCard label={t("pending")} value={counts.pending} color="amber" />
        {isEmail ? <StatCard label={t("opened")} value={counts.opened ?? 0} color="accent" /> : null}
        <StatCard label={t("clicks")} value={totalClicks} color="accent" />
        <StatCard label={t("ctr")} value={ctr} color="accent" isPercent />
      </div>

      {ctrDenominator > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("ctr")}</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{ctr}%</p>
          <p className="mt-1 text-xs text-ink-muted">
            {t("ctrHint", { clicks: totalClicks, sent: ctrDenominator })}
          </p>
        </div>
      )}

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

      {links.length === 0 && <p className="text-sm text-ink-muted">{t("noLinks")}</p>}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
          <h2 className="text-sm font-semibold text-ink">{t("salesTitle")}</h2>
          <button
            type="button"
            onClick={() => void loadSales()}
            disabled={salesLoading}
            className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-zinc-50 disabled:opacity-50"
          >
            {salesLoading ? t("salesRefreshing") : t("salesRefresh")}
          </button>
        </div>
        {sales ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label={t("salesConversions")} value={sales.conversionCount} color="emerald" />
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 col-span-1 sm:col-span-2">
                <p className="text-xs font-medium text-ink-muted">{t("salesRevenue")}</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-900">
                  {formatRevenue(sales.revenueTotal, sales.currency)}
                </p>
              </div>
            </div>
            {sales.isStale && sales.windowEnd ? (
              <p className="text-xs text-amber-700">
                {t("salesStale", { hours: hoursSince(sales.windowEnd) })}
              </p>
            ) : null}
            <p className="text-xs text-ink-muted">{t("salesAttributionNote")}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">{t("salesEmpty")}</p>
        )}
      </section>
    </div>
  );
}

function formatRevenue(total: number, currency: string): string {
  const formatted = total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${currency}`;
}

function hoursSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(1, Math.round(ms / (60 * 60 * 1000)));
}

export { AnalyticsClient as ResultsClient };

function StatCard({
  label,
  value,
  color,
  isPercent,
}: {
  label: string;
  value: number;
  color: "emerald" | "red" | "amber" | "accent";
  isPercent?: boolean;
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
      <p className={`mt-1 text-2xl font-semibold ${text}`}>
        {isPercent ? `${value}%` : value}
      </p>
    </div>
  );
}
