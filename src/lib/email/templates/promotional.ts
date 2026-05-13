import type { ColorTheme } from "../themes";
import type { PromotionalData, RenderResult } from "./types";
import { esc, emailWrapper, ctaButton, productGrid } from "./shared";

export function renderPromotional(data: PromotionalData, theme: ColorTheme): RenderResult {
  const hasProducts = data.products.length > 0;

  const heroRow = `<tr>
    <td style="background-color:${theme.primary};padding:56px 40px;text-align:center;">
      <h1 style="margin:0;color:${theme.heroText};font-size:36px;font-weight:900;line-height:1.15;letter-spacing:-0.5px;">${esc(data.heroHeadline)}</h1>
      ${data.supportingLine ? `<p style="margin:16px 0 0;color:rgba(255,255,255,0.88);font-size:17px;line-height:1.5;">${esc(data.supportingLine)}</p>` : ""}
      <div style="margin-top:32px;">
        ${ctaButton(data.ctaText, data.ctaUrl, theme)}
      </div>
    </td>
  </tr>`;

  const offerRow = data.offerDescription
    ? `<tr>
    <td style="padding:36px 40px;background-color:${theme.bgLight};text-align:center;">
      <p style="margin:0;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${theme.accent};">The Offer</p>
      <p style="margin:12px 0 0;font-size:17px;color:${theme.text};line-height:1.65;">${esc(data.offerDescription)}</p>
    </td>
  </tr>`
    : "";

  const productsHtml = hasProducts ? productGrid(data.products, theme) : "";

  const secondaryCta = hasProducts
    ? `<tr>
    <td style="padding:8px 40px 40px;text-align:center;">
      ${ctaButton(data.ctaText, data.ctaUrl, theme)}
    </td>
  </tr>`
    : "";

  const content = [heroRow, offerRow, productsHtml, secondaryCta].join("\n");

  return {
    html: emailWrapper(content, theme),
    subject: data.subjectLine,
  };
}
