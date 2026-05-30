import { Client, Receiver } from "@upstash/qstash";

export function isQStashConfigured(): boolean {
  return Boolean(process.env.QSTASH_TOKEN?.trim());
}

function getCallbackBaseUrl(): string {
  const explicit = process.env.QSTASH_CALLBACK_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (!site) {
    throw new Error(
      "Set QSTASH_CALLBACK_URL or NEXT_PUBLIC_SITE_URL (or VERCEL_URL) for QStash worker callbacks"
    );
  }
  return site.startsWith("http") ? site.replace(/\/$/, "") : `https://${site.replace(/\/$/, "")}`;
}

function getClient(): Client {
  const token = process.env.QSTASH_TOKEN?.trim();
  if (!token) throw new Error("QSTASH_TOKEN is not set");
  return new Client({ token });
}

export async function publishEmailBatch(
  campaignId: string,
  cursor = 0
): Promise<{ published: boolean; messageId?: string }> {
  if (!isQStashConfigured()) return { published: false };

  const base = getCallbackBaseUrl();
  const client = getClient();
  const res = await client.publishJSON({
    url: `${base}/api/workers/email-batch`,
    body: { campaignId, cursor },
    retries: 3,
  });

  return { published: true, messageId: res.messageId };
}

export async function publishSmsBatch(
  campaignId: string,
  cursor = 0
): Promise<{ published: boolean; messageId?: string }> {
  if (!isQStashConfigured()) return { published: false };

  const base = getCallbackBaseUrl();
  const client = getClient();
  const res = await client.publishJSON({
    url: `${base}/api/workers/sms-batch`,
    body: { campaignId, cursor },
    retries: 3,
  });

  return { published: true, messageId: res.messageId };
}

/** Publish the first batch job for a campaign after launch or resume. */
export async function kickoffCampaignProcessing(
  campaignId: string,
  channel: "email" | "sms"
): Promise<{ published: boolean }> {
  if (!isQStashConfigured()) return { published: false };
  if (channel === "email") {
    const r = await publishEmailBatch(campaignId, 0);
    return { published: r.published };
  }
  const r = await publishSmsBatch(campaignId, 0);
  return { published: r.published };
}

export async function verifyQStashSignature(req: Request, rawBody: string): Promise<boolean> {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const next = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  if (!current || !next) {
    console.error("[qstash] signing keys not configured");
    return false;
  }

  const signature = req.headers.get("upstash-signature");
  if (!signature) return false;

  const receiver = new Receiver({ currentSigningKey: current, nextSigningKey: next });
  try {
    await receiver.verify({ signature, body: rawBody });
    return true;
  } catch (e) {
    console.error("[qstash] signature verification failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
