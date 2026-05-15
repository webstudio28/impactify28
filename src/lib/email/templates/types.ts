export type EmailTemplateType =
  | "promotional"
  | "product_launch"
  | "seasonal"
  | "discount_coupon";

export type ProductItem = {
  imageUrl: string;
  productUrl: string;
  name: string;
  description: string;
};

export type PromotionalData = {
  templateType: "promotional";
  subjectLine: string;
  language: string;
  heroImageUrl?: string;
  heroHeadline: string;
  supportingLine: string;
  ctaText: string;
  ctaUrl: string;
  offerDescription: string;
  products: ProductItem[];
};

export type ProductLaunchData = {
  templateType: "product_launch";
  subjectLine: string;
  language: string;
  productName: string;
  productImageUrl: string;
  launchHeadline: string;
  ctaText: string;
  ctaUrl: string;
  story: string;
  features: string[];
  benefits: string[];
};

export type SeasonalData = {
  templateType: "seasonal";
  subjectLine: string;
  language: string;
  heroImageUrl?: string;
  seasonalHeadline: string;
  urgencyMessage: string;
  ctaText: string;
  ctaUrl: string;
  countdownText: string;
  offerDescription: string;
  products: ProductItem[];
};

export type DiscountCouponData = {
  templateType: "discount_coupon";
  subjectLine: string;
  language: string;
  heroImageUrl?: string;
  discountAmount: string;
  couponCode: string;
  heroHeadline: string;
  ctaText: string;
  ctaUrl: string;
  redemptionSteps: string[];
  products: ProductItem[];
};

export type EmailTemplateData =
  | PromotionalData
  | ProductLaunchData
  | SeasonalData
  | DiscountCouponData;

export type RenderResult = {
  html: string;
  subject: string;
};
