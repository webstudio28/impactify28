/**
 * Scoped weight presets for template email: affects heroes, CTAs, and labels —
 * not a global "all bold" toggle.
 */
export type EmailEmphasisPreset = "balanced" | "bold";

export const EMAIL_EMPHASIS_PRESETS: readonly EmailEmphasisPreset[] = ["bold", "balanced"];

export const DEFAULT_EMAIL_EMPHASIS_PRESET: EmailEmphasisPreset = "bold";

export type EmailWeights = {
  hero: number;
  /** Large secondary headline (e.g. product launch) */
  headline: number;
  subhead: number;
  cta: number;
  label: number;
  productName: number;
  productLink: number;
  /** Subcopy on colored hero (supporting / urgency) */
  heroSub: number;
  countdown: number;
  closingLine: number;
  stepBadge: number;
  couponCode: number;
  /** Small UI marks (checkmarks in feature list) */
  iconMark: number;
};

export function getEmphasisPreset(key: string | null | undefined): EmailEmphasisPreset {
  if (key === "balanced") return "balanced";
  return "bold";
}

export function getEmailWeights(preset: EmailEmphasisPreset): EmailWeights {
  if (preset === "balanced") {
    return {
      hero: 700,
      headline: 700,
      subhead: 600,
      cta: 600,
      label: 600,
      productName: 600,
      productLink: 600,
      heroSub: 400,
      countdown: 600,
      closingLine: 400,
      stepBadge: 700,
      couponCode: 700,
      iconMark: 600,
    };
  }
  return {
    hero: 900,
    headline: 800,
    subhead: 700,
    cta: 700,
    label: 700,
    productName: 700,
    productLink: 700,
    heroSub: 600,
    countdown: 700,
    closingLine: 600,
    stepBadge: 900,
    couponCode: 900,
    iconMark: 700,
  };
}
