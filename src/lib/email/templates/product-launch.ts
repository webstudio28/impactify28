import type { EmailFontDefinition } from "../fonts";
import { getEmailStrings } from "../strings";
import { getLayoutStyle, type EmailLayoutStyle } from "../layout-styles";
import { makeLayoutCtx } from "./layout-context";
import type { EmailWeights } from "../typography-emphasis";
import type { ColorTheme } from "../themes";
import type { ProductLaunchData, RenderResult } from "./types";
import { esc, emailWrapper, sectionDivider, EMAIL_H1_CLASS, EMAIL_H2_CLASS, EMAIL_H3_CLASS } from "./shared";

export function renderProductLaunch(
  data: ProductLaunchData,
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights,
  layoutStyle: EmailLayoutStyle = "standard"
): RenderResult {
  const s = getEmailStrings(data.language);
  const ctx = makeLayoutCtx(getLayoutStyle(layoutStyle), theme, font, w);
  const ff = font.stackCss;

  // Product launch has a unique hero: full-width product image + colored name band below
  const heroBandBg = layoutStyle === "spotlight" ? "#0d0d0d" : theme.primary;
  const heroRow = `<tr>
    <td style="padding:0;position:relative;">
      ${
        data.productImageUrl?.trim()
          ? `<img src="${esc(data.productImageUrl)}" alt="${esc(data.productName)}" width="600" style="display:block;width:100%;max-width:600px;border:0;" />`
          : `<div style="width:100%;height:280px;background-color:${theme.bgLight};"></div>`
      }
      <div style="background-color:${heroBandBg};padding:28px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;font-weight:${w.label};text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.7);font-family:${ff};">${esc(s.newArrival)}</p>
        <h1 class="${EMAIL_H1_CLASS}" style="margin:10px 0 0;color:#ffffff;font-size:${layoutStyle === "dark" ? "34" : "28"}px;font-weight:${w.hero};line-height:1.2;font-family:${ff};">${esc(data.productName)}</h1>
      </div>
    </td>
  </tr>`;

  const accentStrip = ctx.accentStrip();

  const headlineRow = `<tr>
    <td style="padding:40px 40px 20px;text-align:center;">
      <h2 class="${EMAIL_H2_CLASS}" style="margin:0;font-size:${layoutStyle === "dark" ? "28" : "24"}px;font-weight:${w.headline};color:${theme.text};line-height:1.25;font-family:${ff};">${esc(data.launchHeadline)}</h2>
      <div style="margin-top:24px;">
        ${ctx.ctaButton(data.ctaText, data.ctaUrl, w.cta)}
      </div>
    </td>
  </tr>`;

  const storyRow = data.story
    ? `${sectionDivider()}
  <tr>
    <td style="padding:36px 40px;text-align:center;background-color:${layoutStyle === "split" ? "#ffffff" : layoutStyle === "dark" ? "#111111" : "#ffffff"};">
      <p style="margin:0;font-size:16px;color:${theme.text};line-height:1.75;font-family:${ff};">${esc(data.story)}</p>
    </td>
  </tr>`
    : "";

  const validFeatures = data.features.filter(Boolean);
  const featuresRow =
    validFeatures.length > 0
      ? `${sectionDivider()}
  <tr>
    <td style="padding:36px ${layoutStyle === "paper" ? "48" : "40"}px;">
      <p style="margin:0 0 20px;font-size:11px;font-weight:${w.label};text-transform:uppercase;letter-spacing:1.5px;color:${theme.accent};${layoutStyle === "paper" ? "border-left:4px solid " + theme.accent + ";padding-left:16px;" : ""}font-family:${ff};">${esc(s.keyFeatures)}</p>
      ${validFeatures
        .map(
          (f) => `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
        <tr>
          <td width="28" valign="top" style="padding-right:12px;">
            <div style="width:24px;height:24px;background-color:${theme.accent};border-radius:50%;text-align:center;line-height:24px;">
              <span style="color:#ffffff;font-size:13px;font-weight:${w.iconMark};">&#10003;</span>
            </div>
          </td>
          <td style="font-size:15px;color:${theme.text};line-height:1.5;font-family:${ff};">${esc(f)}</td>
        </tr>
      </table>`
        )
        .join("\n")}
    </td>
  </tr>`
      : "";

  const validBenefits = data.benefits.filter(Boolean);
  const benefitsRow =
    validBenefits.length > 0
      ? `${sectionDivider()}
  <tr>
    <td style="padding:36px 40px;background-color:${theme.bgLight};">
      <p style="margin:0 0 20px;font-size:11px;font-weight:${w.label};text-transform:uppercase;letter-spacing:1.5px;color:${theme.accent};font-family:${ff};">${esc(s.whyItMatters)}</p>
      ${validBenefits
        .map(
          (b) => `<p style="margin:0 0 12px;font-size:15px;color:${theme.text};line-height:1.6;padding-left:16px;border-left:3px solid ${theme.accent};font-family:${ff};">${esc(b)}</p>`
        )
        .join("\n")}
    </td>
  </tr>`
      : "";

  const finalCta = `${sectionDivider()}
  <tr>
    <td style="padding:40px;text-align:center;">
      <h3 class="${EMAIL_H3_CLASS}" style="margin:0 0 20px;font-size:20px;font-weight:${w.subhead};color:${theme.text};font-family:${ff};">${esc(s.readyToExperience)}</h3>
      ${ctx.ctaButton(data.ctaText, data.ctaUrl, w.cta)}
    </td>
  </tr>`;

  const content = [heroRow, accentStrip, headlineRow, storyRow, featuresRow, benefitsRow, finalCta].join("\n");

  return {
    html: emailWrapper(content, theme, font, s, data.language, ctx.footerStyle),
    subject: data.subjectLine,
  };
}
