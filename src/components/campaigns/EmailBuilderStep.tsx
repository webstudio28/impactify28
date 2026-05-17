"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { renderEmailTemplate } from "@/lib/email/templates/render";
import { injectLogoIntoHtml } from "@/lib/openai/generate-campaign-email";
import { wrapEmailPreviewDocument } from "@/lib/email/preview-document";
import { COLOR_THEMES, THEME_KEYS, DEFAULT_THEME_KEY, type ThemeKey } from "@/lib/email/themes";
import { EMAIL_FONTS, EMAIL_FONT_KEYS, DEFAULT_EMAIL_FONT_KEY, getEmailFont, type EmailFontKey } from "@/lib/email/fonts";
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
import type { EmailTemplateData, EmailTemplateType, ProductItem } from "@/lib/email/templates/types";
import { getEmailPrefillFields, PREFILL_SENDER } from "@/lib/email/email-prefill";
import { ProductsEditor, ListEditor } from "./EmailFormHelpers";

const TEMPLATE_CONFIGS: Record<EmailTemplateType, { maxProducts: number; hasProducts: boolean }> = {
  promotional: { maxProducts: 4, hasProducts: true },
  product_launch: { maxProducts: 0, hasProducts: false },
  seasonal: { maxProducts: 4, hasProducts: true },
  discount_coupon: { maxProducts: 3, hasProducts: true },
};

type FormFields = {
  subjectLine: string;
  language: string;
  ctaText: string;
  ctaUrl: string;
  heroHeadline: string;
  supportingLine: string;
  offerDescription: string;
  products: ProductItem[];
  productName: string;
  productImageUrl: string;
  launchHeadline: string;
  story: string;
  features: string[];
  benefits: string[];
  urgencyMessage: string;
  countdownText: string;
  discountAmount: string;
  couponCode: string;
  redemptionSteps: string[];
  heroImageUrl: string;
};

function defaultFields(): FormFields {
  return {
    subjectLine: "",
    language: "en",
    ctaText: "",
    ctaUrl: "",
    heroHeadline: "",
    supportingLine: "",
    offerDescription: "",
    products: [],
    productName: "",
    productImageUrl: "",
    launchHeadline: "",
    story: "",
    features: ["", "", ""],
    benefits: ["", ""],
    urgencyMessage: "",
    countdownText: "",
    discountAmount: "",
    couponCode: "",
    redemptionSteps: ["", "", ""],
    heroImageUrl: "",
  };
}

function heroImageFromData(data: EmailTemplateData): string {
  if (data.templateType === "product_launch") return "";
  return data.heroImageUrl?.trim() ?? "";
}

function fieldsFromData(data: EmailTemplateData): FormFields {
  const base = defaultFields();
  base.subjectLine = data.subjectLine;
  base.language = data.language;
  base.ctaText = data.ctaText;
  base.ctaUrl = data.ctaUrl;
  switch (data.templateType) {
    case "promotional":
      return {
        ...base,
        heroImageUrl: heroImageFromData(data),
        heroHeadline: data.heroHeadline,
        supportingLine: data.supportingLine,
        offerDescription: data.offerDescription,
        products: data.products,
      };
    case "product_launch":
      return { ...base, productName: data.productName, productImageUrl: data.productImageUrl, launchHeadline: data.launchHeadline, story: data.story, features: data.features.length ? data.features : ["", "", ""], benefits: data.benefits.length ? data.benefits : ["", ""] };
    case "seasonal":
      return {
        ...base,
        heroImageUrl: heroImageFromData(data),
        heroHeadline: data.seasonalHeadline,
        urgencyMessage: data.urgencyMessage,
        countdownText: data.countdownText,
        offerDescription: data.offerDescription,
        products: data.products,
      };
    case "discount_coupon":
      return {
        ...base,
        heroImageUrl: heroImageFromData(data),
        discountAmount: data.discountAmount,
        couponCode: data.couponCode,
        heroHeadline: data.heroHeadline,
        redemptionSteps: data.redemptionSteps.length ? data.redemptionSteps : ["", "", ""],
        products: data.products,
      };
  }
}

function buildTemplateData(type: EmailTemplateType, f: FormFields): EmailTemplateData {
  const base = { subjectLine: f.subjectLine, language: f.language, ctaText: f.ctaText, ctaUrl: f.ctaUrl };
  switch (type) {
    case "promotional":
      return {
        templateType: "promotional",
        ...base,
        ...(f.heroImageUrl.trim() ? { heroImageUrl: f.heroImageUrl.trim() } : {}),
        heroHeadline: f.heroHeadline,
        supportingLine: f.supportingLine,
        offerDescription: f.offerDescription,
        products: f.products,
      };
    case "product_launch":
      return { templateType: "product_launch", ...base, productName: f.productName, productImageUrl: f.productImageUrl, launchHeadline: f.launchHeadline, story: f.story, features: f.features.filter(Boolean), benefits: f.benefits.filter(Boolean) };
    case "seasonal":
      return {
        templateType: "seasonal",
        ...base,
        ...(f.heroImageUrl.trim() ? { heroImageUrl: f.heroImageUrl.trim() } : {}),
        seasonalHeadline: f.heroHeadline,
        urgencyMessage: f.urgencyMessage,
        countdownText: f.countdownText,
        offerDescription: f.offerDescription,
        products: f.products,
      };
    case "discount_coupon":
      return {
        templateType: "discount_coupon",
        ...base,
        ...(f.heroImageUrl.trim() ? { heroImageUrl: f.heroImageUrl.trim() } : {}),
        discountAmount: f.discountAmount,
        couponCode: f.couponCode,
        heroHeadline: f.heroHeadline,
        redemptionSteps: f.redemptionSteps.filter(Boolean),
        products: f.products,
      };
  }
}

function LayoutPreviewIcon({ layoutKey, selected }: { layoutKey: EmailLayoutStyle; selected: boolean }) {
  const accent = selected ? "#6366f1" : "#94a3b8";
  const line = selected ? "#c7d2fe" : "#e2e8f0";
  const dark = "#111111";

  // Standard: centered hero + 2-col product grid
  if (layoutKey === "standard") {
    return (
      <svg width="40" height="54" viewBox="0 0 40 54" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="54" rx="3" fill="#f8fafc" />
        <rect width="40" height="20" rx="3" fill={accent} />
        <rect x="8" y="6" width="24" height="4" rx="1.5" fill="white" opacity="0.9" />
        <rect x="12" y="12" width="16" height="3" rx="1" fill="white" opacity="0.6" />
        <rect x="4" y="24" width="32" height="3" rx="1" fill={line} />
        <rect x="6" y="30" width="13" height="12" rx="1.5" fill={line} />
        <rect x="21" y="30" width="13" height="12" rx="1.5" fill={line} />
        <rect x="4" y="45" width="32" height="2.5" rx="1" fill={line} />
        <rect x="8" y="49" width="24" height="2" rx="1" fill={line} opacity="0.5" />
      </svg>
    );
  }

  // Paper: gradient hero left-aligned + horizontal product rows + dark band
  if (layoutKey === "paper") {
    return (
      <svg width="40" height="54" viewBox="0 0 40 54" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="54" rx="3" fill="#faf8f4" />
        <rect width="40" height="22" rx="3" fill={accent} />
        <rect x="4" y="13" width="20" height="4" rx="1.5" fill="white" opacity="0.9" />
        <rect x="4" y="18" width="13" height="2.5" rx="1" fill="white" opacity="0.6" />
        <rect x="3" y="25" width="7" height="7" rx="1" fill={line} />
        <rect x="13" y="26" width="20" height="2.5" rx="1" fill={line} />
        <rect x="13" y="30" width="14" height="2" rx="1" fill={line} opacity="0.5" />
        <rect x="3" y="35" width="7" height="7" rx="1" fill={line} />
        <rect x="13" y="36" width="20" height="2.5" rx="1" fill={line} />
        <rect x="13" y="40" width="14" height="2" rx="1" fill={line} opacity="0.5" />
        <rect width="40" height="7" rx="3" fill={dark} y="47" />
      </svg>
    );
  }

  // Dark Drop: all-dark, centered big text, accent strip, flush dark cards
  if (layoutKey === "dark") {
    return (
      <svg width="40" height="54" viewBox="0 0 40 54" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="54" rx="3" fill={dark} />
        <rect width="40" height="22" rx="3" fill="#1a1a1a" />
        <rect x="7" y="7" width="26" height="6" rx="1.5" fill="white" opacity="0.85" />
        <rect x="11" y="15" width="18" height="2.5" rx="1" fill="white" opacity="0.4" />
        <rect width="40" height="3" y="22" fill={accent} />
        <rect x="0" y="27" width="19" height="14" fill="#1e1e1e" />
        <rect x="21" y="27" width="19" height="14" fill="#1e1e1e" />
        <rect x="0" y="43" width="19" height="11" rx="3" fill="#1a1a1a" />
        <rect x="21" y="43" width="19" height="11" rx="3" fill="#1a1a1a" />
      </svg>
    );
  }

  // Clean Split: 50/50 hero (dark left + image right) + 3-col grid
  if (layoutKey === "split") {
    return (
      <svg width="40" height="54" viewBox="0 0 40 54" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="54" rx="3" fill="#f8fafc" />
        <rect width="23" height="22" rx="3" fill={dark} />
        <rect x="23" width="17" height="22" rx="3" fill={accent} opacity="0.7" />
        <rect x="3" y="7" width="16" height="4" rx="1.5" fill="white" opacity="0.9" />
        <rect x="3" y="13" width="11" height="2.5" rx="1" fill="white" opacity="0.55" />
        <rect x="0" y="24" width="40" height="1" fill={line} />
        <rect x="2" y="28" width="11" height="13" rx="1" fill={line} />
        <rect x="15" y="28" width="11" height="13" rx="1" fill={line} />
        <rect x="28" y="28" width="11" height="13" rx="1" fill={line} />
        <rect x="4" y="44" width="32" height="2.5" rx="1" fill={line} opacity="0.5" />
        <rect x="8" y="49" width="24" height="2" rx="1" fill={line} opacity="0.3" />
      </svg>
    );
  }

  // Spotlight: full-bleed photo top, dark text section, 2x2 numbered dark cards
  return (
    <svg width="40" height="54" viewBox="0 0 40 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="54" rx="3" fill="#0c0c0c" />
      <rect width="40" height="20" rx="3" fill={accent} opacity="0.55" />
      <rect width="40" height="7" y="20" fill="#0c0c0c" />
      <rect x="8" y="22" width="24" height="3.5" rx="1" fill="white" opacity="0.8" />
      <rect x="12" y="27" width="16" height="2" rx="1" fill="white" opacity="0.35" />
      <rect width="40" height="3" y="31" fill={accent} />
      <rect x="0" y="34" width="19" height="10" fill="#161616" />
      <rect x="21" y="34" width="19" height="10" fill="#161616" />
      <rect x="0" y="45" width="19" height="9" rx="3" fill="#161616" />
      <rect x="21" y="45" width="19" height="9" rx="3" fill="#161616" />
    </svg>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

type Props = {
  campaignId: string;
  templateType: EmailTemplateType;
  initialData?: EmailTemplateData | null;
  initialColorTheme?: string | null;
  initialEmailFont?: string | null;
  initialEmailEmphasis?: string | null;
  initialEmailLayout?: string | null;
  emailPrefillEnabled?: boolean;
  onBack: () => void;
  onSubmitted: () => void;
};

export function EmailBuilderStep({
  campaignId,
  templateType,
  initialData,
  initialColorTheme,
  initialEmailFont,
  initialEmailEmphasis,
  initialEmailLayout,
  emailPrefillEnabled = false,
  onBack,
  onSubmitted,
}: Props) {
  const t = useTranslations("emailWizard");
  const tReady = useTranslations("emailReady");

  const [fields, setFields] = useState<FormFields>(() => {
    if (initialData) return fieldsFromData(initialData);
    if (emailPrefillEnabled) return getEmailPrefillFields(templateType);
    return defaultFields();
  });
  const [senderEmail, setSenderEmail] = useState(() =>
    emailPrefillEnabled && !initialData ? PREFILL_SENDER.email : ""
  );
  const [senderDisplayName, setSenderDisplayName] = useState(() =>
    emailPrefillEnabled && !initialData ? PREFILL_SENDER.displayName : ""
  );
  const [colorTheme, setColorTheme] = useState<ThemeKey>(() =>
    initialColorTheme && initialColorTheme in COLOR_THEMES
      ? (initialColorTheme as ThemeKey)
      : DEFAULT_THEME_KEY
  );
  const [emailFont, setEmailFont] = useState<EmailFontKey>(() => {
    const k = initialEmailFont?.trim();
    if (k && k in EMAIL_FONTS) return k as EmailFontKey;
    return DEFAULT_EMAIL_FONT_KEY;
  });
  const [emailEmphasis, setEmailEmphasis] = useState<EmailEmphasisPreset>(() => {
    const e = initialEmailEmphasis?.trim();
    if (e === "balanced" || e === "bold") return e;
    return DEFAULT_EMAIL_EMPHASIS_PRESET;
  });
  const [emailLayout, setEmailLayout] = useState<EmailLayoutStyle>(() => {
    const l = initialEmailLayout?.trim() as EmailLayoutStyle | undefined;
    if (l && EMAIL_LAYOUT_STYLES.includes(l)) return l;
    return DEFAULT_EMAIL_LAYOUT_STYLE;
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewHtml, setPreviewHtml] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [heroImageUploading, setHeroImageUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasHeroBanner = templateType !== "product_launch";

  function patch(partial: Partial<FormFields>) {
    setFields((prev) => ({ ...prev, ...partial }));
  }

  // Load sender profile + logo on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/profile");
      if (!res.ok || cancelled) return;
      const j = (await res.json()) as {
        profile?: {
          sender_email?: string | null;
          sender_display_name?: string | null;
          logo_url?: string | null;
        };
      };
      const p = j.profile;
      if (!p || cancelled) return;
      if (p.sender_email?.trim()) setSenderEmail((prev) => (prev.trim() ? prev : p.sender_email!.trim()));
      if (p.sender_display_name?.trim()) setSenderDisplayName((prev) => (prev.trim() ? prev : p.sender_display_name!.trim()));
      if (!cancelled) setLogoUrl(p.logo_url ?? null);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Stable reference to fields for debouncing
  const templateDataForPreview = useMemo(
    () => buildTemplateData(templateType, fields),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templateType, JSON.stringify(fields)]
  );

  const debouncedData = useDebounce(templateDataForPreview, 600);

  // Re-render preview whenever data, theme, logo, viewport, or refresh tick changes
  useEffect(() => {
    try {
      const { html } = renderEmailTemplate(debouncedData, colorTheme, emailFont, emailEmphasis, emailLayout);
      const withLogo = injectLogoIntoHtml(html, logoUrl);
      const fd = getEmailFont(emailFont);
      setPreviewHtml(
        wrapEmailPreviewDocument(withLogo, viewport === "mobile", {
          googleFontsCssHref: fd.googleFontsCssHref,
          stackCss: fd.stackCss,
        })
      );
    } catch {
      // keep previous preview if render fails during partial input
    }
  }, [debouncedData, colorTheme, emailFont, emailEmphasis, emailLayout, logoUrl, viewport, refreshTick]);

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/logo", { method: "POST", body: fd });
      const j = (await res.json()) as { error?: string; logo_url?: string };
      if (!res.ok) throw new Error(j.error ?? tReady("logoFailed"));
      setLogoUrl(j.logo_url ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : tReady("logoFailed"));
    } finally {
      setLogoUploading(false);
    }
  }

  async function uploadHeroImage(file: File) {
    setHeroImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/campaigns/${campaignId}/hero-image`, { method: "POST", body: fd });
      const j = (await res.json()) as { error?: string; hero_image_url?: string };
      if (!res.ok) throw new Error(j.error ?? t("heroImageFailed"));
      patch({ heroImageUrl: j.hero_image_url ?? "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("heroImageFailed"));
    } finally {
      setHeroImageUploading(false);
    }
  }

  async function selectEmailEmphasis(key: EmailEmphasisPreset) {
    setEmailEmphasis(key);
    void fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_emphasis_preset: key }),
    });
  }

  async function selectEmailLayout(key: EmailLayoutStyle) {
    setEmailLayout(key);
    void fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_layout_style: key }),
    });
  }

  async function selectEmailFont(key: EmailFontKey) {
    setEmailFont(key);
    void fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_font_family: key }),
    });
  }

  async function selectTheme(key: ThemeKey) {
    setColorTheme(key);
    // Save async, non-blocking
    void fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_color_theme: key }),
    });
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      // Validate sender
      const se = senderEmail.trim().toLowerCase();
      if (!se || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(se)) throw new Error(t("senderEmailInvalid"));
      // Validate required template fields
      if (!fields.subjectLine.trim()) throw new Error(t("subjectRequired"));
      if (!fields.ctaText.trim()) throw new Error(t("ctaTextRequired"));
      if (!fields.ctaUrl.trim()) throw new Error(t("ctaUrlRequired"));
      if (templateType === "promotional" || templateType === "seasonal") {
        if (!fields.heroHeadline.trim()) throw new Error(t("headlineRequired"));
      }
      if (templateType === "product_launch") {
        if (!fields.productName.trim()) throw new Error(t("productNameRequired"));
        if (!fields.launchHeadline.trim()) throw new Error(t("launchHeadlineRequired"));
      }
      if (templateType === "discount_coupon") {
        if (!fields.discountAmount.trim()) throw new Error(t("discountAmountRequired"));
        if (!fields.couponCode.trim()) throw new Error(t("couponCodeRequired"));
      }

      // Save sender to profile
      const profileRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_email: se, sender_display_name: senderDisplayName.trim() || null }),
      });
      const pj = (await profileRes.json()) as { error?: string };
      if (!profileRes.ok) throw new Error(pj.error ?? t("senderSaveFailed"));

      // Render and save template data + HTML to campaign
      const templateData = buildTemplateData(templateType, fields);
      const genRes = await fetch(`/api/campaigns/${campaignId}/generate-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateData, colorTheme, fontFamily: emailFont, emphasisPreset: emailEmphasis, layoutStyle: emailLayout }),
      });
      const gj = (await genRes.json()) as { error?: string };
      if (!genRes.ok) throw new Error(gj.error ?? t("generateFailed"));

      // Submit for approval
      const finalRes = await fetch(`/api/campaigns/${campaignId}/finalize`, { method: "POST" });
      const fj = (await finalRes.json()) as { error?: string };
      if (!finalRes.ok) throw new Error(fj.error ?? tReady("finalizeFailed"));

      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : tReady("finalizeFailed"));
    } finally {
      setBusy(false);
    }
  }

  const cfg = TEMPLATE_CONFIGS[templateType];

  // â”€â”€ Shared field sections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const senderSection = (
    <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("senderSection")}</p>
      <p className="text-xs text-ink-muted">{t("senderSectionHint")}</p>
      <div>
        <label className="text-xs font-medium text-ink-muted">{t("senderDisplayName")}</label>
        <input value={senderDisplayName} onChange={(e) => setSenderDisplayName(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" placeholder={t("senderDisplayPlaceholder")} maxLength={100} />
      </div>
      <div>
        <label className="text-xs font-medium text-ink-muted">{t("senderEmail")} *</label>
        <input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" placeholder={t("senderEmailPlaceholder")} autoComplete="email" />
      </div>
    </div>
  );

  const commonFields = (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-ink-muted">{t("subjectLine")} *</label>
        <input value={fields.subjectLine} onChange={(e) => patch({ subjectLine: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={t("subjectLinePh")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-ink-muted">{t("ctaText")} *</label>
          <input value={fields.ctaText} onChange={(e) => patch({ ctaText: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={t("ctaTextPh")} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-muted">{t("ctaUrl")} *</label>
          <input value={fields.ctaUrl} onChange={(e) => patch({ ctaUrl: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="https://" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-ink-muted">{t("language")}</label>
        <select value={fields.language} onChange={(e) => patch({ language: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm">
          <option value="en">English</option>
          <option value="bg">Ð‘ÑŠÐ»Ð³Ð°Ñ€ÑÐºÐ¸</option>
          <option value="de">Deutsch</option>
          <option value="fr">FranÃ§ais</option>
        </select>
      </div>
    </div>
  );

  const heroImageSection = (
    <div className="space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("heroImage")}</p>
      <p className="text-xs text-ink-muted">{t("heroImageHint")}</p>
      {fields.heroImageUrl ? (
        <div className="space-y-2">
          <img
            src={fields.heroImageUrl}
            alt=""
            className="h-24 w-full rounded-md border border-zinc-200 object-cover"
          />
          <p className="text-xs text-emerald-700">{t("heroImageOnFile")}</p>
        </div>
      ) : (
        <p className="text-xs text-ink-muted">{t("heroImageEmpty")}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium hover:bg-zinc-100">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            disabled={heroImageUploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void uploadHeroImage(f);
            }}
          />
          {heroImageUploading ? t("heroImageUploading") : t("uploadHeroImage")}
        </label>
        {fields.heroImageUrl ? (
          <button
            type="button"
            onClick={() => patch({ heroImageUrl: "" })}
            disabled={heroImageUploading}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-ink-muted hover:bg-zinc-100 disabled:opacity-40"
          >
            {t("removeHeroImage")}
          </button>
        ) : null}
      </div>
    </div>
  );

  const logoSection = (
    <div className="space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{tReady("logoTitle")}</p>
      <p className="text-xs text-ink-muted">{tReady("logoHint")}</p>
      {logoUrl
        ? <p className="text-xs text-emerald-700">{tReady("logoOnFile")}</p>
        : <p className="text-xs text-amber-800">{tReady("logoMissing")}</p>}
      <label className="mt-2 inline-flex cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium hover:bg-zinc-100">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          disabled={logoUploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void uploadLogo(f);
          }}
        />
        {logoUploading ? "Uploadingâ€¦" : tReady("uploadLogo")}
      </label>
    </div>
  );

  const designPanel = (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-5">
      <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-ink">{tReady("themeTitle")}</p>
          <p className="text-xs text-ink-muted">{tReady("themeHint")}</p>
          <div className="flex flex-wrap gap-2">
            {THEME_KEYS.map((key) => {
              const theme = COLOR_THEMES[key];
              const selected = colorTheme === key;
              return (
                <button
                  key={key}
                  type="button"
                  title={theme.label}
                  onClick={() => void selectTheme(key)}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-1.5 transition ${
                    selected ? "border-accent shadow-sm" : "border-transparent hover:border-zinc-200"
                  }`}
                >
                  <div className="flex overflow-hidden rounded-full shadow-sm">
                    <div className="h-5 w-5" style={{ backgroundColor: theme.primary }} />
                    <div className="h-5 w-5" style={{ backgroundColor: theme.accent }} />
                    <div className="h-5 w-5" style={{ backgroundColor: theme.bg }} />
                  </div>
                  <span className={`max-w-[72px] text-center text-[9px] leading-tight ${selected ? "font-semibold text-ink" : "text-ink-muted"}`}>
                    {theme.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 border-t border-zinc-100 pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6 sm:border-zinc-100">
          <p className="text-xs font-semibold text-ink">{tReady("fontTitle")}</p>
          <p className="text-xs text-ink-muted">{tReady("fontHint")}</p>
          <div className="flex flex-wrap gap-2">
            {EMAIL_FONT_KEYS.map((key) => {
              const def = EMAIL_FONTS[key];
              const selected = emailFont === key;
              return (
                <button
                  key={key}
                  type="button"
                  title={def.label}
                  onClick={() => void selectEmailFont(key)}
                  className={`flex min-w-[5.5rem] flex-col items-center gap-0.5 rounded-lg border-2 px-2 py-1.5 transition ${
                    selected ? "border-accent bg-accent/5 shadow-sm" : "border-transparent hover:border-zinc-200"
                  }`}
                >
                  <span
                    className={`text-[13px] font-semibold leading-none ${selected ? "text-ink" : "text-ink-muted"}`}
                    style={{ fontFamily: def.stackCss }}
                  >
                    Aa Бг
                  </span>
                  <span className={`max-w-[88px] text-center text-[9px] leading-tight ${selected ? "font-medium text-ink" : "text-ink-muted"}`}>
                    {def.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-4">
        <p className="text-xs font-semibold text-ink">{tReady("emphasisTitle")}</p>
        <p className="text-xs text-ink-muted">{tReady("emphasisHint")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EMAIL_EMPHASIS_PRESETS.map((key) => {
            const selected = emailEmphasis === key;
            const label = key === "bold" ? tReady("emphasisBold") : tReady("emphasisBalanced");
            return (
              <button
                key={key}
                type="button"
                onClick={() => void selectEmailEmphasis(key)}
                className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition ${
                  selected
                    ? "border-accent bg-accent/5 text-ink shadow-sm"
                    : "border-transparent bg-zinc-50 text-ink-muted hover:border-zinc-200 hover:text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-4">
        <p className="text-xs font-semibold text-ink">{tReady("layoutTitle")}</p>
        <p className="text-xs text-ink-muted">{tReady("layoutHint")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {EMAIL_LAYOUT_STYLES.map((key) => {
            const selected = emailLayout === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => void selectEmailLayout(key)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition ${
                  selected ? "border-accent shadow-sm" : "border-transparent hover:border-zinc-200"
                }`}
              >
                <LayoutPreviewIcon layoutKey={key} selected={selected} />
                <span className={`text-[9px] leading-tight font-medium ${selected ? "text-ink" : "text-ink-muted"}`}>
                  {tReady(`layout_${key}` as "layout_standard")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[5fr_6fr] lg:items-start">

      <div className="space-y-6 min-w-0">
        {senderSection}
        {commonFields}

        {/* Promotional */}
        {templateType === "promotional" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink-muted">{t("heroHeadline")} *</label>
              <input value={fields.heroHeadline} onChange={(e) => patch({ heroHeadline: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={t("heroHeadlinePh")} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{t("supportingLine")}</label>
              <input value={fields.supportingLine} onChange={(e) => patch({ supportingLine: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={t("supportingLinePh")} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{t("offerDescription")}</label>
              <textarea value={fields.offerDescription} onChange={(e) => patch({ offerDescription: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm resize-none" placeholder={t("offerDescriptionPh")} />
            </div>
            <ProductsEditor products={fields.products} onChange={(p) => patch({ products: p })} max={cfg.maxProducts} tEmail={t as (key: string, values?: Record<string, string | number>) => string} />
          </div>
        )}

        {/* Product Launch */}
        {templateType === "product_launch" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-muted">{t("productName")} *</label>
                <input value={fields.productName} onChange={(e) => patch({ productName: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={t("productNamePh")} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted">{t("productImageUrl")}</label>
                <input value={fields.productImageUrl} onChange={(e) => patch({ productImageUrl: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="https://..." />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{t("launchHeadline")} *</label>
              <input value={fields.launchHeadline} onChange={(e) => patch({ launchHeadline: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={t("launchHeadlinePh")} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{t("story")}</label>
              <textarea value={fields.story} onChange={(e) => patch({ story: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm resize-none" placeholder={t("storyPh")} />
            </div>
            <ListEditor items={fields.features} onChange={(v) => patch({ features: v })} max={5} label={t("features")} placeholder={t("featuresPh")} />
            <ListEditor items={fields.benefits} onChange={(v) => patch({ benefits: v })} max={3} label={t("benefits")} placeholder={t("benefitsPh")} />
          </div>
        )}

        {/* Seasonal */}
        {templateType === "seasonal" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink-muted">{t("seasonalHeadline")} *</label>
              <input value={fields.heroHeadline} onChange={(e) => patch({ heroHeadline: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={t("heroHeadlinePh")} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{t("urgencyMessage")}</label>
              <input value={fields.urgencyMessage} onChange={(e) => patch({ urgencyMessage: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={t("urgencyMessagePh")} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{t("countdownText")}</label>
              <input value={fields.countdownText} onChange={(e) => patch({ countdownText: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={t("countdownTextPh")} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{t("offerDescription")}</label>
              <textarea value={fields.offerDescription} onChange={(e) => patch({ offerDescription: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm resize-none" placeholder={t("offerDescriptionPh")} />
            </div>
            <ProductsEditor products={fields.products} onChange={(p) => patch({ products: p })} max={cfg.maxProducts} tEmail={t as (key: string, values?: Record<string, string | number>) => string} />
          </div>
        )}

        {/* Discount / Coupon */}
        {templateType === "discount_coupon" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-muted">{t("discountAmount")} *</label>
                <input value={fields.discountAmount} onChange={(e) => patch({ discountAmount: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={t("discountAmountPh")} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-muted">{t("couponCode")} *</label>
                <input value={fields.couponCode} onChange={(e) => patch({ couponCode: e.target.value.toUpperCase() })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono" placeholder="SAVE20" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">{t("heroHeadline")}</label>
              <input value={fields.heroHeadline} onChange={(e) => patch({ heroHeadline: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={t("couponHeroHeadlinePh")} />
            </div>
            <ListEditor items={fields.redemptionSteps} onChange={(v) => patch({ redemptionSteps: v })} max={5} label={t("redemptionSteps")} placeholder={t("redemptionStepsPh")} />
            <ProductsEditor products={fields.products} onChange={(p) => patch({ products: p })} max={cfg.maxProducts} tEmail={t as (key: string, values?: Record<string, string | number>) => string} />
          </div>
        )}

        {hasHeroBanner ? heroImageSection : null}

        {logoSection}

        {designPanel}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
          >
            â† Back
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? tReady("submitting") : tReady("submitForApproval")}
          </button>
        </div>
        <p className="text-xs text-ink-muted">{tReady("emailCompliance")}</p>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-4 lg:self-start space-y-4 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewport("desktop")}
              className={`px-3 py-1.5 transition ${viewport === "desktop" ? "bg-ink text-white" : "bg-white text-ink-muted hover:bg-zinc-50"}`}
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setViewport("mobile")}
              className={`px-3 py-1.5 border-l border-zinc-200 transition ${viewport === "mobile" ? "bg-ink text-white" : "bg-white text-ink-muted hover:bg-zinc-50"}`}
            >
              Mobile
            </button>
          </div>
          <button
            type="button"
            title="Refresh preview"
            onClick={() => setRefreshTick((n) => n + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-ink-muted hover:bg-zinc-50 hover:text-ink transition"
          >
            â†º
          </button>
        </div>

        {/* Preview iframe */}
        <div className={`overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm ${viewport === "mobile" ? "mx-auto max-w-[390px]" : ""}`}>
          {previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              title="Email preview"
              className="w-full bg-white"
              style={{ height: "580px", border: "none" }}
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="flex h-[580px] items-center justify-center">
              <p className="text-sm text-ink-muted">Fill in the fields to see a live preview</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
