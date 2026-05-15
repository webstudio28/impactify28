/**
 * Curated fonts for marketing email: strong Latin + Cyrillic (Bulgarian) coverage,
 * readable at small sizes, and safe fallbacks for clients that ignore web fonts.
 */
export type EmailFontKey =
  | "montserrat"
  | "open_sans"
  | "lato"
  | "source_sans_3"
  | "work_sans"
  | "pt_sans";

export type EmailFontDefinition = {
  key: EmailFontKey;
  /** Short label for UI */
  label: string;
  /** Google Fonts CSS2 stylesheet (Latin + Cyrillic + Cyrillic-ext) */
  googleFontsCssHref: string;
  /** Inline `font-family` value (single-quoted stacks work inside double-quoted style attrs) */
  stackCss: string;
};

export const EMAIL_FONTS: Record<EmailFontKey, EmailFontDefinition> = {
  montserrat: {
    key: "montserrat",
    label: "Montserrat",
    googleFontsCssHref:
      "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&subset=latin,latin-ext,cyrillic,cyrillic-ext&display=swap",
    stackCss: "'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif",
  },
  open_sans: {
    key: "open_sans",
    label: "Open Sans",
    googleFontsCssHref:
      "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&subset=latin,latin-ext,cyrillic,cyrillic-ext&display=swap",
    stackCss: "'Open Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  },
  lato: {
    key: "lato",
    label: "Lato",
    googleFontsCssHref:
      "https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&subset=latin,latin-ext,cyrillic,cyrillic-ext&display=swap",
    stackCss: "'Lato','Helvetica Neue',Helvetica,Arial,sans-serif",
  },
  source_sans_3: {
    key: "source_sans_3",
    label: "Source Sans 3",
    googleFontsCssHref:
      "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&subset=latin,latin-ext,cyrillic,cyrillic-ext&display=swap",
    stackCss: "'Source Sans 3','Source Sans Pro','Segoe UI',Helvetica,Arial,sans-serif",
  },
  work_sans: {
    key: "work_sans",
    label: "Work Sans",
    googleFontsCssHref:
      "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;600;700&subset=latin,latin-ext,cyrillic,cyrillic-ext&display=swap",
    stackCss: "'Work Sans','Segoe UI',Helvetica,Arial,sans-serif",
  },
  pt_sans: {
    key: "pt_sans",
    label: "PT Sans",
    googleFontsCssHref:
      "https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&subset=latin,latin-ext,cyrillic,cyrillic-ext&display=swap",
    stackCss: "'PT Sans','Segoe UI',Helvetica,Arial,sans-serif",
  },
};

export const EMAIL_FONT_KEYS = Object.keys(EMAIL_FONTS) as EmailFontKey[];

export const DEFAULT_EMAIL_FONT_KEY: EmailFontKey = "montserrat";

export function getEmailFont(key: string | null | undefined): EmailFontDefinition {
  if (key && key in EMAIL_FONTS) return EMAIL_FONTS[key as EmailFontKey];
  return EMAIL_FONTS[DEFAULT_EMAIL_FONT_KEY];
}
