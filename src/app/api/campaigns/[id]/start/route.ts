import { after } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeCampaignLaunch } from "@/lib/campaigns/execute-launch";
import { processCampaignBatchFallback } from "@/lib/campaigns/fallback-process";
import { isQStashConfigured } from "@/lib/qstash";
import {
  emailFailureTicketContext,
  explainResendSendFailure,
  getInvalidPlatformFromWarning,
} from "@/lib/email/resend-errors";
import { createTicket } from "@/lib/tickets/create-ticket";
import { transitionCampaign, toCanonicalStatus, toStoredStatus } from "@/lib/campaigns/state-machine";

type Ctx = { params: Promise<{ id: string }> };

function isDomainError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    (lower.includes("domain") &&
      (lower.includes("not verified") || lower.includes("verify") || lower.includes("verif"))) ||
    lower.includes("not allowed") ||
    (lower.includes("sender") && lower.includes("verif"))
  );
}

async function runBackgroundLaunch(
  campaignId: string,
  userId: string,
  channel: string,
  campaignName: string
): Promise<void> {
  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Admin client unavailable";
    await createTicket({
      kind: "critical",
      title: `Campaign launch failed — ${campaignName}`,
      message: msg,
      userId,
      campaignId,
      context: { channel, source: "background-launch" },
    });
    return;
  }

  const supabase = admin;

  try {
    const result = await executeCampaignLaunch(supabase, campaignId, {
      skipReadyCheck: true,
      skipStatusUpdate: true,
    });

    if (!result.ok) {
      await supabase
        .from("campaigns")
        .update({ status: toStoredStatus("ready"), updated_at: new Date().toISOString() })
        .eq("id", campaignId);

      if ("ticketed" in result && result.ticketed) return;

      await createTicket({
        kind: "error",
        title: `Campaign launch failed — ${campaignName}`,
        message: result.error,
        userId,
        campaignId,
        context: { channel, source: "background-launch" },
      });
      return;
    }

    const ch = channel === "email" ? "email" : "sms";

    if (!isQStashConfigured()) {
      const batch = await processCampaignBatchFallback(supabase, campaignId, ch);
      if (batch.processed === 0 && ch === "email") {
        const { data: failedSample } = await supabase
          .from("outbound_email")
          .select("error_message")
          .eq("campaign_id", campaignId)
          .eq("status", "failed")
          .limit(1)
          .maybeSingle();

        if (failedSample?.error_message) {
          await supabase
            .from("campaigns")
            .update({ status: toStoredStatus("ready"), updated_at: new Date().toISOString() })
            .eq("id", campaignId);

          const rawError = failedSample.error_message as string;
          const platformFrom = process.env.RESEND_FROM_EMAIL?.trim() || null;
          const { data: profile } = await supabase
            .from("profiles")
            .select("sender_email, sender_display_name, business_name")
            .eq("id", userId)
            .single();

          const replyTo = (profile?.sender_email as string | null)?.trim() || null;
          const displayName =
            (profile?.sender_display_name as string | null)?.trim() ||
            (profile?.business_name as string | null)?.trim() ||
            null;
          const fromHeader = platformFrom
            ? displayName
              ? `${displayName} <${platformFrom}>`
              : platformFrom
            : null;

          const clearMessage = explainResendSendFailure(rawError, {
            platformFrom,
            fromHeader,
            replyTo,
          });
          const kind = isDomainError(rawError) ? "critical" : "error";

          await createTicket({
            kind,
            title: `${kind === "critical" ? "Platform sender not verified in Resend" : "All emails failed"} — ${campaignName}`,
            message: clearMessage,
            userId,
            campaignId,
            context: emailFailureTicketContext({
              platformFrom,
              fromHeader,
              replyTo,
              campaignName,
              sent: 0,
              failed: 1,
              sampleErrors: [rawError],
            }),
          });
        }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Launch failed";
    await supabase
      .from("campaigns")
      .update({ status: toStoredStatus("ready"), updated_at: new Date().toISOString() })
      .eq("id", campaignId);
    await createTicket({
      kind: "error",
      title: `Campaign launch crashed — ${campaignName}`,
      message: msg,
      userId,
      campaignId,
      context: { channel, source: "background-launch" },
    });
  }
}

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row, error: qErr } = await supabase
    .from("campaigns")
    .select("id, status, user_id, channel, name")
    .eq("id", id)
    .single();

  if (qErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const canonical = toCanonicalStatus(row.status as string);
  if (canonical !== "ready") {
    return NextResponse.json({ error: "Campaign is not ready to start" }, { status: 400 });
  }

  const campaignName = (row.name as string | null) ?? id;
  const channel = (row.channel as string) || "sms";

  // Pre-flight checks that must fail fast (before marking running)
  if (channel === "email") {
    if (!process.env.RESEND_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not set. Contact the platform administrator." },
        { status: 500 }
      );
    }
    const platformFrom = process.env.RESEND_FROM_EMAIL?.trim() || null;
    const warn = getInvalidPlatformFromWarning(platformFrom);
    if (warn) {
      return NextResponse.json({ error: warn }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("sender_display_name, business_name")
      .eq("id", user.id)
      .single();

    const displayName =
      (profile?.sender_display_name as string | null)?.trim() ||
      (profile?.business_name as string | null)?.trim() ||
      null;
    if (!displayName) {
      return NextResponse.json(
        { error: "Set your business display name in Profile → Settings before launching." },
        { status: 400 }
      );
    }
  }

  const transitioned = await transitionCampaign(supabase, id, "in_progress", { actor: "user" });
  if (!transitioned.ok) return NextResponse.json({ error: transitioned.error }, { status: 400 });

  after(() => runBackgroundLaunch(id, user.id, channel, campaignName));

  return NextResponse.json({
    ok: true,
    status: "in_progress",
    background: true,
    message: "Campaign started. Queueing and sending continue in the background — use Monitor for progress.",
  });
}
