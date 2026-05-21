import type { EmailFontDefinition } from "../fonts";
import type { EmailStrings } from "../strings";
import { emailHtmlLang } from "../strings";
import type { EmailWeights } from "../typography-emphasis";
import type { ColorTheme } from "../themes";
import type { ProductItem } from "./types";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Classes for responsive title sizing — paired with emailResponsiveStyles() in the wrapper. */
export const EMAIL_H1_CLASS = "email-title email-h1";
export const EMAIL_H2_CLASS = "email-title email-h2";
export const EMAIL_H3_CLASS = "email-title email-h3";
export const EMAIL_HERO_SUB_CLASS = "email-hero-sub";
export const EMAIL_COUPON_CODE_CLASS = "email-coupon-code";
export const EMAIL_PRODUCT_TITLE_CLASS = "email-product-title";

function emailResponsiveStyles(): string {
  return `<style type="text/css">
@media only screen and (max-width: 600px) {
  .email-h1 { font-size: 28px !important; line-height: 1.15 !important; letter-spacing: -0.3px !important; }
  .email-h2 { font-size: 22px !important; line-height: 1.25 !important; letter-spacing: -0.2px !important; }
  .email-h3 { font-size: 18px !important; line-height: 1.3 !important; }
  .email-hero-sub { font-size: 15px !important; line-height: 1.45 !important; }
  .email-coupon-code { font-size: 22px !important; letter-spacing: 2px !important; }
  .email-product-title { font-size: 13px !important; line-height: 1.3 !important; }
  .email-hero-pad { padding: 40px 24px !important; }
  .email-hero-pad-tall { padding: 56px 24px !important; }
}
</style>`;
}

export function emailWrapper(
  content: string,
  theme: ColorTheme,
  font: EmailFontDefinition,
  strings: EmailStrings,
  language: string,
  footerStyle: "light" | "dark" = "light"
): string {
  const ff = font.stackCss;
  const lang = emailHtmlLang(language);
  const isDark = footerStyle === "dark";
  const outerBg = isDark ? "#0a0a0a" : theme.bg;
  const innerBg = isDark ? "#0c0c0c" : "#ffffff";
  const tableStyle = isDark
    ? `max-width:600px;width:100%;background-color:${innerBg};font-family:${ff};`
    : `max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);font-family:${ff};`;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Email</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="${font.googleFontsCssHref}" />
  ${emailResponsiveStyles()}
</head>
<body style="margin:0;padding:0;background-color:${outerBg};font-family:${ff};-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${outerBg};font-family:${ff};">
    <tr>
      <td align="center" style="padding:32px 16px;font-family:${ff};">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="${tableStyle}">
          {{COMPANY_LOGO}}
          ${content}
          ${emailFooter(theme, ff, strings, footerStyle)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function emailFooter(
  theme: ColorTheme,
  fontFamily: string,
  strings: EmailStrings,
  footerStyle: "light" | "dark"
): string {
  if (footerStyle === "dark") {
    return `<tr>
    <td style="background-color:#0d0d0d;padding:28px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.08);font-family:${fontFamily};">
      <p style="margin:0;font-size:12px;font-family:${fontFamily};">
        <a href="#" style="color:rgba(255,255,255,0.65);text-decoration:underline;">${esc(strings.unsubscribe)}</a>
        &nbsp;&middot;&nbsp;
        <a href="#" style="color:rgba(255,255,255,0.65);text-decoration:underline;">${esc(strings.viewInBrowser)}</a>
      </p>
    </td>
  </tr>`;
  }
  return `<tr>
    <td style="background-color:${theme.bgLight};padding:28px 40px;text-align:center;border-top:1px solid rgba(0,0,0,0.06);font-family:${fontFamily};">
      <p style="margin:0;font-size:12px;color:${theme.textMuted};font-family:${fontFamily};">
        <a href="#" style="color:${theme.accent};text-decoration:underline;">${esc(strings.unsubscribe)}</a>
        &nbsp;&middot;&nbsp;
        <a href="#" style="color:${theme.accent};text-decoration:underline;">${esc(strings.viewInBrowser)}</a>
      </p>
    </td>
  </tr>`;
}

export function logoRow(): string {
  return `<tr>
    <td style="padding:24px 40px;background-color:#ffffff;border-bottom:1px solid rgba(0,0,0,0.06);">
      {{COMPANY_LOGO_INLINE}}
    </td>
  </tr>`;
}

export function sectionDivider(): string {
  return `<tr><td style="height:1px;background-color:rgba(0,0,0,0.06);"></td></tr>`;
}

// ── Kept as utilities for product-launch template ─────────────────────────────

export function ctaButton(
  text: string,
  url: string,
  theme: ColorTheme,
  font: EmailFontDefinition,
  ctaWeight: number
): string {
  const ff = font.stackCss;
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td style="background-color:${theme.accent};border-radius:6px;">
        <a href="${esc(url)}" target="_blank" style="display:inline-block;padding:14px 36px;color:#ffffff;text-decoration:none;font-weight:${ctaWeight};font-size:15px;letter-spacing:0.3px;font-family:${ff};">${esc(text)}</a>
      </td>
    </tr>
  </table>`;
}

export function productGrid(
  products: ProductItem[],
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights,
  strings: EmailStrings
): string {
  if (!products.length) return "";
  const ff = font.stackCss;
  const rows: string[] = [];
  for (let i = 0; i < products.length; i += 2) {
    const left = products[i]!;
    const right = products[i + 1];
    rows.push(`<tr>
      <td style="padding:0 8px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${productCell(left, theme, font, w, strings, ff)}
            <td width="4%" style="padding:0;"></td>
            ${right ? productCell(right, theme, font, w, strings, ff) : '<td width="48%"></td>'}
          </tr>
        </table>
      </td>
    </tr>`);
  }
  return `<tr>
    <td style="padding:32px 32px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows.join("\n")}
      </table>
    </td>
  </tr>`;
}

function productCell(
  p: ProductItem,
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights,
  strings: EmailStrings,
  ff: string
): string {
  const img = p.imageUrl?.trim()
    ? `<a href="${esc(p.productUrl)}" target="_blank"><img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="100%" style="display:block;border:0;border-radius:6px;max-width:100%;" /></a>`
    : `<div style="width:100%;height:140px;background-color:${theme.bgLight};border-radius:6px;"></div>`;
  return `<td width="48%" valign="top" style="vertical-align:top;font-family:${ff};">
    ${img}
    <p class="${EMAIL_PRODUCT_TITLE_CLASS}" style="margin:10px 0 4px;font-weight:${w.productName};color:${theme.text};font-size:14px;line-height:1.3;font-family:${ff};">${esc(p.name)}</p>
    <p style="margin:0 0 8px;color:${theme.textMuted};font-size:13px;line-height:1.5;font-family:${ff};">${esc(p.description)}</p>
    <a href="${esc(p.productUrl)}" target="_blank" style="color:${theme.accent};font-size:13px;font-weight:${w.productLink};text-decoration:none;font-family:${ff};">${esc(strings.shopNow)}</a>
  </td>`;
}
