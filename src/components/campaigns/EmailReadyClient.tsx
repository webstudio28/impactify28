"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { formatResendFrom } from "@/lib/email/resend-from";
import { COLOR_THEMES, THEME_KEYS, DEFAULT_THEME_KEY, type ThemeKey } from "@/lib/email/themes";
import { EMAIL_FONTS, EMAIL_FONT_KEYS, DEFAULT_EMAIL_FONT_KEY, type EmailFontKey } from "@/lib/email/fonts";
import {
  DEFAULT_EMAIL_EMPHASIS_PRESET,
  EMAIL_EMPHASIS_PRESETS,
  type EmailEmphasisPreset,
} from "@/lib/email/typography-emphasis";
import {
  EMAIL_LAYOUT_STYLES,
  DEFAULT_EMAIL_LAYOUT_STYLE,
  type EmailLayoutStyle,
} from "@/lib/email/layout-styles";

type Profile = {
  logo_url: string | null;
  business_name: string | null;
  sender_email: string | null;
  sender_display_name: string | null;
};

function ReadyLayoutPreviewIcon({ layoutKey, selected }: { layoutKey: EmailLayoutStyle; selected: boolean }) {
  const accent = selected ? "#6366f1" : "#94a3b8";
  const line = selected ? "#c7d2fe" : "#e2e8f0";
  const dark = "#0d0d0d";
  if (layoutKey === "standard") return (
    <svg width="40" height="54" viewBox="0 0 40 54" fill="none"><rect width="40" height="54" rx="3" fill="#f8fafc"/><rect width="40" height="20" rx="3" fill={accent}/><rect x="8" y="6" width="24" height="4" rx="1.5" fill="white" opacity=".9"/><rect x="12" y="12" width="16" height="3" rx="1" fill="white" opacity=".6"/><rect x="4" y="24" width="32" height="3" rx="1" fill={line}/><rect x="6" y="30" width="13" height="12" rx="1.5" fill={line}/><rect x="21" y="30" width="13" height="12" rx="1.5" fill={line}/><rect x="4" y="45" width="32" height="2.5" rx="1" fill={line}/><rect x="8" y="49" width="24" height="2" rx="1" fill={line} opacity=".5"/></svg>
  );
  if (layoutKey === "editorial") return (
    <svg width="40" height="54" viewBox="0 0 40 54" fill="none"><rect width="40" height="54" rx="3" fill="#f8fafc"/><rect width="40" height="20" rx="3" fill={accent}/><rect x="4" y="6" width="18" height="4" rx="1.5" fill="white" opacity=".9"/><rect x="4" y="12" width="12" height="2.5" rx="1" fill="white" opacity=".6"/><rect x="0" y="24" width="4" height="22" fill={accent}/><rect x="7" y="27" width="9" height="7" rx="1" fill={line}/><rect x="18" y="27" width="18" height="2.5" rx="1" fill={line}/><rect x="18" y="31" width="14" height="2" rx="1" fill={line} opacity=".5"/><rect x="7" y="38" width="9" height="7" rx="1" fill={line}/><rect x="18" y="38" width="18" height="2.5" rx="1" fill={line}/><rect x="4" y="49" width="32" height="2" rx="1" fill={line} opacity=".4"/></svg>
  );
  if (layoutKey === "minimal") return (
    <svg width="40" height="54" viewBox="0 0 40 54" fill="none"><rect width="40" height="54" rx="3" fill="#f8fafc"/><rect width="40" height="4" rx="2" fill={accent}/><rect x="8" y="8" width="24" height="5" rx="1.5" fill="#1e293b" opacity=".8"/><rect x="12" y="15" width="16" height="2.5" rx="1" fill="#94a3b8"/><rect x="13" y="20" width="14" height="5" rx="2" fill="none" stroke={accent} strokeWidth="1"/><rect x="0" y="29" width="40" height="1" fill={line}/><rect x="6" y="33" width="13" height="11" rx="1.5" fill={line}/><rect x="21" y="33" width="13" height="11" rx="1.5" fill={line}/><rect x="0" y="48" width="40" height="1" fill={line}/></svg>
  );
  if (layoutKey === "bold") return (
    <svg width="40" height="54" viewBox="0 0 40 54" fill="none"><rect width="40" height="54" rx="3" fill="#f8fafc"/><rect width="40" height="26" rx="3" fill={accent}/><rect x="6" y="5" width="28" height="7" rx="2" fill="white" opacity=".9"/><rect x="10" y="14" width="20" height="3" rx="1" fill="white" opacity=".6"/><rect x="0" y="26" width="40" height="5" fill={selected ? "#818cf8" : "#94a3b8"}/><rect x="4" y="35" width="32" height="2.5" rx="1" fill={line}/><rect x="6" y="40" width="13" height="8" rx="1" fill={line}/><rect x="21" y="40" width="13" height="8" rx="1" fill={line}/></svg>
  );
  return (
    <svg width="40" height="54" viewBox="0 0 40 54" fill="none"><rect width="40" height="54" rx="3" fill="#f8fafc"/><rect width="40" height="24" rx="3" fill={dark}/><rect x="8" y="6" width="24" height="5" rx="1.5" fill="white" opacity=".9"/><rect x="12" y="13" width="16" height="3" rx="1" fill="white" opacity=".55"/><rect x="0" y="24" width="40" height="3" fill={accent}/><rect x="4" y="30" width="32" height="2.5" rx="1" fill={line}/><rect x="6" y="35" width="13" height="11" rx="1.5" fill={line}/><rect x="21" y="35" width="13" height="11" rx="1.5" fill={line}/><rect x="0" y="49" width="40" height="5" rx="3" fill={dark}/></svg>
  );
}

export function EmailReadyClient({ campaignId }: { campaignId: string }) {
  const t = useTranslations("emailReady");
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subject, setSubject] = useState("");
  const [colorTheme, setColorTheme] = useState<ThemeKey>(DEFAULT_THEME_KEY);
  const [emailFont, setEmailFont] = useState<EmailFontKey>(DEFAULT_EMAIL_FONT_KEY);
  const [emailEmphasis, setEmailEmphasis] = useState<EmailEmphasisPreset>(DEFAULT_EMAIL_EMPHASIS_PRESET);
  const [emailLayout, setEmailLayout] = useState<EmailLayoutStyle>(DEFAULT_EMAIL_LAYOUT_STYLE);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [hasTemplateData, setHasTemplateData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const [fontSaving, setFontSaving] = useState(false);
  const [emphasisSaving, setEmphasisSaving] = useState(false);
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
      campaign: {
        email_subject?: string | null;
        email_color_theme?: string | null;
        email_font_family?: string | null;
        email_emphasis_preset?: string | null;
        email_layout_style?: string | null;
        email_template_data?: Record<string, unknown> | null;
      };
    };
    setSubject(typeof cJson.campaign.email_subject === "string" ? cJson.campaign.email_subject : "");
    setHasTemplateData(!!cJson.campaign.email_template_data);
    if (
      typeof cJson.campaign.email_color_theme === "string" &&
      cJson.campaign.email_color_theme in COLOR_THEMES
    ) {
      setColorTheme(cJson.campaign.email_color_theme as ThemeKey);
    }
    if (
      typeof cJson.campaign.email_font_family === "string" &&
      cJson.campaign.email_font_family.trim() &&
      cJson.campaign.email_font_family in EMAIL_FONTS
    ) {
      setEmailFont(cJson.campaign.email_font_family as EmailFontKey);
    } else {
      setEmailFont(DEFAULT_EMAIL_FONT_KEY);
    }
    if (
      typeof cJson.campaign.email_emphasis_preset === "string" &&
      (cJson.campaign.email_emphasis_preset === "balanced" || cJson.campaign.email_emphasis_preset === "bold")
    ) {
      setEmailEmphasis(cJson.campaign.email_emphasis_preset);
    } else {
      setEmailEmphasis(DEFAULT_EMAIL_EMPHASIS_PRESET);
    }
    const ls = cJson.campaign.email_layout_style as EmailLayoutStyle | undefined;
    if (ls && EMAIL_LAYOUT_STYLES.includes(ls)) {
      setEmailLayout(ls);
    } else {
      setEmailLayout(DEFAULT_EMAIL_LAYOUT_STYLE);
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

  async function selectTheme(key: ThemeKey) {
    if (key === colorTheme || themeSaving || fontSaving || emphasisSaving) return;
    setColorTheme(key);
    setThemeSaving(true);
    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_color_theme: key }),
      });
      setIframeKey((k) => k + 1);
    } catch {
      /* non-critical */
    } finally {
      setThemeSaving(false);
    }
  }

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

  async function selectEmailFont(key: EmailFontKey) {
    if (key === emailFont || fontSaving || themeSaving || emphasisSaving) return;
    setEmailFont(key);
    setFontSaving(true);
    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_font_family: key }),
      });
      setIframeKey((k) => k + 1);
    } catch {
      /* non-critical */
    } finally {
      setFontSaving(false);
    }
  }

  async function selectEmailEmphasis(key: EmailEmphasisPreset) {
    if (key === emailEmphasis || emphasisSaving || themeSaving || fontSaving) return;
    setEmailEmphasis(key);
    setEmphasisSaving(true);
    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_emphasis_preset: key }),
      });
      setIframeKey((k) => k + 1);
    } catch {
      /* non-critical */
    } finally {
      setEmphasisSaving(false);
    }
  }

  async function selectEmailLayout(key: EmailLayoutStyle) {
    if (key === emailLayout || layoutSaving) return;
    setEmailLayout(key);
    setLayoutSaving(true);
    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_layout_style: key }),
      });
      setIframeKey((k) => k + 1);
    } catch {
      /* non-critical */
    } finally {
      setLayoutSaving(false);
    }
  }

  function openPreview(viewport: "desktop" | "mobile") {
    const u = `/api/campaigns/${campaignId}/email-preview?viewport=${viewport}`;
    window.open(u, "_blank", "noopener,noreferrer");
  }

  async function submitForApproval() {
    setError(null);
    setBusy(true);
    try {
      const pr = await fetch("/api/profile");
      const prj = (await pr.json()) as { profile?: Partial<Profile> };
      const fromLine = formatResendFrom(prj.profile?.sender_email ?? null, prj.profile?.sender_display_name ?? null);
      if (!fromLine) throw new Error(t("senderRequired"));

      const res = await fetch(`/api/campaigns/${campaignId}/finalize`, { method: "POST" });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? t("finalizeFailed"));
      try { await fetch("/api/sms/process", { method: "POST" }); } catch { /* dev */ }
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

      {/* Color theme + typography + emphasis — only when template data exists */}
      {hasTemplateData && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm space-y-6">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            <div>
              <h2 className="text-sm font-semibold text-ink">{t("themeTitle")}</h2>
              <p className="mt-1 text-sm text-ink-muted">{t("themeHint")}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {THEME_KEYS.map((key) => {
                  const theme = COLOR_THEMES[key];
                  const selected = colorTheme === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      title={theme.label}
                      disabled={themeSaving || fontSaving || emphasisSaving}
                      onClick={() => void selectTheme(key)}
                      className={`group flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition ${
                        selected
                          ? "border-accent shadow-md"
                          : "border-transparent hover:border-zinc-300"
                      }`}
                    >
                      <div className="flex gap-0.5 overflow-hidden rounded-full shadow-sm">
                        <div className="h-6 w-6" style={{ backgroundColor: theme.primary }} />
                        <div className="h-6 w-6" style={{ backgroundColor: theme.accent }} />
                        <div className="h-6 w-6" style={{ backgroundColor: theme.bg }} />
                      </div>
                      <span
                        className={`max-w-[72px] text-center text-[10px] leading-tight ${
                          selected ? "font-semibold text-ink" : "text-ink-muted"
                        }`}
                      >
                        {theme.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-6 lg:border-t-0 lg:border-l lg:border-zinc-100 lg:pt-0 lg:pl-8">
              <h2 className="text-sm font-semibold text-ink">{t("fontTitle")}</h2>
              <p className="mt-1 text-sm text-ink-muted">{t("fontHint")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {EMAIL_FONT_KEYS.map((key) => {
                  const def = EMAIL_FONTS[key];
                  const selected = emailFont === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      title={def.label}
                      disabled={themeSaving || fontSaving || emphasisSaving}
                      onClick={() => void selectEmailFont(key)}
                      className={`flex min-w-[5.5rem] flex-col items-center gap-0.5 rounded-lg border-2 px-2 py-2 transition ${
                        selected ? "border-accent bg-accent/5 shadow-md" : "border-transparent hover:border-zinc-300"
                      }`}
                    >
                      <span
                        className={`text-sm font-semibold leading-none ${selected ? "text-ink" : "text-ink-muted"}`}
                        style={{ fontFamily: def.stackCss }}
                      >
                        Aa Бг
                      </span>
                      <span
                        className={`max-w-[88px] text-center text-[10px] leading-tight ${
                          selected ? "font-semibold text-ink" : "text-ink-muted"
                        }`}
                      >
                        {def.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-5">
            <h2 className="text-sm font-semibold text-ink">{t("emphasisTitle")}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t("emphasisHint")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {EMAIL_EMPHASIS_PRESETS.map((key) => {
                const selected = emailEmphasis === key;
                const label = key === "bold" ? t("emphasisBold") : t("emphasisBalanced");
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={themeSaving || fontSaving || emphasisSaving}
                    onClick={() => void selectEmailEmphasis(key)}
                    className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition ${
                      selected
                        ? "border-accent bg-accent/5 text-ink shadow-sm"
                        : "border-transparent bg-zinc-50 text-ink-muted hover:border-zinc-300 hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Layout picker */}
          <div className="border-t border-zinc-100 pt-5">
            <h2 className="text-sm font-semibold text-ink">{t("layoutTitle")}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t("layoutHint")}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {EMAIL_LAYOUT_STYLES.map((key) => {
                const selected = emailLayout === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={layoutSaving}
                    onClick={() => void selectEmailLayout(key)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition ${
                      selected ? "border-accent shadow-md" : "border-transparent hover:border-zinc-300"
                    }`}
                  >
                    <ReadyLayoutPreviewIcon layoutKey={key} selected={selected} />
                    <span className={`text-[10px] leading-tight font-medium ${selected ? "text-ink" : "text-ink-muted"}`}>
                      {t(`layout_${key}` as "layout_standard")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {(themeSaving || fontSaving || emphasisSaving || layoutSaving) && (
            <p className="text-xs text-ink-muted">
              {themeSaving ? t("themeSaving") : fontSaving ? t("fontSaving") : layoutSaving ? t("layoutSaving") : t("emphasisSaving")}
            </p>
          )}
        </section>
      )}

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
            <button type="button" onClick={() => openPreview("desktop")} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-surface-muted">
              {t("openDesktop")}
            </button>
            <button type="button" onClick={() => openPreview("mobile")} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-surface-muted">
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
        <p className="text-sm text-ink-muted">{t("submitModerationHint")}</p>
        <div className="mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitForApproval()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? t("submitting") : t("submitForApproval")}
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-muted">{t("emailCompliance")}</p>
      </section>
    </div>
  );
}
