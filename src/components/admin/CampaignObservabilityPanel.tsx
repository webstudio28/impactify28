"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/admin/StatusBadge";

export type CampaignIncidentRow = {
  id: string;
  status: string;
  severity: string;
  trigger_type: string;
  summary: string;
  details: Record<string, unknown> | null;
  opened_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type CampaignEventRow = {
  id: string;
  recipient_id: string | null;
  event_type: string;
  event_time: string;
  provider: string | null;
  error_class: string | null;
  error_code: string | null;
  error_message: string | null;
  latency_ms: number | null;
};

type Props = {
  campaignId: string;
  campaignStatus: string;
  pausedBy: string | null;
  pausedReasonCode: string | null;
  pausedReasonMessage: string | null;
  incidents: CampaignIncidentRow[];
  events: CampaignEventRow[];
};

export function CampaignObservabilityPanel({
  campaignId,
  campaignStatus,
  pausedBy,
  pausedReasonCode,
  pausedReasonMessage,
  incidents,
  events,
}: Props) {
  const router = useRouter();
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const openIncidents = incidents.filter((i) => i.status === "open");
  const isSystemPaused =
    campaignStatus === "paused_system" ||
    (campaignStatus === "paused" && pausedBy === "system");

  const canResume = isSystemPaused;

  async function handleResume() {
    setResuming(true);
    setResumeError(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/resume`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setResumeError(body.error ?? "Resume failed");
        return;
      }
      router.refresh();
    } catch {
      setResumeError("Resume failed");
    } finally {
      setResuming(false);
    }
  }

  return (
    <div className="space-y-8">
      {(isSystemPaused || pausedReasonMessage) && (
        <section className="rounded-xl border border-amber-900/50 bg-amber-950/30 p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-600">
            System pause
          </h2>
          {pausedReasonCode && (
            <p className="text-xs font-mono text-amber-500/80">{pausedReasonCode}</p>
          )}
          <p className="mt-1 text-sm text-amber-100">
            {pausedReasonMessage ?? "Campaign was paused automatically due to errors."}
          </p>
          {canResume && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleResume}
                disabled={resuming}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {resuming ? "Resuming…" : "Problem fixed — resume campaign"}
              </button>
              {openIncidents.length === 0 && (
                <span className="text-xs text-zinc-500">No open incidents on record.</span>
              )}
              {resumeError && <span className="text-xs text-red-400">{resumeError}</span>}
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-600">
          Incidents ({incidents.length})
        </h2>
        {incidents.length === 0 ? (
          <p className="text-sm text-zinc-600">No incidents recorded.</p>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={inc.status} />
                  <span className="text-xs text-zinc-500">{inc.severity}</span>
                  <span className="font-mono text-xs text-zinc-600">{inc.trigger_type}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-200">{inc.summary}</p>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-600">
                  <span>Opened: {new Date(inc.opened_at).toLocaleString()}</span>
                  {inc.resolved_at && (
                    <span>Resolved: {new Date(inc.resolved_at).toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-600">
          Pipeline events (latest {events.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Time</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Type</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Error class</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-600">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-600">
                    No pipeline events yet.
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-zinc-800/30">
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                      {new Date(ev.event_time).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-300">{ev.event_type}</td>
                    <td className="px-3 py-2 text-zinc-500">{ev.error_class ?? "—"}</td>
                    <td className="max-w-md truncate px-3 py-2 text-zinc-400" title={ev.error_message ?? ""}>
                      {ev.error_message ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
