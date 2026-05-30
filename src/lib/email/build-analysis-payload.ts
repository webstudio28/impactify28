import type { EmailTemplateType } from "@/lib/email/templates/types";

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

export function buildPreheaderForAnalysis(
  templateType: EmailTemplateType,
  f: AnalysisFormFields
): string {
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
