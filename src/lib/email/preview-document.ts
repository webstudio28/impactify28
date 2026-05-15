export type PreviewFontOptions = {
  googleFontsCssHref: string;
  stackCss: string;
};

/** Full HTML document for iframe / popup preview; CTA links open in a new tab. */
export function wrapEmailPreviewDocument(
  bodyHtml: string,
  narrow: boolean,
  font?: PreviewFontOptions
): string {
  const max = narrow ? "375px" : "640px";
  const href = font?.googleFontsCssHref;
  const fontHead =
    href?.trim() ?
      `<link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link rel="stylesheet" href="${href.replace(/"/g, "&quot;")}"/>`
    : "";
  const ff = font?.stackCss ? `font-family:${font.stackCss};` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>${fontHead}<base target="_blank"/></head><body style="margin:0;background:#f4f4f5;padding:12px;${ff}"><div style="max-width:${max};width:100%;margin:0 auto;background:#fff;${ff}">${bodyHtml}</div></body></html>`;
}
