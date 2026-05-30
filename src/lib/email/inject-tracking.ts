import {
  buildClickRedirectUrl,
  buildOpenPixelUrl,
  buildUnsubscribeUrl,
  buildViewInBrowserUrl,
  createTrackingToken,
} from "@/lib/email/tracking";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function withBodyFallback(html: string): string {
  if (/<\/body>/i.test(html)) return html;
  return `${html}</body>`;
}

function shouldSkipHref(href: string): boolean {
  const t = href.trim();
  if (!t) return true;
  if (t.startsWith("#")) return true;
  if (t.toLowerCase().startsWith("mailto:")) return true;
  if (t.toLowerCase().startsWith("tel:")) return true;
  return false;
}

function rewriteLinks(
  html: string,
  recipientId: string,
  campaignId: string
): string {
  return html.replace(/href=(["'])(.*?)\1/gi, (_match, quote: string, hrefRaw: string) => {
    const href = hrefRaw.trim();
    if (shouldSkipHref(href)) {
      return `href=${quote}${escapeHtml(hrefRaw)}${quote}`;
    }
    const token = createTrackingToken({
      kind: "click",
      recipientId,
      campaignId,
      targetUrl: href,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });
    const tracked = buildClickRedirectUrl(token);
    return `href=${quote}${escapeHtml(tracked)}${quote}`;
  });
}

export function injectTrackingForEmail(params: {
  html: string;
  recipientId: string;
  campaignId: string;
}): string {
  const withBody = withBodyFallback(params.html);
  const rewritten = rewriteLinks(withBody, params.recipientId, params.campaignId);

  const openToken = createTrackingToken({
    kind: "open",
    recipientId: params.recipientId,
    campaignId: params.campaignId,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  });
  const viewToken = createTrackingToken({
    kind: "view",
    recipientId: params.recipientId,
    campaignId: params.campaignId,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  });
  const unsubToken = createTrackingToken({
    kind: "unsub",
    recipientId: params.recipientId,
    campaignId: params.campaignId,
    expiresAt: null,
  });

  const topLink = `
<div style="font-size:12px;color:#64748b;text-align:center;margin:0 0 14px;">
  <a href="${escapeHtml(buildViewInBrowserUrl(viewToken))}" style="color:#64748b;text-decoration:underline;">View this email in your browser</a>
</div>`;

  const footer = `
<div style="font-size:12px;color:#64748b;text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
  <a href="${escapeHtml(buildUnsubscribeUrl(unsubToken))}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
</div>`;

  const pixel = `<img src="${escapeHtml(buildOpenPixelUrl(openToken))}" width="1" height="1" alt="" style="display:none;border:0;" />`;

  return rewritten.replace(/<body([^>]*)>/i, (match) => `${match}${topLink}`).replace(/<\/body>/i, `${footer}${pixel}</body>`);
}

