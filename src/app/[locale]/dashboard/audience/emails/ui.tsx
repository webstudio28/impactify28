"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { formatAppDate } from "@/lib/i18n/format-app-date";

type Row = { id: string; name: string; created_at: string; count: number };

export function EmailsAudienceList({ initialAudiences, locale }: { initialAudiences: Row[]; locale: string }) {
  const t = useTranslations("emails");
  const router = useRouter();
  const [audiences] = useState(initialAudiences);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createAudience() {
    setError(null);
    if (!newName.trim()) {
      setError(t("nameListFirst"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), audience_type: "email" }),
      });
      const json = (await res.json()) as { audience?: { id: string }; error?: string };
      if (!res.ok || !json.audience) throw new Error(json.error ?? t("createFailed"));
      router.push(`/dashboard/audience/emails/${json.audience.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("createFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {audiences.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <p className="text-sm text-ink-muted">{t("emptyState")}</p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            {t("createAudience")}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              {t("createAudience")}
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <ul className="divide-y divide-zinc-100">
              {audiences.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{a.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {t("listMeta", {
                        count: a.count,
                        date: formatAppDate(a.created_at, locale, "date"),
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/audience/emails/${a.id}`)}
                    className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
                  >
                    {t("openList")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showCreate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-audience-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setShowCreate(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 id="create-audience-title" className="text-base font-semibold text-ink">
              {t("createAudience")}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{t("createAudienceHint")}</p>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createAudience();
              }}
              placeholder={t("listPlaceholder")}
              className="mt-4 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none ring-accent/30 focus:ring-2"
            />
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-60"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createAudience()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {busy ? t("creating") : t("createList")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
