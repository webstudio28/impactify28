import { getTheme } from "../themes";
import { getEmailFont } from "../fonts";
import { getEmphasisPreset, getEmailWeights } from "../typography-emphasis";
import type { EmailTemplateData, RenderResult } from "./types";
import { renderPromotional } from "./promotional";
import { renderProductLaunch } from "./product-launch";
import { renderSeasonal } from "./seasonal";
import { renderDiscountCoupon } from "./discount-coupon";

export function renderEmailTemplate(
  data: EmailTemplateData,
  themeKey: string | null | undefined,
  fontKey?: string | null | undefined,
  emphasisKey?: string | null | undefined
): RenderResult {
  const theme = getTheme(themeKey);
  const font = getEmailFont(fontKey);
  const weights = getEmailWeights(getEmphasisPreset(emphasisKey));
  switch (data.templateType) {
    case "promotional":
      return renderPromotional(data, theme, font, weights);
    case "product_launch":
      return renderProductLaunch(data, theme, font, weights);
    case "seasonal":
      return renderSeasonal(data, theme, font, weights);
    case "discount_coupon":
      return renderDiscountCoupon(data, theme, font, weights);
  }
}

export function parseTemplateData(raw: unknown): EmailTemplateData | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = o.templateType as string | undefined;
  if (
    type !== "promotional" &&
    type !== "product_launch" &&
    type !== "seasonal" &&
    type !== "discount_coupon"
  ) {
    return null;
  }
  return raw as EmailTemplateData;
}

export type { EmailTemplateData, EmailTemplateType, RenderResult } from "./types";
