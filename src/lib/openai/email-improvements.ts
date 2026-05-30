export type ImprovementField = "subject" | "preheader" | "body" | "cta";

export type ImprovementIssue = {
  field: ImprovementField;
  severity: "high" | "medium" | "low";
  reason: string;
  suggestions: [string, string, string];
};

export type AnalyzeEmailInput = {
  subject: string;
  preheader: string;
  bodyText: string;
  ctaText: string;
};

const SYSTEM_PROMPT = `You are an email deliverability expert. Analyze the email fields below and return a JSON array.
Each item must have: field ("subject"|"preheader"|"body"|"cta"), severity ("high"|"medium"|"low"),
reason (one sentence explaining the deliverability or engagement risk),
suggestions (array of exactly 3 improved alternatives as plain strings).
Focus on: spam trigger words, excessive punctuation, all-caps, vague subject lines,
missing preheader, weak CTAs. Return [] if no issues found.
Return ONLY valid JSON: either an array of issues, or an object with key "issues" containing that array.`;

function isImprovementField(v: unknown): v is ImprovementField {
  return v === "subject" || v === "preheader" || v === "body" || v === "cta";
}

function isSeverity(v: unknown): v is ImprovementIssue["severity"] {
  return v === "high" || v === "medium" || v === "low";
}

function parseIssue(raw: unknown): ImprovementIssue | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isImprovementField(o.field) || !isSeverity(o.severity)) return null;
  if (typeof o.reason !== "string" || !o.reason.trim()) return null;
  if (!Array.isArray(o.suggestions) || o.suggestions.length !== 3) return null;
  const suggestions = o.suggestions.map((s) => (typeof s === "string" ? s.trim() : ""));
  if (suggestions.some((s) => !s)) return null;
  return {
    field: o.field,
    severity: o.severity,
    reason: o.reason.trim(),
    suggestions: suggestions as [string, string, string],
  };
}

export function parseImprovementIssues(content: string): ImprovementIssue[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  let arr: unknown[] = [];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { issues?: unknown }).issues)) {
    arr = (parsed as { issues: unknown[] }).issues;
  } else {
    return [];
  }

  return arr.map(parseIssue).filter((x): x is ImprovementIssue => x !== null);
}

export async function analyzeEmailImprovements(input: AnalyzeEmailInput): Promise<ImprovementIssue[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const userContent = [
    `Subject: ${input.subject || "(empty)"}`,
    `Preheader: ${input.preheader || "(empty)"}`,
    `Body: ${input.bodyText || "(empty)"}`,
    `CTA button text: ${input.ctaText || "(empty)"}`,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
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
      /* */
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

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return parseImprovementIssues(content);
  }

  if (Array.isArray(data)) {
    return data.map(parseIssue).filter((x): x is ImprovementIssue => x !== null);
  }

  if (data && typeof data === "object" && Array.isArray((data as { issues?: unknown }).issues)) {
    return ((data as { issues: unknown[] }).issues)
      .map(parseIssue)
      .filter((x): x is ImprovementIssue => x !== null);
  }

  return [];
}
