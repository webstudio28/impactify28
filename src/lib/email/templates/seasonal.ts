import type { EmailFontDefinition } from "../fonts";
import type { EmailWeights } from "../typography-emphasis";
import type { ColorTheme } from "../themes";
import type { SeasonalData, RenderResult } from "./types";
import { esc, emailWrapper, ctaButton, productGrid, sectionDivider } from "./shared";

export function renderSeasonal(
  data: SeasonalData,
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights
): RenderResult {
  const heroRow = `<tr>
    <td style="background-color:${theme.primary};padding:56px 40px;text-align:center;">
      <h1 style="margin:0;color:${theme.heroText};font-size:38px;font-weight:${w.hero};line-height:1.15;letter-spacing:-0.5px;">${esc(data.seasonalHeadline)}</h1>
      ${
        data.urgencyMessage
          ? `<p style="margin:16px 0 0;color:rgba(255,255,255,0.88);font-size:18px;font-weight:${w.heroSub};line-height:1.4;">${esc(data.urgencyMessage)}</p>`
          : ""
      }
      <div style="margin-top:32px;">
        ${ctaButton(data.ctaText, data.ctaUrl, theme, font, w.cta)}
      </div>
    </td>
  </tr>`;

  const urgencyBlockRow = data.countdownText
    ? `<tr>
    <td style="padding:24px 40px;background-color:${theme.accent};text-align:center;">
      <p style="margin:0;font-size:15px;font-weight:${w.countdown};color:#ffffff;letter-spacing:0.3px;">${esc(data.countdownText)}</p>
    </td>
  </tr>`
    : "";

  const offerRow = data.offerDescription
    ? `${sectionDivider()}
  <tr>
    <td style="padding:36px 40px;text-align:center;background-color:${theme.bgLight};">
      <p style="margin:0;font-size:13px;font-weight:${w.label};text-transform:uppercase;letter-spacing:1.5px;color:${theme.accent};">This Season&rsquo;s Deal</p>
      <p style="margin:12px 0 0;font-size:17px;color:${theme.text};line-height:1.65;">${esc(data.offerDescription)}</p>
    </td>
  </tr>`
    : "";

  const hasProducts = data.products.length > 0;
  const productsHtml = hasProducts ? productGrid(data.products, theme, font, w) : "";

  const secondaryCta = hasProducts
    ? `<tr>
    <td style="padding:8px 40px 40px;text-align:center;">
      ${ctaButton(data.ctaText, data.ctaUrl, theme, font, w.cta)}
    </td>
  </tr>`
    : "";

  const content = [heroRow, urgencyBlockRow, offerRow, productsHtml, secondaryCta].join("\n");

  return {
    html: emailWrapper(content, theme, font),
    subject: data.subjectLine,
  };
}
