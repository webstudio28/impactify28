import type { EmailFontDefinition } from "../fonts";
import { getEmailStrings } from "../strings";
import type { EmailWeights } from "../typography-emphasis";
import type { ColorTheme } from "../themes";
import type { DiscountCouponData, RenderResult } from "./types";
import { esc, emailWrapper, ctaButton, productGrid, sectionDivider, heroBannerRow } from "./shared";

export function renderDiscountCoupon(
  data: DiscountCouponData,
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights
): RenderResult {
  const s = getEmailStrings(data.language);
  const heroTitle = data.heroHeadline.trim() || s.discountOff(data.discountAmount);
  const heroInner = `<p style="margin:0;font-size:12px;font-weight:${w.label};text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.7);">${esc(s.exclusiveOffer)}</p>
      <h1 style="margin:12px 0 0;color:${theme.heroText};font-size:42px;font-weight:${w.hero};line-height:1.1;letter-spacing:-1px;">${esc(heroTitle)}</h1>
      <div style="margin:28px auto 0;display:inline-block;background-color:rgba(255,255,255,0.12);border:2px dashed rgba(255,255,255,0.5);border-radius:8px;padding:14px 32px;">
        <p style="margin:0;font-size:11px;font-weight:${w.label};text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.7);">${esc(s.useCode)}</p>
        <p style="margin:6px 0 0;font-size:28px;font-weight:${w.couponCode};color:#ffffff;letter-spacing:4px;font-family:'Courier New',monospace;">${esc(data.couponCode)}</p>
      </div>
      <div style="margin-top:32px;">
        ${ctaButton(data.ctaText, data.ctaUrl, theme, font, w.cta)}
      </div>`;

  const heroRow = heroBannerRow(heroInner, theme, data.heroImageUrl);

  const validSteps = data.redemptionSteps.filter(Boolean);
  const stepsRow =
    validSteps.length > 0
      ? `${sectionDivider()}
  <tr>
    <td style="padding:36px 40px;background-color:${theme.bgLight};">
      <p style="margin:0 0 24px;font-size:13px;font-weight:${w.label};text-transform:uppercase;letter-spacing:1.5px;color:${theme.accent};text-align:center;">${esc(s.howToRedeem)}</p>
      ${validSteps
        .map(
          (step, idx) => `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
        <tr>
          <td width="40" valign="top" style="padding-right:16px;">
            <div style="width:36px;height:36px;background-color:${theme.primary};border-radius:50%;text-align:center;line-height:36px;">
              <span style="color:#ffffff;font-size:16px;font-weight:${w.stepBadge};">${idx + 1}</span>
            </div>
          </td>
          <td valign="middle" style="font-size:15px;color:${theme.text};line-height:1.5;padding-top:8px;">${esc(step)}</td>
        </tr>
      </table>`
        )
        .join("\n")}
    </td>
  </tr>`
      : "";

  const hasProducts = data.products.length > 0;
  const productsHtml = hasProducts ? productGrid(data.products, theme, font, w, s) : "";

  const finalCta = `${sectionDivider()}
  <tr>
    <td style="padding:36px 40px;text-align:center;">
      <p style="margin:0 0 20px;font-size:16px;color:${theme.text};font-weight:${w.closingLine};">${esc(s.dontLetOfferSlip)}</p>
      ${ctaButton(data.ctaText, data.ctaUrl, theme, font, w.cta)}
      <p style="margin:16px 0 0;font-size:13px;color:${theme.textMuted};">${s.useCodeAtCheckout(esc(data.couponCode))}</p>
    </td>
  </tr>`;

  const content = [heroRow, stepsRow, productsHtml, finalCta].join("\n");

  return {
    html: emailWrapper(content, theme, font, s, data.language),
    subject: data.subjectLine,
  };
}
