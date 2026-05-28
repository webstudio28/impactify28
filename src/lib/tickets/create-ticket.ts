/**
 * Server-side ticket creation.
 * Always uses the admin client so RLS does not block inserts from server functions.
 * Also sends a notification email to the platform contact address for critical/error tickets.
 */

const PLATFORM_EMAIL = "bgwebstudio28@gmail.com";
const PLATFORM_NAME = "Impact28";

export type TicketKind = "critical" | "error" | "warning" | "info";

export type CreateTicketParams = {
  kind?: TicketKind;
  title: string;
  message: string;
  userId?: string | null;
  campaignId?: string | null;
  context?: Record<string, unknown>;
  /**
   * When true, skip insert if an unresolved ticket with the same campaign_id
   * and kind already exists. Prevents ticket spam during repeated cron runs.
   */
  deduplicate?: boolean;
};

export async function createTicket(params: CreateTicketParams): Promise<void> {
  const {
    kind = "error",
    title,
    message,
    userId,
    campaignId,
    context,
    deduplicate = false,
  } = params;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const db = createAdminClient();

  // Deduplication: skip if a matching unresolved ticket already exists
  if (deduplicate && campaignId) {
    const { data: existing } = await db
      .from("tickets")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("kind", kind)
      .eq("resolved", false)
      .limit(1);
    if (existing && existing.length > 0) return;
  }

  const { error } = await db.from("tickets").insert({
    kind,
    title,
    message,
    user_id: userId ?? null,
    campaign_id: campaignId ?? null,
    context: context ?? null,
    resolved: false,
  });

  if (error) {
    console.error("[createTicket] failed to insert ticket:", error.message);
  }

  // Send admin email for critical/error only — warnings and info are silently logged
  if (kind === "critical" || kind === "error") {
    try {
      await sendTicketNotificationEmail({ kind, title, message, userId, campaignId, context });
    } catch (e) {
      console.error("[createTicket] notification email failed:", e instanceof Error ? e.message : e);
    }
  }
}

/**
 * Create tickets for a batch send run (one ticket per campaign with failures).
 * Groups per-campaign results and picks the appropriate severity level.
 */
export async function createSendBatchTickets(
  summaries: CampaignSendSummary[],
  channel: "sms" | "email"
): Promise<void> {
  await Promise.all(
    summaries.map(async (s) => {
      if (s.failed === 0) return; // nothing to report

      const allFailed = s.sent === 0 && s.failed > 0;
      const kind: TicketKind = allFailed ? "error" : "warning";
      const channelLabel = channel === "email" ? "email" : "SMS";

      const title = allFailed
        ? `All ${channelLabel}s failed for campaign: ${s.campaignName ?? s.campaignId}`
        : `${s.failed} ${channelLabel}(s) failed for campaign: ${s.campaignName ?? s.campaignId}`;

      const sample = s.sampleErrors[0] ?? "unknown";
      const message = allFailed
        ? `Every ${channelLabel} in this send batch failed. ${sample}`
        : `${s.sent} sent successfully, ${s.failed} failed. Sample error: ${sample}`;

      await createTicket({
        kind,
        title,
        message,
        userId: s.userId ?? null,
        campaignId: s.campaignId,
        context: {
          channel,
          campaignName: s.campaignName ?? "",
          sent: s.sent,
          failed: s.failed,
          sampleErrors: s.sampleErrors.slice(0, 5),
        },
        // Only deduplicate warnings — errors should always be recorded
        deduplicate: !allFailed,
      });
    })
  );
}

export type CampaignSendSummary = {
  campaignId: string;
  campaignName?: string;
  userId?: string | null;
  sent: number;
  failed: number;
  sampleErrors: string[];
};

async function sendTicketNotificationEmail(
  params: Omit<CreateTicketParams, "kind" | "deduplicate"> & { kind: TicketKind }
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return;

  const { kind, title, message, userId, campaignId, context } = params;

  const BADGE_COLORS: Record<TicketKind, string> = {
    critical: "#7c3aed",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  };

  const badgeColor = BADGE_COLORS[kind];

  const contextLines =
    context && Object.keys(context).length > 0
      ? Object.entries(context)
          .map(
            ([k, v]) =>
              `<tr>
                <td style="padding:6px 12px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;">${k}</td>
                <td style="padding:6px 12px;color:#111827;font-family:monospace;font-size:12px;border-bottom:1px solid #f3f4f6;">${typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)}</td>
              </tr>`
          )
          .join("")
      : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${PLATFORM_NAME} — ${kind.toUpperCase()} Alert</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.12);">

  <!-- Header -->
  <tr><td style="background:${badgeColor};padding:24px 32px;">
    <p style="margin:0 0 4px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.75);">${PLATFORM_NAME} Alert · ${new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" })}</p>
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;line-height:1.35;">${title}</h1>
    <span style="display:inline-block;margin-top:10px;padding:3px 10px;background:rgba(255,255,255,0.2);border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#fff;">${kind}</span>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:28px 32px;">
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.75;">${message}</p>

    <!-- Meta -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:13px;">
      ${
        userId
          ? `<tr>
          <td style="padding:8px 12px;font-weight:600;color:#6b7280;width:130px;border-bottom:1px solid #e5e7eb;">User ID</td>
          <td style="padding:8px 12px;font-family:monospace;color:#111827;border-bottom:1px solid #e5e7eb;">${userId}</td>
        </tr>`
          : ""
      }
      ${
        campaignId
          ? `<tr>
          <td style="padding:8px 12px;font-weight:600;color:#6b7280;width:130px;border-bottom:1px solid #e5e7eb;">Campaign ID</td>
          <td style="padding:8px 12px;font-family:monospace;color:#111827;border-bottom:1px solid #e5e7eb;">${campaignId}</td>
        </tr>`
          : ""
      }
      ${contextLines}
    </table>

    <p style="margin:28px 0 0;font-size:12px;color:#9ca3af;">
      Sent automatically by ${PLATFORM_NAME} · ${new Date().toISOString()}<br/>
      <a href="https://impact28.com" style="color:#7c3aed;">View admin panel</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const fromAddr =
    process.env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${PLATFORM_NAME} Alerts <${fromAddr}>`,
      to: [PLATFORM_EMAIL],
      subject: `[${kind.toUpperCase()}] ${title}`,
      html,
    }),
  });
}
