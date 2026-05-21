"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TicketKind = "critical" | "error" | "warning" | "info";

export type TicketRow = {
  id: string;
  kind: TicketKind;
  title: string;
  message: string;
  context: Record<string, unknown> | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  campaign_id: string | null;
  profiles?: { business_name: string | null; sender_email: string | null } | null;
};

type ApiResponse = {
  tickets: TicketRow[];
  total: number;
  page: number;
  pageSize: number;
};

// ── Styling maps ──────────────────────────────────────────────────────────────

const KIND_LABEL: Record<TicketKind, string> = {
  critical: "Critical",
  error: "Error",
  warning: "Warning",
  info: "Info",
};

const KIND_BADGE: Record<TicketKind, string> = {
  critical: "bg-purple-100 text-purple-900 border-purple-300",
  error: "bg-red-100 text-red-900 border-red-300",
  warning: "bg-amber-100 text-amber-900 border-amber-300",
  info: "bg-blue-100 text-blue-900 border-blue-300",
};

const KIND_BADGE_OPEN: Record<TicketKind, string> = {
  critical: "bg-purple-950/30 border-purple-800/60",
  error: "bg-red-950/25 border-red-900/50",
  warning: "bg-amber-950/20 border-amber-900/50",
  info: "bg-blue-950/20 border-blue-900/50",
};

const KIND_DOT: Record<TicketKind, string> = {
  critical: "bg-purple-500",
  error: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusFilter = "open" | "resolved" | "all";
type KindFilter = "all" | TicketKind;
type DateFilter = "all" | "today" | "7d" | "30d";

function dateFilterToParam(f: DateFilter): { dateFrom?: string; dateTo?: string } {
  if (f === "all") return {};
  const now = new Date();
  const from = new Date(now);
  if (f === "today") { from.setHours(0, 0, 0, 0); }
  else if (f === "7d") { from.setDate(from.getDate() - 7); }
  else if (f === "30d") { from.setDate(from.getDate() - 30); }
  return { dateFrom: from.toISOString() };
}

// ── Main component ────────────────────────────────────────────────────────────

export function TicketsClient({ locale }: { locale: string }) {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const PAGE_SIZE = 50;

  const load = useCallback(
    async (pg: number, sf: StatusFilter, kf: KindFilter, df: DateFilter, sq: string) => {
      setLoading(true);
      setFetchError(null);
      try {
        const params = new URLSearchParams({ page: String(pg) });
        if (sf !== "all") params.set("resolved", sf === "resolved" ? "true" : "false");
        if (kf !== "all") params.set("kind", kf);
        const dateRange = dateFilterToParam(df);
        if (dateRange.dateFrom) params.set("dateFrom", dateRange.dateFrom);
        if (dateRange.dateTo) params.set("dateTo", dateRange.dateTo);
        if (sq) params.set("search", sq);

        const res = await fetch(`/api/admin/tickets?${params}`);
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          setFetchError(j.error ?? "Failed to load tickets");
          return;
        }
        const data = (await res.json()) as ApiResponse;
        setTickets(data.tickets);
        setTotal(data.total);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load(page, statusFilter, kindFilter, dateFilter, search);
  }, [page, statusFilter, kindFilter, dateFilter, search, load]);

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearch(val);
      setPage(0);
    }, 350);
  }

  async function toggleResolved(ticket: TicketRow) {
    setBusyId(ticket.id);
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved: !ticket.resolved }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        alert(j.error ?? "Failed to update ticket");
        return;
      }
      // If filtering by open/resolved, remove from list; otherwise update in place
      if (statusFilter !== "all") {
        setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
        setTotal((n) => Math.max(0, n - 1));
      } else {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticket.id
              ? { ...t, resolved: !t.resolved, resolved_at: !t.resolved ? new Date().toISOString() : null }
              : t
          )
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-3">
        {/* Status */}
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
          {(["open", "resolved", "all"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setStatusFilter(f); setPage(0); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                statusFilter === f
                  ? "bg-accent text-white shadow"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Kind */}
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
          {(["all", "critical", "error", "warning", "info"] as KindFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKindFilter(k); setPage(0); }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                kindFilter === k
                  ? "bg-zinc-700 text-white shadow"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {k !== "all" && (
                <span className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[k as TicketKind]}`} />
              )}
              {k === "all" ? "All kinds" : KIND_LABEL[k as TicketKind]}
            </button>
          ))}
        </div>

        {/* Date */}
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
          {([["all", "All time"], ["today", "Today"], ["7d", "7 days"], ["30d", "30 days"]] as [DateFilter, string][]).map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => { setDateFilter(f); setPage(0); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                dateFilter === f
                  ? "bg-zinc-700 text-white shadow"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search title or message…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-8 pr-3 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
        </div>
      </div>

      {/* Count line */}
      {!loading && (
        <p className="text-xs text-zinc-500">
          {total === 0 ? "No tickets found" : `${total} ticket${total !== 1 ? "s" : ""}`}
          {total > PAGE_SIZE ? `, showing page ${page + 1} of ${totalPages}` : ""}
        </p>
      )}

      {fetchError ? (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">{fetchError}</div>
      ) : null}

      {/* ── Ticket list ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-500">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-20 text-center text-sm text-zinc-500">
          {statusFilter === "open" && kindFilter === "all"
            ? "No open tickets. Everything looks good."
            : "No tickets match these filters."}
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              locale={locale}
              expanded={expandedId === ticket.id}
              onToggle={() => setExpandedId((id) => (id === ticket.id ? null : ticket.id))}
              busy={busyId === ticket.id}
              onToggleResolved={() => void toggleResolved(ticket)}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="text-xs text-zinc-500">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ── Individual ticket card ────────────────────────────────────────────────────

function TicketCard({
  ticket,
  locale,
  expanded,
  onToggle,
  busy,
  onToggleResolved,
}: {
  ticket: TicketRow;
  locale: string;
  expanded: boolean;
  onToggle: () => void;
  busy: boolean;
  onToggleResolved: () => void;
}) {
  const isOpen = !ticket.resolved;
  const cardBg = ticket.resolved
    ? "border-zinc-800 bg-zinc-900/50"
    : KIND_BADGE_OPEN[ticket.kind];

  return (
    <div className={`rounded-xl border transition-colors ${cardBg}`}>
      <div className="flex flex-wrap items-start gap-3 p-4">

        {/* Left: kind dot + time */}
        <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
          <span className={`h-2.5 w-2.5 rounded-full ${ticket.resolved ? "bg-zinc-600" : KIND_DOT[ticket.kind]}`} />
          <span className="text-[10px] text-zinc-600">{relativeTime(ticket.created_at)}</span>
        </div>

        {/* Center: all ticket info */}
        <div className="min-w-0 flex-1 space-y-1.5">

          {/* Title row */}
          <div className="flex flex-wrap items-start gap-2">
            <span
              className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                ticket.resolved ? "border-zinc-700 bg-zinc-800 text-zinc-500" : KIND_BADGE[ticket.kind]
              }`}
            >
              {ticket.kind}
            </span>
            <p className={`text-sm font-semibold leading-snug ${ticket.resolved ? "text-zinc-400" : "text-white"}`}>
              {ticket.title}
            </p>
          </div>

          {/* Message */}
          <p className="text-sm text-zinc-400 leading-relaxed">{ticket.message}</p>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
            <span title={ticket.created_at}>{formatDate(ticket.created_at)}</span>

            {ticket.profiles?.business_name ? (
              <span>
                Business:{" "}
                <span className="font-medium text-zinc-300">{ticket.profiles.business_name}</span>
              </span>
            ) : ticket.user_id ? (
              <span>
                User:{" "}
                <span className="font-mono text-zinc-400">{ticket.user_id.slice(0, 8)}…</span>
              </span>
            ) : null}

            {ticket.profiles?.sender_email ? (
              <span>
                Sender:{" "}
                <span className="font-mono text-zinc-400">{ticket.profiles.sender_email}</span>
              </span>
            ) : null}

            {ticket.campaign_id ? (
              <span>
                Campaign:{" "}
                <a
                  href={`/${locale}/admin/campaigns/${ticket.campaign_id}`}
                  className="font-mono text-accent hover:underline"
                >
                  {ticket.campaign_id.slice(0, 8)}…
                </a>
              </span>
            ) : null}

            {ticket.resolved && ticket.resolved_at ? (
              <span className="text-emerald-600">
                ✓ Resolved {formatDate(ticket.resolved_at)}
              </span>
            ) : null}
          </div>

          {/* Context details */}
          {ticket.context && Object.keys(ticket.context).length > 0 ? (
            <div>
              <button
                type="button"
                onClick={onToggle}
                className="mt-0.5 text-[11px] text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline"
              >
                {expanded ? "▲ Hide details" : "▼ Show details"}
              </button>
              {expanded ? (
                <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <table className="w-full text-xs">
                    <tbody>
                      {Object.entries(ticket.context).map(([k, v]) => (
                        <tr key={k} className="border-b border-zinc-800 last:border-0">
                          <td className="py-1.5 pr-4 font-semibold text-zinc-400 whitespace-nowrap">{k}</td>
                          <td className="py-1.5 font-mono text-zinc-300 break-all">
                            {Array.isArray(v)
                              ? v.map((item, i) => (
                                  <div key={i} className="text-red-400">
                                    {String(item)}
                                  </div>
                                ))
                              : typeof v === "object"
                                ? JSON.stringify(v, null, 2)
                                : String(v)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Right: resolve button */}
        <button
          type="button"
          disabled={busy}
          onClick={onToggleResolved}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
            ticket.resolved
              ? "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
              : isOpen && ticket.kind === "critical"
                ? "border-purple-700 bg-purple-900/30 text-purple-300 hover:bg-purple-900/60"
                : "border-emerald-700 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/60"
          }`}
        >
          {busy ? "…" : ticket.resolved ? "Reopen" : "Resolve"}
        </button>
      </div>
    </div>
  );
}
