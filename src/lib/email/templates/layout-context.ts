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
  heroTextColor: string;
  heroSubColor: string;
  heroAlign: "left" | "center";
  heroFontSize: number;
  heroSubFontSize: number;
  heroLetterSpacing: string;
  hero(inner: string, heroImageUrl?: string | null): string;
  accentStrip(): string;
  offerRow(labelRaw: string, contentRaw: string): string;
  productGrid(products: ProductItem[], strings: EmailStrings): string;
  ctaButton(text: string, url: string, weight: number): string;
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

  // ── Paper — warm editorial magazine ─────────────────────────────────────────
  // Full-bleed hero image with gradient + left-aligned headline.
  // Horizontal thumbnail+text product rows. Dark offer band at bottom.
  if (style === "paper") {
    return {
      style,
      heroTextColor: "#ffffff",
      heroSubColor: "rgba(255,255,255,0.78)",
      heroAlign: "left",
      heroFontSize: 42,
      heroSubFontSize: 16,
      heroLetterSpacing: "-0.5px",
      hero(inner, heroImageUrl) {
        const url = heroImageUrl?.trim();
        if (url) {
          const su = esc(url);
          return `<tr>
    <td background="${su}" bgcolor="${theme.primary}" style="background-color:${theme.primary};background-image:url('${su}');background-size:cover;background-position:center;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="height:140px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="background-color:rgba(10,10,10,0.88);padding:36px 40px;text-align:left;font-family:${ff};">${inner}</td></tr>
      </table>
    </td>
  </tr>`;
        }
        return `<tr><td style="background-color:${theme.primary};padding:56px 40px 36px;text-align:left;font-family:${ff};">${inner}</td></tr>`;
      },
      accentStrip() { return ""; },
      offerRow(labelRaw, contentRaw) {
        return `${sectionDivider()}<tr>
    <td style="padding:36px 40px;background-color:#faf8f4;font-family:${ff};">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="border-left:3px solid ${theme.accent};padding-left:18px;">
            <p style="margin:0;font-size:10px;font-weight:${w.label};text-transform:uppercase;letter-spacing:2.5px;color:${theme.accent};font-family:${ff};">${esc(labelRaw)}</p>
            <p style="margin:10px 0 0;font-size:17px;color:#1a1a1a;line-height:1.7;font-family:${ff};">${esc(contentRaw)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
      },
      productGrid(products, strings) {
        return paperGrid(products, theme, font, w, strings);
      },
      ctaButton(text, url, weight) {
        return solidCta(text, url, "#1a1a1a", "#ffffff", font, weight, "0px", "13px 28px", "11px", "1.5px", "uppercase");
      },
      footerStyle: "light",
    };
  }

  // ── Dark Drop — black canvas, heavy energy ────────────────────────────────
  // All-dark email. Heavy centered hero text over a dark image overlay.
  // Accent strip. Flush dark product cards.
  if (style === "dark") {
    return {
      style,
      heroTextColor: "#ffffff",
      heroSubColor: "rgba(255,255,255,0.62)",
      heroAlign: "center",
      heroFontSize: 54,
      heroSubFontSize: 15,
      heroLetterSpacing: "-1px",
      hero(inner, heroImageUrl) {
        const url = heroImageUrl?.trim();
        if (url) {
          const su = esc(url);
          return `<tr>
    <td background="${su}" bgcolor="#000000" style="background-color:#000000;background-image:url('${su}');background-size:cover;background-position:center;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background-color:rgba(0,0,0,0.72);padding:72px 48px;text-align:center;font-family:${ff};">${inner}</td></tr>
      </table>
    </td>
  </tr>`;
        }
        return `<tr><td bgcolor="#000000" style="background-color:#000000;padding:72px 48px;text-align:center;font-family:${ff};">${inner}</td></tr>`;
      },
      accentStrip() {
        return `<tr><td bgcolor="${theme.accent}" style="background-color:${theme.accent};height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
      },
      offerRow(labelRaw, contentRaw) {
        return `<tr>
    <td bgcolor="#111111" style="background-color:#111111;padding:36px 40px;text-align:center;font-family:${ff};">
      <p style="margin:0;font-size:10px;font-weight:${w.label};text-transform:uppercase;letter-spacing:3px;color:${theme.accent};font-family:${ff};">${esc(labelRaw)}</p>
      <p style="margin:12px 0 0;font-size:17px;color:#cccccc;line-height:1.65;font-family:${ff};">${esc(contentRaw)}</p>
    </td>
  </tr>`;
      },
      productGrid(products, strings) {
        return darkGrid(products, theme, font, w, strings, ff);
      },
      ctaButton(text, url, weight) {
        return solidCta(text, url, theme.accent, "#ffffff", font, weight, "3px", "14px 40px", "11px", "2px", "uppercase");
      },
      footerStyle: "dark",
    };
  }

  // ── Clean Split — 50/50 hero, 3-column product grid ──────────────────────
  // Left dark panel with hero text + right image column.
  // Clean warm-toned offer strip. 3-column portrait product grid.
  if (style === "split") {
    return {
      style,
      heroTextColor: "#ffffff",
      heroSubColor: "rgba(255,255,255,0.68)",
      heroAlign: "left",
      heroFontSize: 36,
      heroSubFontSize: 15,
      heroLetterSpacing: "-0.3px",
      hero(inner, heroImageUrl) {
        const url = heroImageUrl?.trim();
        const rightCell = url
          ? `<td width="42%" bgcolor="${theme.primary}" style="background-color:${theme.primary};background-image:url('${esc(url)}');background-size:cover;background-position:center;padding:0;" background="${esc(url)}"><div style="height:320px;mso-line-height-rule:exactly;">&nbsp;</div></td>`
          : `<td width="42%" bgcolor="${theme.primary}" style="background-color:${theme.primary};height:320px;padding:0;font-size:0;line-height:0;">&nbsp;</td>`;
        return `<tr>
    <td style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="58%" bgcolor="#1a1a1a" valign="middle" style="background-color:#1a1a1a;padding:48px 32px;vertical-align:middle;text-align:left;font-family:${ff};">
            ${inner}
          </td>
          ${rightCell}
        </tr>
      </table>
    </td>
  </tr>`;
      },
      accentStrip() {
        return `<tr><td style="height:1px;background-color:#e8e4dd;font-size:0;line-height:0;">&nbsp;</td></tr>`;
      },
      offerRow(labelRaw, contentRaw) {
        return `<tr>
    <td style="padding:24px 36px;background-color:#f7f4ef;font-family:${ff};">
      <p style="margin:0;font-size:14px;color:#444444;line-height:1.6;font-family:${ff};">${esc(contentRaw)}</p>
    </td>
  </tr>`;
      },
      productGrid(products, strings) {
        return threeColGrid(products, theme, font, w, strings, ff);
      },
      ctaButton(text, url, weight) {
        return solidCta(text, url, "#1a1a1a", "#ffffff", font, weight, "4px", "13px 32px", "14px", "0.5px", "none");
      },
      footerStyle: "light",
    };
  }

  // ── Spotlight — full-bleed photo first, dark canvas, numbered product cards ─
  // Product image renders full-width at the top with no text overlay.
  // Headline + CTA appear in a dark section below.
  // Accent bar between sections. 2-col numbered dark product cards.
  const DARK_BG = "#0c0c0c";
  return {
    style: "spotlight" as EmailLayoutStyle,
    heroTextColor: "#ffffff",
    heroSubColor: "rgba(255,255,255,0.58)",
    heroAlign: "center",
    heroFontSize: 32,
    heroSubFontSize: 14,
    heroLetterSpacing: "-0.3px",
    hero(inner, heroImageUrl) {
      const url = heroImageUrl?.trim();
      const imgRow = url
        ? `<tr><td style="padding:0;font-size:0;line-height:0;"><img src="${esc(url)}" alt="" width="600" style="display:block;width:100%;max-width:600px;border:0;" /></td></tr>`
        : `<tr><td bgcolor="#1a1a1a" style="background-color:#1a1a1a;height:280px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
      return `${imgRow}<tr><td bgcolor="${DARK_BG}" style="background-color:${DARK_BG};padding:40px 36px 36px;text-align:center;font-family:${ff};">${inner}</td></tr>`;
    },
    accentStrip() {
      return `<tr><td bgcolor="${theme.accent}" style="background-color:${theme.accent};height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>`;
    },
    offerRow(labelRaw, contentRaw) {
      return `<tr>
    <td bgcolor="${DARK_BG}" style="background-color:${DARK_BG};padding:36px 36px;text-align:center;font-family:${ff};">
      <p style="margin:0;font-size:10px;font-weight:${w.label};text-transform:uppercase;letter-spacing:3px;color:${theme.accent};font-family:${ff};">${esc(labelRaw)}</p>
      <p style="margin:12px 0 0;font-size:16px;color:#999999;line-height:1.7;font-family:${ff};">${esc(contentRaw)}</p>
    </td>
  </tr>`;
    },
    productGrid(products, strings) {
      return spotlightGrid(products, theme, font, w, strings, ff, DARK_BG);
    },
    ctaButton(text, url, weight) {
      return solidCta(text, url, "#ffffff", "#0c0c0c", font, weight, "3px", "14px 40px", "11px", "2px", "uppercase");
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

// ── Product grid helpers ──────────────────────────────────────────────────────

type CellFn = (p: ProductItem, theme: ColorTheme, font: EmailFontDefinition, w: EmailWeights, strings: EmailStrings) => string;

// Standard: 2-col grid used by standard layout
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

// Paper: horizontal rows — small image left, text right
function paperGrid(
  products: ProductItem[],
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights,
  strings: EmailStrings
): string {
  if (!products.length) return "";
  const ff = font.stackCss;
  const rows = products.map((p, i) => {
    const divider = i > 0
      ? `<tr><td colspan="3" style="height:1px;background-color:#e8e4dd;font-size:0;padding:0;"></td></tr><tr><td colspan="3" style="height:18px;font-size:0;"></td></tr>`
      : "";
    const img = p.imageUrl?.trim()
      ? `<a href="${esc(p.productUrl)}" target="_blank"><img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="88" height="88" style="display:block;border:0;width:88px;height:88px;" /></a>`
      : `<div style="width:88px;height:88px;background-color:#e8e4dd;"></div>`;
    return `${divider}<tr>
      <td width="88" valign="top" style="vertical-align:top;padding-right:20px;">${img}</td>
      <td valign="middle" style="vertical-align:middle;font-family:${ff};">
        <p style="margin:0 0 4px;font-weight:${w.productName};color:#1a1a1a;font-size:14px;line-height:1.3;font-family:${ff};">${esc(p.name)}</p>
        <p style="margin:0 0 10px;color:#5c5650;font-size:12px;line-height:1.6;font-family:${ff};">${esc(p.description)}</p>
        <a href="${esc(p.productUrl)}" target="_blank" style="font-size:10px;font-weight:${w.productLink};text-transform:uppercase;letter-spacing:1.5px;color:#1a1a1a;text-decoration:none;border-bottom:1px solid #1a1a1a;padding-bottom:1px;font-family:${ff};">${esc(strings.shopNow)}</a>
      </td>
    </tr>`;
  });
  return `<tr>
    <td style="padding:32px 40px 28px;background-color:#faf8f4;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows.join("\n")}
      </table>
    </td>
  </tr>`;
}

// Dark Drop: 2-col flush dark cards
function darkGrid(
  products: ProductItem[],
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights,
  strings: EmailStrings,
  ff: string
): string {
  if (!products.length) return "";
  const rows: string[] = [];
  for (let i = 0; i < products.length; i += 2) {
    const left = products[i]!;
    const right = products[i + 1];
    rows.push(`<tr>
      ${darkCell(left, theme, w, strings, ff)}
      <td width="2" bgcolor="#0a0a0a" style="background-color:#0a0a0a;font-size:0;"></td>
      ${right ? darkCell(right, theme, w, strings, ff) : `<td bgcolor="#111111" style="background-color:#111111;"></td>`}
    </tr>
    <tr><td colspan="3" height="2" bgcolor="#0a0a0a" style="background-color:#0a0a0a;height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>`);
  }
  return `<tr>
    <td bgcolor="#0a0a0a" style="background-color:#0a0a0a;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows.join("\n")}
      </table>
    </td>
  </tr>`;
}

function darkCell(
  p: ProductItem,
  theme: ColorTheme,
  w: EmailWeights,
  strings: EmailStrings,
  ff: string
): string {
  const img = p.imageUrl?.trim()
    ? `<a href="${esc(p.productUrl)}" target="_blank"><img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="100%" style="display:block;border:0;max-width:100%;height:200px;" /></a>`
    : `<div style="width:100%;height:200px;background-color:#1a1a1a;"></div>`;
  return `<td width="49%" valign="top" bgcolor="#111111" style="background-color:#111111;vertical-align:top;font-family:${ff};">
    ${img}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:14px 16px 18px;font-family:${ff};">
          <p style="margin:0 0 6px;font-weight:${w.productName};color:#ffffff;font-size:13px;line-height:1.3;text-transform:uppercase;letter-spacing:0.5px;font-family:${ff};">${esc(p.name)}</p>
          <p style="margin:0 0 12px;color:#666666;font-size:12px;line-height:1.55;font-family:${ff};">${esc(p.description)}</p>
          <a href="${esc(p.productUrl)}" target="_blank" style="font-size:10px;font-weight:${w.productLink};text-transform:uppercase;letter-spacing:2px;color:${theme.accent};text-decoration:none;font-family:${ff};">${esc(strings.shopNow)} &#8594;</a>
        </td>
      </tr>
    </table>
  </td>`;
}

// Clean Split: 3-column portrait grid
function threeColGrid(
  products: ProductItem[],
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights,
  strings: EmailStrings,
  ff: string
): string {
  if (!products.length) return "";
  const rows: string[] = [];
  for (let i = 0; i < products.length; i += 3) {
    const [a, b, c] = [products[i]!, products[i + 1], products[i + 2]];
    rows.push(`<tr>
      ${splitCell(a, theme, w, strings, ff)}
      <td width="3%" style="padding:0;"></td>
      ${b ? splitCell(b, theme, w, strings, ff) : '<td width="30%"></td>'}
      <td width="3%" style="padding:0;"></td>
      ${c ? splitCell(c, theme, w, strings, ff) : '<td width="30%"></td>'}
    </tr>`);
  }
  return `<tr>
    <td style="padding:32px 28px 20px;background-color:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows.join("\n")}
      </table>
    </td>
  </tr>`;
}

function splitCell(
  p: ProductItem,
  theme: ColorTheme,
  w: EmailWeights,
  strings: EmailStrings,
  ff: string
): string {
  const img = p.imageUrl?.trim()
    ? `<a href="${esc(p.productUrl)}" target="_blank"><img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="100%" style="display:block;border:0;max-width:100%;height:160px;" /></a>`
    : `<div style="width:100%;height:160px;background-color:#f0ede8;"></div>`;
  return `<td width="30%" valign="top" style="vertical-align:top;font-family:${ff};">
    ${img}
    <p style="margin:10px 0 4px;font-weight:${w.productName};color:#1a1a1a;font-size:12px;line-height:1.3;font-family:${ff};">${esc(p.name)}</p>
    <p style="margin:0 0 8px;color:#888888;font-size:11px;line-height:1.5;font-family:${ff};">${esc(p.description)}</p>
    <a href="${esc(p.productUrl)}" target="_blank" style="font-size:10px;font-weight:${w.productLink};text-transform:uppercase;letter-spacing:1px;color:#1a1a1a;text-decoration:none;border-bottom:1px solid #1a1a1a;font-family:${ff};">${esc(strings.shopNow)}</a>
  </td>`;
}

// Spotlight: numbered 2-col dark cards
function spotlightGrid(
  products: ProductItem[],
  theme: ColorTheme,
  font: EmailFontDefinition,
  w: EmailWeights,
  strings: EmailStrings,
  ff: string,
  darkBg: string
): string {
  if (!products.length) return "";
  const rows: string[] = [];
  for (let i = 0; i < products.length; i += 2) {
    const left = products[i]!;
    const right = products[i + 1];
    rows.push(`<tr>
      ${spotlightCell(left, i + 1, theme, w, strings, ff)}
      <td width="2" bgcolor="${darkBg}" style="background-color:${darkBg};font-size:0;"></td>
      ${right ? spotlightCell(right, i + 2, theme, w, strings, ff) : `<td bgcolor="#161616" style="background-color:#161616;"></td>`}
    </tr>
    <tr><td colspan="3" height="2" bgcolor="${darkBg}" style="background-color:${darkBg};height:2px;font-size:0;line-height:0;">&nbsp;</td></tr>`);
  }
  return `<tr>
    <td bgcolor="${darkBg}" style="background-color:${darkBg};padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows.join("\n")}
      </table>
    </td>
  </tr>`;
}

function spotlightCell(
  p: ProductItem,
  num: number,
  theme: ColorTheme,
  w: EmailWeights,
  strings: EmailStrings,
  ff: string
): string {
  const numStr = String(num).padStart(2, "0");
  const img = p.imageUrl?.trim()
    ? `<a href="${esc(p.productUrl)}" target="_blank"><img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" width="100%" style="display:block;border:0;max-width:100%;height:200px;" /></a>`
    : `<div style="width:100%;height:200px;background-color:#1a1a1a;"></div>`;
  return `<td width="49%" valign="top" bgcolor="#161616" style="background-color:#161616;vertical-align:top;font-family:${ff};">
    ${img}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:14px 16px 18px;font-family:${ff};">
          <p style="margin:0 0 6px;font-size:9px;color:#444444;font-family:${ff};">${numStr}</p>
          <p style="margin:0 0 6px;font-weight:${w.productName};color:#ffffff;font-size:13px;line-height:1.3;text-transform:uppercase;letter-spacing:0.5px;font-family:${ff};">${esc(p.name)}</p>
          <p style="margin:0 0 12px;color:#555555;font-size:11px;line-height:1.6;font-family:${ff};">${esc(p.description)}</p>
          <a href="${esc(p.productUrl)}" target="_blank" style="font-size:9px;font-weight:${w.productLink};text-transform:uppercase;letter-spacing:2.5px;color:${theme.accent};text-decoration:none;font-family:${ff};">${esc(strings.shopNow)} &#8594;</a>
        </td>
      </tr>
    </table>
  </td>`;
}
