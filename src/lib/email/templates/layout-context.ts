import type { EmailFontDefinition } from "../fonts";
import type { EmailStrings } from "../strings";
import type { EmailLayoutStyle } from "../layout-styles";
import type { EmailWeights } from "../typography-emphasis";
import type { ColorTheme } from "../themes";
import type { ProductItem } from "./types";
import { esc, sectionDivider } from "./shared";

// ── Public context type ───────────────────────────────────────────────────────

export type EmailLayoutCtx = {
  style: EmailLayoutStyle;
  /** Text color for hero h1 */
  heroTextColor: string;
  /** Text color for hero supporting line */
  heroSubColor: string;
  /** Horizontal alignment of hero text */
  heroAlign: "left" | "center";
  /** Font size (px) for the hero h1 */
  heroFontSize: number;
  /** Font size (px) for the hero supporting line */
  heroSubFontSize: number;
  /** letter-spacing for hero h1 */
  heroLetterSpacing: string;
  /** Wraps the hero inner HTML in layout-specific chrome */
  hero(inner: string, heroImageUrl?: string | null): string;
  /** Accent strip between hero and content (bold/spotlight) */
  accentStrip(): string;
  /** Offer / generic text section row */
  offerRow(labelRaw: string, contentRaw: string): string;
  /** Full product grid rows */
  productGrid(products: ProductItem[], strings: EmailStrings): string;
  /** CTA button table HTML */
  ctaButton(text: string, url: string, weight: number): string;
  /** Footer background style — "dark" only for spotlight */
  footerStyle: "light" | "dark";
};

// ── Factory ────────────────────────────────────────────────────────────────────

export function makeLayoutCtx(
  style: EmailLayoutStyle,
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights
): EmailLayoutCtx {
  const ff = font.stackCss;

  // ── Standard ────────────────────────────────────────────────────────────────
  if (style === "standard") {
    return {
      style,
      heroTextColor: theme.heroText,
      heroSubColor: "rgba(255,255,255,0.88)",
      heroAlign: "center",
      heroFontSize: 36,
      heroSubFontSize: 17,
      heroLetterSpacing: "-0.5px",
      hero(inner, heroImageUrl) {
        const url = heroImageUrl?.trim();
        if (url) {
          const su = esc(url);
          return `<tr>
    <td background="${su}" bgcolor="${theme.primary}" style="background-color:${theme.primary};background-image:url('${su}');background-size:cover;background-position:center center;background-repeat:no-repeat;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;">
        <tr><td style="background-color:rgba(0,0,0,0.55);padding:56px 40px;text-align:center;font-family:${ff};">${inner}</td></tr>
      </table>
    </td>
  </tr>`;
        }
        return `<tr><td style="background-color:${theme.primary};padding:56px 40px;text-align:center;font-family:${ff};">${inner}</td></tr>`;
      },
      accentStrip() { return ""; },
      offerRow(labelRaw, contentRaw) {
        return `<tr>
    <td style="padding:36px 40px;background-color:${theme.bgLight};text-align:center;font-family:${ff};">
      <p style="margin:0;font-size:14px;font-weight:${w.label};text-transform:uppercase;letter-spacing:1px;color:${theme.accent};font-family:${ff};">${esc(labelRaw)}</p>
      <p style="margin:12px 0 0;font-size:17px;color:${theme.text};line-height:1.65;font-family:${ff};">${esc(contentRaw)}</p>
    </td>
  </tr>`;
      },
      productGrid(products, strings) {
        return twoColGrid(products, theme, font, w, strings, standardCell);
      },
      ctaButton(text, url, weight) {
        return solidCta(text, url, theme.accent, "#ffffff", font, weight, "6px", "14px 36px", "15px", "0.3px", "none");
      },
      footerStyle: "light",
    };
  }

  // ── Editorial — left-aligned text, horizontal product rows ──────────────────
  if (style === "editorial") {
    return {
      style,
      heroTextColor: theme.heroText,
      heroSubColor: "rgba(255,255,255,0.85)",
      heroAlign: "left",
      heroFontSize: 38,
      heroSubFontSize: 17,
      heroLetterSpacing: "-0.5px",
      hero(inner, heroImageUrl) {
        const url = heroImageUrl?.trim();
        if (url) {
          const su = esc(url);
          return `<tr>
    <td background="${su}" bgcolor="${theme.primary}" style="background-color:${theme.primary};background-image:url('${su}');background-size:cover;background-position:center top;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr><td style="background-color:rgba(0,0,0,0.60);padding:68px 48px;text-align:left;font-family:${ff};">${inner}</td></tr>
      </table>
    </td>
  </tr>`;
        }
        return `<tr><td style="background-color:${theme.primary};padding:68px 48px;text-align:left;font-family:${ff};">${inner}</td></tr>`;
      },
      accentStrip() { return ""; },
      offerRow(labelRaw, contentRaw) {
        return `${sectionDivider()}<tr>
    <td style="padding:36px 48px;background-color:#ffffff;font-family:${ff};">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="border-left:4px solid ${theme.accent};padding-left:20px;">
            <p style="margin:0;font-size:11px;font-weight:${w.label};text-transform:uppercase;letter-spacing:2px;color:${theme.accent};font-family:${ff};">${esc(labelRaw)}</p>
            <p style="margin:10px 0 0;font-size:17px;color:${theme.text};line-height:1.7;font-family:${ff};">${esc(contentRaw)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
      },
      productGrid(products, strings) {
        return editorialGrid(products, theme, font, w, strings);
      },
      ctaButton(text, url, weight) {
        return solidCta(text, url, theme.accent, "#ffffff", font, weight, "6px", "14px 36px", "15px", "0.3px", "none");
      },
      footerStyle: "light",
    };
  }

  // ── Minimal — white hero, outlined CTA, no heavy color blocks ───────────────
  if (style === "minimal") {
    return {
      style,
      heroTextColor: theme.text,
      heroSubColor: theme.textMuted,
      heroAlign: "center",
      heroFontSize: 38,
      heroSubFontSize: 18,
      heroLetterSpacing: "-0.3px",
      hero(inner, _heroImageUrl) {
        // Minimal intentionally ignores hero image — purity of whitespace
        return `<tr>
    <td style="background-color:#ffffff;border-top:5px solid ${theme.primary};padding:64px 40px 56px;text-align:center;font-family:${ff};">
      ${inner}
    </td>
  </tr>`;
      },
      accentStrip() {
        return `<tr><td style="height:1px;background-color:rgba(0,0,0,0.08);"></td></tr>`;
      },
      offerRow(labelRaw, contentRaw) {
        return `<tr>
    <td style="padding:40px 40px;background-color:#ffffff;text-align:center;font-family:${ff};">
      <p style="margin:0;font-size:11px;font-weight:${w.label};text-transform:uppercase;letter-spacing:2px;color:${theme.primary};font-family:${ff};">${esc(labelRaw)}</p>
      <p style="margin:14px 0 0;font-size:17px;color:${theme.text};line-height:1.7;font-family:${ff};">${esc(contentRaw)}</p>
    </td>
  </tr>`;
      },
      productGrid(products, strings) {
        return twoColGrid(products, theme, font, w, strings, minimalCell);
      },
      ctaButton(text, url, weight) {
        return outlinedCta(text, url, theme.accent, font, weight);
      },
      footerStyle: "light",
    };
  }

  // ── Bold — oversized hero, accent strip, white cards on gray ────────────────
  if (style === "bold") {
    return {
      style,
      heroTextColor: theme.heroText,
      heroSubColor: "rgba(255,255,255,0.90)",
      heroAlign: "center",
      heroFontSize: 52,
      heroSubFontSize: 20,
      heroLetterSpacing: "-1.5px",
      hero(inner, heroImageUrl) {
        const url = heroImageUrl?.trim();
        if (url) {
          const su = esc(url);
          return `<tr>
    <td background="${su}" bgcolor="${theme.primary}" style="background-color:${theme.primary};background-image:url('${su}');background-size:cover;background-position:center;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr><td style="background-color:rgba(0,0,0,0.50);padding:88px 48px;text-align:center;font-family:${ff};">${inner}</td></tr>
      </table>
    </td>
  </tr>`;
        }
        return `<tr><td style="background-color:${theme.primary};padding:88px 48px;text-align:center;font-family:${ff};">${inner}</td></tr>`;
      },
      accentStrip() {
        return `<tr><td style="background-color:${theme.accent};height:8px;"></td></tr>`;
      },
      offerRow(labelRaw, contentRaw) {
        return `<tr>
    <td style="padding:40px 48px;background-color:#f5f5f5;text-align:center;font-family:${ff};">
      <p style="margin:0;font-size:12px;font-weight:${w.label};text-transform:uppercase;letter-spacing:2.5px;color:${theme.accent};font-family:${ff};">${esc(labelRaw)}</p>
      <p style="margin:14px 0 0;font-size:19px;color:${theme.text};line-height:1.6;font-weight:500;font-family:${ff};">${esc(contentRaw)}</p>
    </td>
  </tr>`;
      },
      productGrid(products, strings) {
        return boldGrid(products, theme, font, w, strings);
      },
      ctaButton(text, url, weight) {
        return solidCta(text, url, theme.accent, "#ffffff", font, weight, "4px", "16px 48px", "14px", "1.5px", "uppercase");
      },
      footerStyle: "light",
    };
  }

  // ── Spotlight — always-dark hero, thin accent, premium product cards ─────────
  const DARK = "#0d0d0d";
  return {
    style: "spotlight" as EmailLayoutStyle,
    heroTextColor: "#ffffff",
    heroSubColor: "rgba(255,255,255,0.78)",
    heroAlign: "center",
    heroFontSize: 40,
    heroSubFontSize: 18,
    heroLetterSpacing: "-0.5px",
    hero(inner, heroImageUrl) {
      const url = heroImageUrl?.trim();
      if (url) {
        const su = esc(url);
        return `<tr>
    <td background="${su}" bgcolor="${DARK}" style="background-color:${DARK};background-image:url('${su}');background-size:cover;background-position:center;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
        <tr><td style="background-color:rgba(0,0,0,0.68);padding:72px 48px;text-align:center;font-family:${ff};">${inner}</td></tr>
      </table>
    </td>
  </tr>`;
      }
      return `<tr><td style="background-color:${DARK};padding:72px 48px;text-align:center;font-family:${ff};">${inner}</td></tr>`;
    },
    accentStrip() {
      return `<tr><td style="background-color:${theme.primary};height:3px;"></td></tr>`;
    },
    offerRow(labelRaw, contentRaw) {
      return `${sectionDivider()}<tr>
    <td style="padding:40px 48px;background-color:#ffffff;text-align:center;font-family:${ff};">
      <p style="margin:0;font-size:11px;font-weight:${w.label};text-transform:uppercase;letter-spacing:2px;color:${theme.primary};font-family:${ff};">${esc(labelRaw)}</p>
      <p style="margin:14px 0 0;font-size:17px;color:${theme.text};line-height:1.7;font-family:${ff};">${esc(contentRaw)}</p>
    </td>
  </tr>`;
    },
    productGrid(products, strings) {
      return twoColGrid(products, theme, font, w, strings, (p, t2, f2, w2, s2) =>
        spotlightCell(p, t2, f2, w2, s2, theme.primary)
      );
    },
    ctaButton(text, url, weight) {
      return solidCta(text, url, theme.primary, "#ffffff", font, weight, "6px", "14px 36px", "15px", "0.3px", "none");
    },
    footerStyle: "dark",
  };
}

// ── Button helpers ────────────────────────────────────────────────────────────

function solidCta(
  text: string,
  url: string,
  bg: string,
  color: string,
  font: EmailFontDefinition,
  weight: number,
  radius: string,
  padding: string,
  fontSize: string,
  letterSpacing: string,
  textTransform: string
): string {
  const ff = font.stackCss;
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td style="background-color:${bg};border-radius:${radius};">
        <a href="${esc(url)}" target="_blank" style="display:inline-block;padding:${padding};color:${color};text-decoration:none;font-weight:${weight};font-size:${fontSize};letter-spacing:${letterSpacing};text-transform:${textTransform};font-family:${ff};">${esc(text)}</a>
      </td>
    </tr>
  </table>`;
}

function outlinedCta(
  text: string,
  url: string,
  color: string,
  font: EmailFontDefinition,
  weight: number
): string {
  const ff = font.stackCss;
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr>
      <td style="border:2px solid ${color};border-radius:6px;">
        <a href="${esc(url)}" target="_blank" style="display:inline-block;padding:12px 34px;color:${color};text-decoration:none;font-weight:${weight};font-size:15px;letter-spacing:0.3px;font-family:${ff};">${esc(text)}</a>
      </td>
    </tr>
  </table>`;
}

// ── Product grid helpers ──────────────────────────────────────────────────────

type CellFn = (p: ProductItem, theme: ColorTheme, font: EmailFontDefinition, w: EmailWeights, strings: EmailStrings) => string;

function twoColGrid(
  products: ProductItem[],
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights,
  strings: EmailStrings,
  cellFn: CellFn
): string {
  if (!products.length) return "";
  const rows: string[] = [];
  for (let i = 0; i < products.length; i += 2) {
    const left = products[i]!;
    const right = products[i + 1];
    rows.push(`<tr>
      <td style="padding:0 8px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${cellFn(left, theme, font, w, strings)}
            <td width="4%" style="padding:0;"></td>
            ${right ? cellFn(right, theme, font, w, strings) : '<td width="48%"></td>'}
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

function standardCell(p: ProductItem, theme: ColorTheme, font: EmailFontDefinition, w: EmailWeights, strings: EmailStrings): string {
  const ff = font.stackCss;
  const img = p.imageUrl?.trim()
    ? `<a href="${esc(p.productUrl)}" target="_blank"><img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="100%" style="display:block;border:0;border-radius:6px;max-width:100%;" /></a>`
    : `<div style="width:100%;height:140px;background-color:${theme.bgLight};border-radius:6px;"></div>`;
  return `<td width="48%" valign="top" style="vertical-align:top;font-family:${ff};">
    ${img}
    <p style="margin:10px 0 4px;font-weight:${w.productName};color:${theme.text};font-size:14px;line-height:1.3;font-family:${ff};">${esc(p.name)}</p>
    <p style="margin:0 0 8px;color:${theme.textMuted};font-size:13px;line-height:1.5;font-family:${ff};">${esc(p.description)}</p>
    <a href="${esc(p.productUrl)}" target="_blank" style="color:${theme.accent};font-size:13px;font-weight:${w.productLink};text-decoration:none;font-family:${ff};">${esc(strings.shopNow)}</a>
  </td>`;
}

function minimalCell(p: ProductItem, theme: ColorTheme, font: EmailFontDefinition, w: EmailWeights, strings: EmailStrings): string {
  const ff = font.stackCss;
  const img = p.imageUrl?.trim()
    ? `<a href="${esc(p.productUrl)}" target="_blank"><img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="100%" style="display:block;border:0;border-radius:4px;max-width:100%;" /></a>`
    : `<div style="width:100%;height:140px;background-color:#f0f0f0;border-radius:4px;"></div>`;
  return `<td width="48%" valign="top" style="vertical-align:top;font-family:${ff};">
    ${img}
    <p style="margin:12px 0 4px;font-weight:${w.productName};color:${theme.text};font-size:14px;line-height:1.3;font-family:${ff};">${esc(p.name)}</p>
    <p style="margin:0 0 8px;color:${theme.textMuted};font-size:13px;line-height:1.5;font-family:${ff};">${esc(p.description)}</p>
    <a href="${esc(p.productUrl)}" target="_blank" style="color:${theme.accent};font-size:13px;font-weight:${w.productLink};text-decoration:none;font-family:${ff};">${esc(strings.shopNow)}</a>
  </td>`;
}

function spotlightCell(p: ProductItem, theme: ColorTheme, font: EmailFontDefinition, w: EmailWeights, strings: EmailStrings, accentColor: string): string {
  const ff = font.stackCss;
  const img = p.imageUrl?.trim()
    ? `<a href="${esc(p.productUrl)}" target="_blank"><img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="100%" style="display:block;border:0;border-radius:8px;max-width:100%;" /></a>`
    : `<div style="width:100%;height:140px;background-color:#f0f0f0;border-radius:8px;"></div>`;
  return `<td width="48%" valign="top" style="vertical-align:top;font-family:${ff};">
    ${img}
    <p style="margin:0;border-top:2px solid ${accentColor};padding-top:10px;margin-top:10px;font-weight:${w.productName};color:${theme.text};font-size:14px;line-height:1.3;font-family:${ff};">${esc(p.name)}</p>
    <p style="margin:4px 0 8px;color:${theme.textMuted};font-size:13px;line-height:1.5;font-family:${ff};">${esc(p.description)}</p>
    <a href="${esc(p.productUrl)}" target="_blank" style="color:${accentColor};font-size:13px;font-weight:${w.productLink};text-decoration:none;font-family:${ff};">${esc(strings.shopNow)}</a>
  </td>`;
}

function editorialGrid(products: ProductItem[], theme: ColorTheme, font: EmailFontDefinition, w: EmailWeights, strings: EmailStrings): string {
  if (!products.length) return "";
  const ff = font.stackCss;
  const rows = products.map((p, i) => {
    const img = p.imageUrl?.trim()
      ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="100%" style="display:block;border:0;border-radius:8px;max-width:100%;" />`
      : `<div style="width:100%;height:120px;background-color:${theme.bgLight};border-radius:8px;"></div>`;
    return `${i > 0 ? sectionDivider() : ""}<tr>
      <td style="padding:${i === 0 ? "32px" : "24px"} 48px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="36%" valign="top" style="vertical-align:top;padding-right:20px;">${img}</td>
            <td width="64%" valign="middle" style="vertical-align:middle;font-family:${ff};">
              <p style="margin:0 0 6px;font-weight:${w.productName};color:${theme.text};font-size:15px;line-height:1.3;font-family:${ff};">${esc(p.name)}</p>
              <p style="margin:0 0 12px;color:${theme.textMuted};font-size:13px;line-height:1.55;font-family:${ff};">${esc(p.description)}</p>
              <a href="${esc(p.productUrl)}" target="_blank" style="color:${theme.accent};font-size:13px;font-weight:${w.productLink};text-decoration:none;font-family:${ff};">${esc(strings.shopNow)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  });
  return rows.join("\n");
}

function boldGrid(products: ProductItem[], theme: ColorTheme, font: EmailFontDefinition, w: EmailWeights, strings: EmailStrings): string {
  if (!products.length) return "";
  const ff = font.stackCss;
  const rows: string[] = [];
  for (let i = 0; i < products.length; i += 2) {
    const left = products[i]!;
    const right = products[i + 1];
    rows.push(`<tr>
      <td style="padding:0 8px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${boldCell(left, theme, font, w, strings, ff)}
            <td width="4%" style="padding:0;"></td>
            ${right ? boldCell(right, theme, font, w, strings, ff) : '<td width="48%"></td>'}
          </tr>
        </table>
      </td>
    </tr>`);
  }
  return `<tr>
    <td style="padding:32px 32px 12px;background-color:#f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows.join("\n")}
      </table>
    </td>
  </tr>`;
}

function boldCell(p: ProductItem, theme: ColorTheme, font: EmailFontDefinition, w: EmailWeights, strings: EmailStrings, ff: string): string {
  const img = p.imageUrl?.trim()
    ? `<a href="${esc(p.productUrl)}" target="_blank"><img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="100%" style="display:block;border:0;border-radius:6px;max-width:100%;" /></a>`
    : `<div style="width:100%;height:140px;background-color:${theme.bgLight};border-radius:6px;"></div>`;
  return `<td width="48%" valign="top" style="vertical-align:top;background-color:#ffffff;border-radius:8px;padding:16px;font-family:${ff};">
    ${img}
    <p style="margin:12px 0 4px;font-weight:${Math.min(w.productName + 100, 900)};color:${theme.text};font-size:15px;line-height:1.3;font-family:${ff};">${esc(p.name)}</p>
    <p style="margin:0 0 10px;color:${theme.textMuted};font-size:13px;line-height:1.5;font-family:${ff};">${esc(p.description)}</p>
    <a href="${esc(p.productUrl)}" target="_blank" style="color:${theme.accent};font-size:12px;font-weight:${w.productLink};text-decoration:none;text-transform:uppercase;letter-spacing:0.5px;font-family:${ff};">${esc(strings.shopNow)}</a>
  </td>`;
}
