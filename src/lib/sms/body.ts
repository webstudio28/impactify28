export function composeSmsBody(message: string, link?: string | null): string {
  const m = message.trim();
  const l = link?.trim();
  if (m && l) return `${m} ${l}`;
  if (m) return m;
  if (l) return l;
  return "";
}

/**
 * Parse combined editor text into message + URL field, using the current URL input
 * to detect the suffix (same spacing rule as `composeSmsBody`).
 * If the text no longer ends with that URL, `link_url` is cleared.
 */
export function splitSmsEditorValue(raw: string, linkField: string): { body: string; link_url: string } {
  const l = linkField.trim();
  if (!l) {
    return { body: raw, link_url: "" };
  }
  const rt = raw.trimEnd();
  if (rt === l) {
    return { body: "", link_url: linkField };
  }
  const joint = ` ${l}`;
  if (rt.endsWith(joint)) {
    return { body: rt.slice(0, rt.length - joint.length), link_url: linkField };
  }
  return { body: raw, link_url: "" };
}
