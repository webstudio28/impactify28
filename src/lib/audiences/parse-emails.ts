const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;

export function parseEmailInput(text: string): string[] {
  const raw = text
    .split(/\r?\n/)
    .flatMap((line) => line.split(/[,;]/))
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  const seen = new Set<string>();
  const valid: string[] = [];
  for (const email of raw) {
    if (!EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }
  return valid;
}
