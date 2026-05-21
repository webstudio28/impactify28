"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function DomainSetupModal() {
  const t = useTranslations("domainSetup");
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_display_name: displayName.trim(),
          sender_email: replyEmail.trim().toLowerCase() || null,
        }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? t("saveFailed"));
        return;
      }

      router.refresh();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="domain-setup-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-2xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
          <svg className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016 2.993 2.993 0 0 0 2.25-1.016 3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
          </svg>
        </div>

        <h2 id="domain-setup-title" className="text-xl font-semibold tracking-tight text-ink">
          {t("title")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t("subtitle")}</p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="ds-name" className="mb-1.5 block text-sm font-medium text-ink">
              {t("nameLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              id="ds-name"
              type="text"
              required
              autoFocus
              autoComplete="organization"
              placeholder={t("namePlaceholder")}
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <p className="mt-1.5 text-xs text-ink-muted">{t("nameHint")}</p>
          </div>

          <div>
            <label htmlFor="ds-reply" className="mb-1.5 block text-sm font-medium text-ink">
              {t("replyEmailLabel")}
            </label>
            <input
              id="ds-reply"
              type="email"
              autoComplete="email"
              placeholder={t("replyEmailPlaceholder")}
              value={replyEmail}
              onChange={(e) => setReplyEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <p className="mt-1.5 text-xs text-ink-muted">{t("replyEmailHint")}</p>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || !displayName.trim()}
            className="mt-2 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? t("saving") : t("submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
