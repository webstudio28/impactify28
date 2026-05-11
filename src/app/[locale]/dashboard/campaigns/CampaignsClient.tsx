"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { memo, useCallback, useEffect, useRef, useState } from "react";

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
};

type OutboundMsg = {
  id: string;
  to_phone: string;
  status: string;
  step_order: number;
  body: string;
  error_message: string | null;
  provider_message_id: string | null;
  run_at: string;
  updated_at: string;
  created_at: string;
};

type MonitorPayload = {
  campaign: { id: string; name: string; status: string };
  counts: { pending: number; sent: number; failed: number };
  total: number;
  offset: number;
  limit: number;
  statusFilter: string;
  messages: OutboundMsg[];
};

const BCP47: Record<string, string> = { en: "en-GB", bg: "bg-BG" };

/** Same output on server and client when `appLocale` comes from `[locale]` (avoids hydration mismatch). */
export function formatAppDate(iso: string, appLocale: string, preset: "date" | "datetime"): string {
  const tag = BCP47[appLocale] ?? "en-GB";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    const opts: Intl.DateTimeFormatOptions =
      preset === "datetime"
        ? { dateStyle: "short", timeStyle: "short" }
        : { dateStyle: "short" };
    return new Intl.DateTimeFormat(tag, opts).format(date);
  } catch {
    return iso;
  }
}

async function fetchMonitorPayload(
  campaignId: string,
  limit: string,
  offset: string,
  status: string
): Promise<{ ok: true; data: MonitorPayload } | { ok: false; detail: string }> {
  const q = new URLSearchParams({ limit, offset, status });
  const res = await fetch(`/api/campaigns/${campaignId}/monitor?${q}`);
  const json = (await res.json()) as MonitorPayload & { error?: string };
  if (!res.ok) return { ok: false, detail: json.error ?? "Request failed" };
  return { ok: true, data: json };
}

function mergeIncomingMessages(previous: OutboundMsg[], incoming: OutboundMsg[]): OutboundMsg[] {
  const prevMap = new Map(previous.map((m) => [m.id, m]));
  return incoming.map((n) => {
    const old = prevMap.get(n.id);
    if (
      old &&
      old.status === n.status &&
      old.updated_at === n.updated_at &&
      old.error_message === n.error_message &&
      old.provider_message_id === n.provider_message_id &&
      old.body === n.body &&
      old.step_order === n.step_order
    ) {
      return old;
    }
    return n;
  });
}

/** POST /api/sms/process while sends are active — refresh campaign list only when something actually queued was processed. */
export function CampaignSendPoller({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      void fetch("/api/sms/process", { method: "POST" }).then(async (r) => {
        const json = (await r.json()) as { processed?: number };
        const n = typeof json.processed === "number" ? json.processed : 0;
        if (n > 0) router.refresh();
      });
    }, 2800);
    return () => window.clearInterval(id);
  }, [enabled, router]);

  return null;
}

export function CampaignsTable({
  campaigns,
  dash,
  locale,
}: {
  campaigns: CampaignRow[];
  dash: string;
  locale: string;
}) {
  const t = useTranslations("campaigns");
  const tm = useTranslations("campaigns.monitor");
  const router = useRouter();
  const [monitorId, setMonitorId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function control(id: string, action: "pause" | "resume") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/campaigns/${id}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        alert(j.error ?? tm("controlError"));
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function openMonitor(c: CampaignRow) {
    setMonitorId(c.id);
  }

  function resultsLabel(status: string) {
    if (status === "completed" || status === "failed" || status === "cancelled") return tm("buttonLog");
    return tm("buttonLive");
  }

  return (
    <>
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
            {campaigns.length === 0 ? (
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
              campaigns.map((c) => (
                <tr key={c.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                  <td className="px-4 py-3 capitalize text-ink-muted">{c.status}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.scheduled_at ? formatAppDate(c.scheduled_at, locale, "datetime") : dash}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.created_at ? formatAppDate(c.created_at, locale, "date") : dash}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {c.status === "draft" ? (
                        <Link
                          href={`/dashboard/campaigns/new?id=${c.id}`}
                          className="inline-flex rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-surface-muted"
                        >
                          {t("continue")}
                        </Link>
                      ) : null}
                      {c.status !== "draft" ? (
                        <>
                          {c.status === "running" || c.status === "queued" ? (
                            <button
                              type="button"
                              disabled={busyId === c.id}
                              onClick={() => void control(c.id, "pause")}
                              className="inline-flex rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-surface-muted disabled:opacity-50"
                            >
                              {tm("pause")}
                            </button>
                          ) : null}
                          {c.status === "paused" ? (
                            <button
                              type="button"
                              disabled={busyId === c.id}
                              onClick={() => void control(c.id, "resume")}
                              className="inline-flex rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-surface-muted disabled:opacity-50"
                            >
                              {tm("resume")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openMonitor(c)}
                            className="inline-flex rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-accent-hover"
                          >
                            {resultsLabel(c.status)}
                          </button>
                          <Link
                            href={`/dashboard/campaigns/${c.id}/analytics`}
                            className="inline-flex rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-surface-muted"
                          >
                            {t("analytics")}
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {monitorId ? (
        <MonitorModal campaignId={monitorId} locale={locale} onClose={() => setMonitorId(null)} />
      ) : null}
    </>
  );
}

function MonitorModal({
  campaignId,
  locale,
  onClose,
}: {
  campaignId: string;
  locale: string;
  onClose: () => void;
}) {
  const tm = useTranslations("campaigns.monitor");
  const loadFailedFallback = tm("loadFailed");
  const [data, setData] = useState<MonitorPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "sent" | "failed">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const userPagedRef = useRef(false);
  /** Avoid resetting panel when parent re-renders (e.g. table refresh): only reload on campaign/filter. */
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const applyPayloadRowMerge = useCallback((incoming: MonitorPayload) => {
    setData((prev) => {
      if (!prev) return incoming;
      return { ...incoming, messages: mergeIncomingMessages(prev.messages, incoming.messages) };
    });
  }, []);

  useEffect(() => {
    userPagedRef.current = false;
    let cancelled = false;

    async function boot() {
      setData(null);
      setError(null);
      const cur = filterRef.current;
      const pack = await fetchMonitorPayload(campaignId, "75", "0", cur);
      if (cancelled) return;
      if (!pack.ok) {
        setError(pack.detail || loadFailedFallback);
        return;
      }
      setData(pack.data);
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [campaignId, filter, loadFailedFallback]);

  const campaignStatus = data?.campaign.status;
  const isLivePolling =
    campaignStatus === "running" || campaignStatus === "paused" || campaignStatus === "queued";

  useEffect(() => {
    if (!isLivePolling) return;

    let cancelled = false;

    async function tick() {
      const cur = filterRef.current;
      const pack = await fetchMonitorPayload(campaignId, "75", "0", cur);
      if (cancelled || !pack.ok) return;

      const st = pack.data.campaign.status;
      const live = st === "running" || st === "paused" || st === "queued";

      if (userPagedRef.current) {
        setData((prev) => {
          if (!prev?.messages?.length) return pack.data;
          const incomingById = new Map(pack.data.messages.map((m) => [m.id, m]));
          const hydrated = prev.messages.map((m) => incomingById.get(m.id) ?? m);
          return { ...pack.data, messages: hydrated };
        });
        return;
      }
      if (live) {
        applyPayloadRowMerge(pack.data);
      } else {
        setData(pack.data);
      }
    }

    const intervalId = window.setInterval(() => void tick(), 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [campaignId, filter, isLivePolling, applyPayloadRowMerge]);

  const titleLive = Boolean(
    data &&
      (data.campaign.status === "running" ||
        data.campaign.status === "paused" ||
        data.campaign.status === "queued")
  );
  const modalTitle = titleLive ? tm("titleLive") : tm("titleDone");

  async function loadMore() {
    if (!data) return;
    userPagedRef.current = true;
    const off = String(data.messages.length);
    const pack = await fetchMonitorPayload(campaignId, "75", off, filter);
    if (!pack.ok) {
      setError(pack.detail || loadFailedFallback);
      return;
    }
    setError(null);
    setData((prev) => {
      if (!prev) return pack.data;
      const seen = new Set(prev.messages.map((m) => m.id));
      const merged = [...prev.messages];
      for (const m of pack.data.messages) {
        if (!seen.has(m.id)) merged.push(m);
      }
      return { ...pack.data, messages: merged };
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{modalTitle}</h2>
            <p className="text-xs text-ink-muted">{data?.campaign?.name ?? "…"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-zinc-100 hover:text-ink"
          >
            {tm("close")}
          </button>
        </div>

        <div className="shrink-0 space-y-2 border-b border-zinc-50 px-4 py-2">
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {data ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px]" aria-live="polite">
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-ink">
                {tm("countPending")}: {data.counts.pending}
              </span>
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-900">
                {tm("countSent")}: {data.counts.sent}
              </span>
              <span className="rounded-md bg-red-50 px-2 py-0.5 font-medium text-red-900">
                {tm("countFailed")}: {data.counts.failed}
              </span>
              <span className="text-ink-muted">
                {tm("campaignStatus")}: {data.campaign.status}
              </span>
            </div>
          ) : (
            !error && <p className="text-xs text-ink-muted">{tm("loading")}</p>
          )}
          <p className="text-[11px] text-ink-muted">{tm("rateNote")}</p>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "pending", "sent", "failed"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={
                  filter === f
                    ? "rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-white"
                    : "rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-ink-muted hover:bg-zinc-200"
                }
              >
                {f === "all"
                  ? tm("filterAll")
                  : f === "pending"
                    ? tm("filterPending")
                    : f === "sent"
                      ? tm("filterSent")
                      : tm("filterFailed")}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-4">
          {data?.messages?.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-ink-muted">{tm("empty")}</p>
          ) : null}
          {data?.messages?.map((row) => (
            <OutboundRow
              key={row.id}
              row={row}
              formattedTime={formatAppDate(row.updated_at, locale, "datetime")}
              expanded={expandedId === row.id}
              onToggle={() => setExpandedId((id) => (id === row.id ? null : row.id))}
            />
          ))}
        </div>

        <div className="shrink-0 border-t border-zinc-100 px-4 py-2">
          {data ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-ink-muted">
                {tm("showing", {
                  loaded: data.messages.length,
                  total: data.total,
                })}
              </p>
              {data.messages.length < data.total ? (
                <button
                  type="button"
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium hover:bg-zinc-50"
                  onClick={() => void loadMore()}
                >
                  {tm("loadMore")}
                </button>
              ) : null}
            </div>
          ) : null}
          {titleLive && userPagedRef.current ? (
            <p className="mt-1 text-[11px] text-amber-800">{tm("pollPausedPaging")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const OutboundRow = memo(function OutboundRow({
  row,
  formattedTime,
  expanded,
  onToggle,
}: {
  row: OutboundMsg;
  formattedTime: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tm = useTranslations("campaigns.monitor");
  const color =
    row.status === "sent"
      ? "border-emerald-200 bg-emerald-50/60"
      : row.status === "failed"
        ? "border-red-200 bg-red-50/60"
        : "border-amber-200 bg-amber-50/60";

  return (
    <div className={`mb-2 rounded-lg border px-3 py-2 text-xs transition-colors ${color}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="font-semibold capitalize text-ink">{row.status}</span>
        <span className="font-mono text-[11px] text-ink">{row.to_phone}</span>
        <span className="text-[11px] text-ink-muted">
          {tm("step")} {row.step_order} · {formattedTime}
        </span>
      </button>
      {row.provider_message_id ? (
        <p className="mt-1 truncate font-mono text-[10px] text-ink-muted" title={row.provider_message_id}>
          {tm("provider")}: {row.provider_message_id}
        </p>
      ) : null}
      {row.error_message ? <p className="mt-1 text-[11px] font-medium text-red-800">{row.error_message}</p> : null}
      {!expanded ? (
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-[11px] text-ink">{row.body}</p>
      ) : (
        <p className="mt-2 whitespace-pre-wrap break-words text-[11px] text-ink">{row.body}</p>
      )}
      <button
        type="button"
        onClick={onToggle}
        className="mt-1 text-[11px] font-medium text-accent hover:text-accent-hover"
      >
        {expanded ? tm("collapse") : tm("expand")}
      </button>
    </div>
  );
});
