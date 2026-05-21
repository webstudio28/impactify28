"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export type ModerationRow = {
  id: string;
  name: string;
  channel: string | null;
  created_at: string;
  user_id: string;
  profiles: { business_name: string | null } | { business_name: string | null }[] | null;
};

function profileName(row: ModerationRow): string {
  const p = row.profiles;
  if (!p) return "—";
  if (Array.isArray(p)) return p[0]?.business_name?.trim() || "—";
  return p.business_name?.trim() || "—";
}

export function ModerationQueueClient({
  locale,
  pending,
}: {
  locale: string;
  pending: ModerationRow[];
}) {
  const t = useTranslations("adminModeration");
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  async function approve(id: string) {
    setBusyId(`a-${id}`);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}/approve`, { method: "POST" });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        alert(j.error ?? t("actionFailed"));
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function submitReject() {
    if (!rejectFor) return;
    const note = rejectNote.trim();
    if (!note) {
      alert(t("noteRequired"));
      return;
    }
    setBusyId(`r-${rejectFor}`);
    try {
      const res = await fetch(`/api/admin/campaigns/${rejectFor}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        alert(j.error ?? t("actionFailed"));
        return;
      }
      setRejectFor(null);
      setRejectNote("");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {!pending.length ? (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm text-zinc-200">
            <thead className="border-b border-zinc-800 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("business")}</th>
                <th className="px-4 py-3 font-medium">{t("campaign")}</th>
                <th className="px-4 py-3 font-medium">{t("channel")}</th>
                <th className="px-4 py-3 font-medium">{t("created")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.id} className="border-b border-zinc-800/80 last:border-0">
                  <td className="px-4 py-3 text-zinc-300">{profileName(row)}</td>
                  <td className="px-4 py-3 font-medium text-white">{row.name}</td>
                  <td className="px-4 py-3 capitalize text-zinc-400">{row.channel ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/${locale}/admin/campaigns/${row.id}`}
                        className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                      >
                        {t("view")}
                      </Link>
                      {row.channel === "email" && (
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              `/api/admin/campaigns/${row.id}/email-preview`,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                          className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                        >
                          {t("previewEmail")}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void approve(row.id)}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {t("approve")}
                      </button>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => {
                          setRejectFor(row.id);
                          setRejectNote("");
                        }}
                        className="rounded-md bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        {t("reject")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectFor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busyId) {
              setRejectFor(null);
              setRejectNote("");
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl">
            <h3 className="text-base font-semibold text-white">{t("rejectModalTitle")}</h3>
            <label className="mt-4 block text-xs font-medium text-zinc-400">{t("rejectReason")}</label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => {
                  setRejectFor(null);
                  setRejectNote("");
                }}
                className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => void submitReject()}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {t("rejectSubmit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
