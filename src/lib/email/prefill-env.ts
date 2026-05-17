/** Server-only: read `EMAIL_PREFILL=true` in `.env.local`. */
export function isEmailPrefillEnabled(): boolean {
  const raw = (process.env.EMAIL_PREFILL ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}
