import type { EmailFontDefinition } from "../fonts";
import { getEmailStrings } from "../strings";
import type { EmailWeights } from "../typography-emphasis";
import type { ColorTheme } from "../themes";
import type { PromotionalData, RenderResult } from "./types";
import { esc, emailWrapper, ctaButton, productGrid, heroBannerRow } from "./shared";

export function renderPromotional(
  data: PromotionalData,
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights
): RenderResult {
  const s = getEmailStrings(data.language);
  const hasProducts = data.products.length > 0;

  const heroInner = `<h1 style="margin:0;color:${theme.heroText};font-size:36px;font-weight:${w.hero};line-height:1.15;letter-spacing:-0.5px;">${esc(data.heroHeadline)}</h1>
      ${
        data.supportingLine
          ? `<p style="margin:16px 0 0;color:rgba(255,255,255,0.88);font-size:17px;font-weight:${w.heroSub};line-height:1.5;">${esc(data.supportingLine)}</p>`
          : ""
      }
      <div style="margin-top:32px;">
        ${ctaButton(data.ctaText, data.ctaUrl, theme, font, w.cta)}
      </div>`;

  const heroRow = heroBannerRow(heroInner, theme, data.heroImageUrl);

  const offerRow = data.offerDescription
    ? `<tr>
    <td style="padding:36px 40px;background-color:${theme.bgLight};text-align:center;">
      <p style="margin:0;font-size:14px;font-weight:${w.label};text-transform:uppercase;letter-spacing:1px;color:${theme.accent};">${esc(s.theOffer)}</p>
      <p style="margin:12px 0 0;font-size:17px;color:${theme.text};line-height:1.65;">${esc(data.offerDescription)}</p>
    </td>
  </tr>`
    : "";

  const productsHtml = hasProducts ? productGrid(data.products, theme, font, w, s) : "";

  const secondaryCta = hasProducts
    ? `<tr>
    <td style="padding:8px 40px 40px;text-align:center;">
      ${ctaButton(data.ctaText, data.ctaUrl, theme, font, w.cta)}
    </td>
  </tr>`
    : "";

  const content = [heroRow, offerRow, productsHtml, secondaryCta].join("\n");

  return {
    html: emailWrapper(content, theme, font, s, data.language),
    subject: data.subjectLine,
  };
}
