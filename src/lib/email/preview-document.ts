/** Full HTML document for iframe / popup preview; CTA links open in a new tab. */
export function wrapEmailPreviewDocument(bodyHtml: string, narrow: boolean): string {
  const max = narrow ? "375px" : "640px";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><base target="_blank"/></head><body style="margin:0;background:#f4f4f5;padding:12px;"><div style="max-width:${max};width:100%;margin:0 auto;background:#fff;">${bodyHtml}</div></body></html>`;
}
