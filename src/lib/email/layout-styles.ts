export type EmailLayoutStyle = "standard" | "editorial" | "minimal" | "bold" | "spotlight";

export const EMAIL_LAYOUT_STYLES: readonly EmailLayoutStyle[] = [
  "standard",
  "editorial",
  "minimal",
  "bold",
  "spotlight",
];

export const DEFAULT_EMAIL_LAYOUT_STYLE: EmailLayoutStyle = "standard";

export function getLayoutStyle(key: string | null | undefined): EmailLayoutStyle {
  switch (key) {
    case "editorial":
    case "minimal":
    case "bold":
    case "spotlight":
      return key;
    default:
      return "standard";
  }
}
