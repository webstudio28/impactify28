export type EmailGenerationBrief = {
  purpose: string;
  targetUrl: string;
  language: string;
  hasPromo: boolean;
  promoPercent: number | null;
  promoCode: string | null;
  freeText: string;
};

export type GenerateEmailResult = { subject: string; html: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSystemPrompt(): string {
  return `You are an expert email marketer and HTML email developer.
Return a JSON object with exactly two keys: "subject" (string) and "html" (string).
The html must be a single responsive marketing email using table-based layout and inline CSS only (no external stylesheets, no script tags).
At the very top of the body content, include this exact placeholder on its own line so the app can inject a logo: {{COMPANY_LOGO}}
Include a clear primary CTA button linking to the campaign target URL.
Use web-safe fonts. Max width ~600px for desktop; it should still read well on narrow screens.
Do not include markdown fences in the JSON values.`;
}

function buildUserPrompt(brief: EmailGenerationBrief, businessName: string | null): string {
  const promo =
    brief.hasPromo && brief.promoPercent != null
      ? `Promo: ${brief.promoPercent}% off${brief.promoCode ? `, code ${brief.promoCode}` : ""}.`
      : "No promo discount.";
  return [
    `Business name: ${businessName || "Our shop"}.`,
    `Campaign purpose (required): ${brief.purpose}`,
    `Target landing URL (CTA must point here): ${brief.targetUrl}`,
    `Email language (copy in this language): ${brief.language}`,
    promo,
    brief.freeText.trim() ? `Extra notes from the merchant: ${brief.freeText.trim()}` : "",
    "Subject line should be compelling and not misleading.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateCampaignEmailHtml(
  brief: EmailGenerationBrief,
  options: { businessName: string | null }
): Promise<GenerateEmailResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.7,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(brief, options.businessName) },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    let msg = raw.slice(0, 200);
    try {
      const j = JSON.parse(raw) as { error?: { message?: string } };
      if (j.error?.message) msg = j.error.message;
    } catch {
      /* keep slice */
    }
    throw new Error(`OpenAI error: ${msg}`);
  }

  let parsed: { choices?: { message?: { content?: string } }[] };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("Invalid OpenAI response");
  }

  const content = parsed.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");

  let data: { subject?: string; html?: string };
  try {
    data = JSON.parse(content) as { subject?: string; html?: string };
  } catch {
    throw new Error("OpenAI did not return valid JSON");
  }

  const subject = typeof data.subject === "string" ? data.subject.trim() : "";
  let html = typeof data.html === "string" ? data.html.trim() : "";
  if (!subject || !html) throw new Error("OpenAI response missing subject or html");

  const logoSlot = "{{COMPANY_LOGO}}";
  if (!html.includes(logoSlot)) {
    html = `<div>${logoSlot}</div>${html}`;
  }

  return { subject, html };
}

export function injectLogoIntoHtml(html: string, logoUrl: string | null): string {
  const slot = "{{COMPANY_LOGO}}";
  if (!html.includes(slot)) return html;
  if (logoUrl?.trim()) {
    const img = `<div style="text-align:center;padding:16px 12px 8px;"><img src="${escapeHtml(
      logoUrl.trim()
    )}" alt="" width="160" style="max-width:160px;height:auto;display:inline-block;border:0;" /></div>`;
    return html.split(slot).join(img);
  }
  return html.split(slot).join(
    `<div style="text-align:center;padding:20px 12px;font-size:13px;color:#666;">Your logo will appear here once you upload it in your profile.</div>`
  );
}
