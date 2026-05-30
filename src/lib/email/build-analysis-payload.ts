import type { EmailTemplateType } from "@/lib/email/templates/types";
import type { ImprovementField } from "@/lib/openai/email-improvements";

export type AnalysisFormFields = {
  subjectLine: string;
  ctaText: string;
  supportingLine: string;
  heroHeadline: string;
  offerDescription: string;
  launchHeadline: string;
  story: string;
  features: string[];
  benefits: string[];
  urgencyMessage: string;
  countdownText: string;
  discountAmount: string;
  couponCode: string;
  redemptionSteps: string[];
};

export function buildPreheaderForAnalysis(templateType: EmailTemplateType, f: AnalysisFormFields): string {
  switch (templateType) {
    case "promotional":
      return f.supportingLine.trim();
    case "seasonal":
      return [f.urgencyMessage, f.countdownText].filter((s) => s.trim()).join(" — ");
    default:
      return "";
  }
}

export function buildBodyTextForAnalysis(
  templateType: EmailTemplateType,
  f: AnalysisFormFields
): string {
  const parts: string[] = [];
  switch (templateType) {
    case "promotional":
      if (f.heroHeadline.trim()) parts.push(f.heroHeadline.trim());
      if (f.offerDescription.trim()) parts.push(f.offerDescription.trim());
      break;
    case "product_launch":
      if (f.launchHeadline.trim()) parts.push(f.launchHeadline.trim());
      if (f.story.trim()) parts.push(f.story.trim());
      parts.push(...f.features.map((x) => x.trim()).filter(Boolean));
      parts.push(...f.benefits.map((x) => x.trim()).filter(Boolean));
      break;
    case "seasonal":
      if (f.heroHeadline.trim()) parts.push(f.heroHeadline.trim());
      if (f.offerDescription.trim()) parts.push(f.offerDescription.trim());
      break;
    case "discount_coupon":
      if (f.discountAmount.trim()) parts.push(`Discount: ${f.discountAmount.trim()}`);
      if (f.couponCode.trim()) parts.push(`Code: ${f.couponCode.trim()}`);
      if (f.heroHeadline.trim()) parts.push(f.heroHeadline.trim());
      parts.push(...f.redemptionSteps.map((x) => x.trim()).filter(Boolean));
      break;
  }
  return parts.join("\n\n");
}

export function buildFieldsForAnalysis(
  templateType: EmailTemplateType,
  f: AnalysisFormFields,
  labels: Partial<Record<ImprovementField, string>>
): { key: ImprovementField; label: string; value: string }[] {
  const common: { key: ImprovementField; label: string; value: string }[] = [
    { key: "subject", label: labels.subject ?? "Subject", value: f.subjectLine },
    { key: "cta", label: labels.cta ?? "CTA", value: f.ctaText },
  ];

  switch (templateType) {
    case "promotional":
      return [
        ...common,
        { key: "heroHeadline", label: labels.heroHeadline ?? "Main headline", value: f.heroHeadline },
        { key: "supportingLine", label: labels.supportingLine ?? "Supporting line", value: f.supportingLine },
        { key: "offerDescription", label: labels.offerDescription ?? "Offer description", value: f.offerDescription },
      ];
    case "product_launch":
      return [
        ...common,
        { key: "launchHeadline", label: labels.launchHeadline ?? "Launch headline", value: f.launchHeadline },
        { key: "story", label: labels.story ?? "Story", value: f.story },
        { key: "redemptionSteps", label: labels.redemptionSteps ?? "Features and benefits", value: [...f.features, ...f.benefits].filter(Boolean).join("\n") },
      ];
    case "seasonal":
      return [
        ...common,
        { key: "heroHeadline", label: labels.heroHeadline ?? "Seasonal headline", value: f.heroHeadline },
        { key: "urgencyMessage", label: labels.urgencyMessage ?? "Urgency message", value: f.urgencyMessage },
        { key: "countdownText", label: labels.countdownText ?? "Countdown text", value: f.countdownText },
        { key: "offerDescription", label: labels.offerDescription ?? "Offer description", value: f.offerDescription },
      ];
    case "discount_coupon":
      return [
        ...common,
        { key: "discountAmount", label: labels.discountAmount ?? "Discount amount", value: f.discountAmount },
        { key: "couponCode", label: labels.couponCode ?? "Coupon code", value: f.couponCode },
        { key: "heroHeadline", label: labels.heroHeadline ?? "Headline", value: f.heroHeadline },
        { key: "redemptionSteps", label: labels.redemptionSteps ?? "Redemption steps", value: f.redemptionSteps.filter(Boolean).join("\n") },
      ];
  }
}
