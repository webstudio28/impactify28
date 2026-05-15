import type { EmailFontDefinition } from "../fonts";
import { getEmailStrings } from "../strings";
import type { EmailWeights } from "../typography-emphasis";
import type { ColorTheme } from "../themes";
import type { ProductLaunchData, RenderResult } from "./types";
import { esc, emailWrapper, ctaButton, sectionDivider } from "./shared";

export function renderProductLaunch(
  data: ProductLaunchData,
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights
): RenderResult {
  const s = getEmailStrings(data.language);
  const heroRow = `<tr>
    <td style="padding:0;position:relative;">
      ${
        data.productImageUrl?.trim()
          ? `<img src="${esc(data.productImageUrl)}" alt="${esc(data.productName)}" width="600" style="display:block;width:100%;max-width:600px;border:0;" />`
          : `<div style="width:100%;height:280px;background-color:${theme.bgLight};display:flex;align-items:center;justify-content:center;"></div>`
      }
      <div style="background-color:${theme.primary};padding:28px 40px;text-align:center;">
        <p style="margin:0;font-size:11px;font-weight:${w.label};text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.7);">${esc(s.newArrival)}</p>
        <h1 style="margin:10px 0 0;color:#ffffff;font-size:28px;font-weight:${w.hero};line-height:1.2;">${esc(data.productName)}</h1>
      </div>
    </td>
  </tr>`;

  const headlineRow = `<tr>
    <td style="padding:40px 40px 20px;text-align:center;">
      <h2 style="margin:0;font-size:24px;font-weight:${w.headline};color:${theme.text};line-height:1.25;">${esc(data.launchHeadline)}</h2>
      <div style="margin-top:24px;">
        ${ctaButton(data.ctaText, data.ctaUrl, theme, font, w.cta)}
      </div>
    </td>
  </tr>`;

  const storyRow = data.story
    ? `${sectionDivider()}
  <tr>
    <td style="padding:36px 40px;text-align:center;">
      <p style="margin:0;font-size:16px;color:${theme.text};line-height:1.75;">${esc(data.story)}</p>
    </td>
  </tr>`
    : "";

  const validFeatures = data.features.filter(Boolean);
  const featuresRow =
    validFeatures.length > 0
      ? `${sectionDivider()}
  <tr>
    <td style="padding:36px 40px;">
      <p style="margin:0 0 20px;font-size:11px;font-weight:${w.label};text-transform:uppercase;letter-spacing:1.5px;color:${theme.accent};">${esc(s.keyFeatures)}</p>
      ${validFeatures
        .map(
          (f) => `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
        <tr>
          <td width="28" valign="top" style="padding-right:12px;">
            <div style="width:24px;height:24px;background-color:${theme.accent};border-radius:50%;text-align:center;line-height:24px;">
              <span style="color:#ffffff;font-size:13px;font-weight:${w.iconMark};">&#10003;</span>
            </div>
          </td>
          <td style="font-size:15px;color:${theme.text};line-height:1.5;">${esc(f)}</td>
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
      <p style="margin:0 0 20px;font-size:11px;font-weight:${w.label};text-transform:uppercase;letter-spacing:1.5px;color:${theme.accent};">${esc(s.whyItMatters)}</p>
      ${validBenefits
        .map(
          (b) => `<p style="margin:0 0 12px;font-size:15px;color:${theme.text};line-height:1.6;padding-left:16px;border-left:3px solid ${theme.accent};">${esc(b)}</p>`
        )
        .join("\n")}
    </td>
  </tr>`
      : "";

  const finalCta = `${sectionDivider()}
  <tr>
    <td style="padding:40px;text-align:center;">
      <h3 style="margin:0 0 20px;font-size:20px;font-weight:${w.subhead};color:${theme.text};">${esc(s.readyToExperience)}</h3>
      ${ctaButton(data.ctaText, data.ctaUrl, theme, font, w.cta)}
    </td>
  </tr>`;

  const content = [heroRow, headlineRow, storyRow, featuresRow, benefitsRow, finalCta].join("\n");

  return {
    html: emailWrapper(content, theme, font, s, data.language),
    subject: data.subjectLine,
  };
}
