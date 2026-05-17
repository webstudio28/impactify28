export type EmailLayoutStyle = "standard" | "paper" | "dark" | "split" | "spotlight";

export const EMAIL_LAYOUT_STYLES: readonly EmailLayoutStyle[] = [
  "standard",
  "paper",
  "dark",
  "split",
  "spotlight",
];

export const DEFAULT_EMAIL_LAYOUT_STYLE: EmailLayoutStyle = "standard";

export function getLayoutStyle(key: string | null | undefined): EmailLayoutStyle {
  switch (key) {
    case "paper":
    case "dark":
    case "split":
    case "spotlight":
      return key;
    default:
      return "standard";
  }
}
