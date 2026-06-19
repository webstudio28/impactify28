const DUPLICATE_SUFFIX_RE = /^(.+?)_(\d{2,})$/;

/** Strip a trailing `_02`-style suffix so copies share one base name. */
export function duplicateCampaignBaseName(name: string): string {
  const trimmed = name.trim();
  const match = trimmed.match(DUPLICATE_SUFFIX_RE);
  return match ? match[1]! : trimmed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Next copy name: `Summer Sale` → `Summer Sale_02`, then `_03`, etc. */
export function nextDuplicateCampaignName(sourceName: string, existingNames: string[]): string {
  const base = duplicateCampaignBaseName(sourceName);
  let max = 1;
  const re = new RegExp(`^${escapeRegExp(base)}_(\\d{2,})$`);

  for (const existing of existingNames) {
    const match = existing.trim().match(re);
    if (match) max = Math.max(max, parseInt(match[1]!, 10));
  }

  const next = max + 1;
  return `${base}_${String(next).padStart(2, "0")}`;
}
