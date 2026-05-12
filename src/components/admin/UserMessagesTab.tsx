"use client";

import { useState, useEffect, useCallback } from "react";
import { StatusBadge } from "./StatusBadge";

type SmsMessage = {
  id: string;
  to_phone: string;
  body: string;
  status: string;
  run_at: string;
  updated_at: string;
  error_message: string | null;
  campaign_id: string | null;
  step_order: number;
};

type EmailMessage = {
  id: string;
  to_email: string;
  subject: string;
  status: string;
  run_at: string;
  updated_at: string;
  error_message: string | null;
  campaign_id: string | null;
};

export function UserMessagesTab({ userId }: { userId: string }) {
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [messages, setMessages] = useState<(SmsMessage | EmailMessage)[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ channel, page: String(page) });
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/users/${userId}/messages?${params}`);
      const json = await res.json();
      setMessages(json.messages ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [userId, channel, status, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-zinc-700 bg-zinc-800 p-0.5">
          {(["sms", "email"] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => { setChannel(ch); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                channel === ch ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {ch.toUpperCase()}
            </button>
          ))}
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-500"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <span className="text-xs text-zinc-600">{total.toLocaleString()} messages</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 text-left font-medium text-zinc-600">
                {channel === "sms" ? "To (phone)" : "To (email)"}
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600">
                {channel === "sms" ? "Body" : "Subject"}
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600">Scheduled</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 animate-pulse rounded bg-zinc-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-600">
                  No messages found.
                </td>
              </tr>
            ) : (
              messages.map((m) => {
                const isSms = "to_phone" in m;
                const sms = m as SmsMessage;
                const email = m as EmailMessage;
                return (
                  <tr key={m.id} className="transition hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {isSms ? sms.to_phone : email.to_email}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-zinc-400">
                      {isSms ? sms.body : email.subject}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} />
                      {m.status === "failed" && m.error_message && (
                        <p className="mt-0.5 truncate text-xs text-red-500" title={m.error_message}>
                          {m.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(m.run_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(m.updated_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
