import type { EmailFontDefinition } from "../fonts";
import { getEmailStrings } from "../strings";
import { getLayoutStyle, type EmailLayoutStyle } from "../layout-styles";
import { makeLayoutCtx } from "./layout-context";
import type { EmailWeights } from "../typography-emphasis";
import type { ColorTheme } from "../themes";
import type { PromotionalData, RenderResult } from "./types";
import { esc, emailWrapper, sectionDivider } from "./shared";

export function renderPromotional(
  data: PromotionalData,
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights,
  layoutStyle: EmailLayoutStyle = "standard"
): RenderResult {
  const s = getEmailStrings(data.language);
  const ctx = makeLayoutCtx(getLayoutStyle(layoutStyle), theme, font, w);
  const hasProducts = data.products.length > 0;

  const heroInner = `<h1 style="margin:0;color:${ctx.heroTextColor};font-size:${ctx.heroFontSize}px;font-weight:${w.hero};line-height:1.15;letter-spacing:${ctx.heroLetterSpacing};text-align:${ctx.heroAlign};font-family:${font.stackCss};">${esc(data.heroHeadline)}</h1>${
    data.supportingLine
      ? `<p style="margin:16px 0 0;color:${ctx.heroSubColor};font-size:${ctx.heroSubFontSize}px;font-weight:${w.heroSub};line-height:1.5;text-align:${ctx.heroAlign};font-family:${font.stackCss};">${esc(data.supportingLine)}</p>`
      : ""
  }<div style="margin-top:32px;text-align:${ctx.heroAlign};">${ctx.ctaButton(data.ctaText, data.ctaUrl, w.cta)}</div>`;

  const offerRow = data.offerDescription
    ? ctx.offerRow(s.theOffer, data.offerDescription)
    : "";

  const productsHtml = hasProducts ? ctx.productGrid(data.products, s) : "";

  const secondaryCta = hasProducts
    ? `${sectionDivider()}<tr>
    <td style="padding:8px 40px 40px;text-align:center;">
      ${ctx.ctaButton(data.ctaText, data.ctaUrl, w.cta)}
    </td>
  </tr>`
    : "";

  const content = [
    ctx.hero(heroInner, data.heroImageUrl),
    ctx.accentStrip(),
    offerRow,
    productsHtml,
    secondaryCta,
  ].join("\n");

  return {
    html: emailWrapper(content, theme, font, s, data.language, ctx.footerStyle),
    subject: data.subjectLine,
  };
}
