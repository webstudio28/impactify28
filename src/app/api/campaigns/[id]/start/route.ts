import { after } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeCampaignLaunch } from "@/lib/campaigns/execute-launch";
import { processDueOutboundEmail } from "@/lib/campaigns/process-email-queue";
import { processDueOutboundSms } from "@/lib/campaigns/process-queue";
import { syncQueuedCampaignsToCompleted } from "@/lib/campaigns/sync-status";
import {
  emailFailureTicketContext,
  explainResendSendFailure,
  getInvalidPlatformFromWarning,
} from "@/lib/email/resend-errors";
import { createTicket, createSendBatchTickets } from "@/lib/tickets/create-ticket";

type Ctx = { params: Promise<{ id: string }> };

function isDomainError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("domain") ||
    lower.includes("verif") ||
    lower.includes("not allowed") ||
    lower.includes("sender") ||
    lower.includes("validation_error")
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
        .update({ status: "ready_to_launch", updated_at: new Date().toISOString() })
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

    if (channel === "email") {
      const email = await processDueOutboundEmail(supabase, { limit: 50 });
      await syncQueuedCampaignsToCompleted(supabase, email.campaignIds);

      if (email.campaignSummaries.length > 0 && email.processed === 0) {
        await supabase
          .from("campaigns")
          .update({ status: "ready_to_launch", updated_at: new Date().toISOString() })
          .eq("id", campaignId);

        const rawError = email.campaignSummaries[0]?.sampleErrors[0] ?? email.errors[0] ?? "Unknown send error";
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
            sent: email.processed,
            failed: email.errors.length,
            sampleErrors: email.campaignSummaries[0]?.sampleErrors ?? email.errors.slice(0, 5),
          }),
        });
        return;
      }

      void createSendBatchTickets(email.campaignSummaries, "email");
    } else if (channel === "sms") {
      const sms = await processDueOutboundSms(supabase, { limit: 50 });
      await syncQueuedCampaignsToCompleted(supabase, sms.campaignIds);

      if (sms.providerError) {
        await supabase
          .from("campaigns")
          .update({ status: "ready_to_launch", updated_at: new Date().toISOString() })
          .eq("id", campaignId);
        await createTicket({
          kind: "critical",
          title: `SMS provider not configured — ${campaignName}`,
          message: sms.providerError,
          userId,
          campaignId,
          context: { campaignName, channel: "sms", source: "background-launch" },
          deduplicate: true,
        });
        return;
      }

      if (sms.campaignSummaries.length > 0 && sms.processed === 0) {
        await supabase
          .from("campaigns")
          .update({ status: "ready_to_launch", updated_at: new Date().toISOString() })
          .eq("id", campaignId);
        const firstError = sms.campaignSummaries[0]?.sampleErrors[0] ?? sms.errors[0] ?? "Unknown error";
        await createTicket({
          kind: "error",
          title: `All SMS failed — ${campaignName}`,
          message: firstError,
          userId,
          campaignId,
          context: { campaignName, channel: "sms", sampleErrors: sms.errors.slice(0, 5) },
        });
        return;
      }

      void createSendBatchTickets(sms.campaignSummaries, "sms");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Launch failed";
    await supabase
      .from("campaigns")
      .update({ status: "ready_to_launch", updated_at: new Date().toISOString() })
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
  if (row.status !== "ready_to_launch") {
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

  // Claim campaign → running immediately so the UI can refresh
  const { data: claimed, error: claimErr } = await supabase
    .from("campaigns")
    .update({
      status: "running",
      send_rate_minute: null,
      send_rate_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "ready_to_launch")
    .select("id")
    .maybeSingle();

  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 });
  if (!claimed) {
    return NextResponse.json({ error: "Campaign is not ready to start" }, { status: 400 });
  }

  after(() => runBackgroundLaunch(id, user.id, channel, campaignName));

  return NextResponse.json({
    ok: true,
    status: "running",
    background: true,
    message: "Campaign started. Queueing and sending continue in the background — use Monitor for progress.",
  });
}
