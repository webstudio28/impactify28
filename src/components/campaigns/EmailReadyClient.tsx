"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { formatResendFrom } from "@/lib/email/resend-from";

type Profile = {
  logo_url: string | null;
  business_name: string | null;
  sender_email: string | null;
  sender_display_name: string | null;
};

export function EmailReadyClient({ campaignId }: { campaignId: string }) {
  const t = useTranslations("emailReady");
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subject, setSubject] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const desktopSrc = `/api/campaigns/${campaignId}/email-preview?viewport=desktop`;
  const mobileSrc = `/api/campaigns/${campaignId}/email-preview?viewport=mobile`;

  const load = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([
      fetch(`/api/campaigns/${campaignId}`),
      fetch("/api/profile"),
    ]);
    if (!cRes.ok) throw new Error(t("loadFailed"));
    const cJson = (await cRes.json()) as {
      campaign: { email_subject?: string | null; send_immediately?: boolean; scheduled_at?: string | null };
    };
    setSubject(typeof cJson.campaign.email_subject === "string" ? cJson.campaign.email_subject : "");
    setSendNow(Boolean(cJson.campaign.send_immediately));
    if (cJson.campaign.scheduled_at) {
      const d = new Date(cJson.campaign.scheduled_at as string);
      const pad = (n: number) => String(n).padStart(2, "0");
      setScheduledLocal(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    }
    if (pRes.ok) {
      const pJson = (await pRes.json()) as { profile?: Partial<Profile> };
      const raw = pJson.profile;
      setProfile(
        raw
          ? {
              logo_url: raw.logo_url ?? null,
              business_name: raw.business_name ?? null,
              sender_email: raw.sender_email ?? null,
              sender_display_name: raw.sender_display_name ?? null,
            }
          : null
      );
    }
  }, [campaignId, t]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : t("loadFailed")));
  }, [load, t]);

  async function uploadLogo(file: File) {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/logo", { method: "POST", body: fd });
      const j = (await res.json()) as { error?: string; logo_url?: string };
      if (!res.ok) throw new Error(j.error ?? t("logoFailed"));
      setProfile((prev) => ({
        business_name: prev?.business_name ?? null,
        logo_url: j.logo_url ?? null,
        sender_email: prev?.sender_email ?? null,
        sender_display_name: prev?.sender_display_name ?? null,
      }));
      setIframeKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("logoFailed"));
    } finally {
      setBusy(false);
    }
  }

  function openPreview(viewport: "desktop" | "mobile") {
    const u = `/api/campaigns/${campaignId}/email-preview?viewport=${viewport}`;
    window.open(u, "_blank", "noopener,noreferrer");
  }

  async function saveTiming() {
    setError(null);
    setBusy(true);
    try {
      let scheduled_at: string | null = null;
      if (!sendNow) {
        if (!scheduledLocal) throw new Error(t("pickDateTime"));
        scheduled_at = new Date(scheduledLocal).toISOString();
      }
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          send_immediately: sendNow,
          scheduled_at: sendNow ? null : scheduled_at,
        }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? t("saveFailed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function launch() {
    setError(null);
    setBusy(true);
    try {
      const pr = await fetch("/api/profile");
      const prj = (await pr.json()) as { profile?: Partial<Profile> };
      const fromLine = formatResendFrom(prj.profile?.sender_email ?? null, prj.profile?.sender_display_name ?? null);
      if (!fromLine) {
        throw new Error(t("senderRequired"));
      }

      let scheduled_at: string | null = null;
      if (!sendNow) {
        if (!scheduledLocal) throw new Error(t("pickDateTime"));
        scheduled_at = new Date(scheduledLocal).toISOString();
      }
      const patch = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          send_immediately: sendNow,
          scheduled_at: sendNow ? null : scheduled_at,
        }),
      });
      const pj = (await patch.json()) as { error?: string };
      if (!patch.ok) throw new Error(pj.error ?? t("saveFailed"));

      const res = await fetch(`/api/campaigns/${campaignId}/finalize`, { method: "POST" });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? t("finalizeFailed"));
      try {
        await fetch("/api/sms/process", { method: "POST" });
      } catch {
        /* dev */
      }
      router.push("/dashboard/campaigns");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("finalizeFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link href={`/dashboard/campaigns/new?id=${campaignId}`} className="text-sm text-ink-muted hover:text-ink">
          {t("backWizard")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("subtitle")}</p>
        {subject ? <p className="mt-2 text-sm font-medium text-ink">{t("subjectLine", { subject })}</p> : null}
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">{t("logoTitle")}</h2>
        <p className="mt-1 text-sm text-ink-muted">{t("logoHint")}</p>
        {profile?.logo_url ? (
          <p className="mt-2 text-xs text-emerald-700">{t("logoOnFile")}</p>
        ) : (
          <p className="mt-2 text-xs text-amber-800">{t("logoMissing")}</p>
        )}
        <label className="mt-4 inline-flex cursor-pointer rounded-lg border border-zinc-200 bg-surface-muted px-4 py-2 text-sm font-medium hover:bg-zinc-100">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void uploadLogo(f);
            }}
          />
          {t("uploadLogo")}
        </label>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">{t("senderBlockTitle")}</h2>
        {profile && formatResendFrom(profile.sender_email, profile.sender_display_name) ? (
          <p className="mt-2 text-sm text-ink">
            {t("senderSummary", {
              from: formatResendFrom(profile.sender_email, profile.sender_display_name) ?? "",
            })}
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-800">{t("senderMissing")}</p>
        )}
        <p className="mt-2 text-xs text-ink-muted">{t("senderBlockHint")}</p>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">{t("previewTitle")}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openPreview("desktop")}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
            >
              {t("openDesktop")}
            </button>
            <button
              type="button"
              onClick={() => openPreview("mobile")}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
            >
              {t("openMobile")}
            </button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">{t("desktop")}</p>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
              <iframe
                key={`d-${iframeKey}`}
                title="Desktop email preview"
                src={desktopSrc}
                className="h-[420px] w-full bg-white"
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">{t("mobile")}</p>
            <div className="mx-auto max-w-[400px] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
              <iframe
                key={`m-${iframeKey}`}
                title="Mobile email preview"
                src={mobileSrc}
                className="h-[420px] w-full bg-white"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-ink">{t("timingTitle")}</h2>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="radio" checked={sendNow} onChange={() => setSendNow(true)} />
          {t("startNow")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={!sendNow} onChange={() => setSendNow(false)} />
          {t("scheduleLater")}
        </label>
        {!sendNow ? (
          <input
            type="datetime-local"
            value={scheduledLocal}
            onChange={(e) => setScheduledLocal(e.target.value)}
            className="mt-2 w-full max-w-xs rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveTiming()}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-50"
          >
            {t("saveTiming")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void launch()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? t("launching") : t("launch")}
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-muted">{t("emailCompliance")}</p>
      </section>
    </div>
  );
}
