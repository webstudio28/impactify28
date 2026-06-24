export function parsePhoneInput(text: string): string[] {
  const raw = text
    .split(/\r?\n/)
    .flatMap((line) => line.split(/[,;]/))
    .map((v) => v.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  for (const phone of raw) {
    if (seen.has(phone)) continue;
    seen.add(phone);
    valid.push(phone);
  }
  return valid;
}
