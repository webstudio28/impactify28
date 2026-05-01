export function composeSmsBody(message: string, link?: string | null): string {
  const m = message.trim();
  const l = link?.trim();
  if (m && l) return `${m} ${l}`;
  if (m) return m;
  if (l) return l;
  return "";
}
