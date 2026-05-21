import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeCampaignLaunch } from "@/lib/campaigns/execute-launch";
import { processDueOutboundEmail } from "@/lib/campaigns/process-email-queue";
import { processDueOutboundSms } from "@/lib/campaigns/process-queue";
import { syncQueuedCampaignsToCompleted } from "@/lib/campaigns/sync-status";
import { createTicket, createSendBatchTickets } from "@/lib/tickets/create-ticket";

type Ctx = { params: Promise<{ id: string }> };

/** Heuristic: if the first error mentions domain / verification / unverified, treat as critical */
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

  const result = await executeCampaignLaunch(supabase, id);
  if (!result.ok) {
    // Already ticketed & reset inside execute-launch for config errors
    if ("ticketed" in result && result.ticketed) {
      return NextResponse.json({ error: "Something went wrong. Please try again later." }, { status: 500 });
    }
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // ── Trigger immediate send for email campaigns ────────────────────────────
  if (channel === "email") {
    try {
      const email = await processDueOutboundEmail(supabase, { limit: 50 });
      await syncQueuedCampaignsToCompleted(supabase, email.campaignIds);

      // All emails failed → reset campaign, create critical or error ticket
      if (email.campaignSummaries.length > 0 && email.processed === 0) {
        await supabase
          .from("campaigns")
          .update({ status: "ready_to_launch", updated_at: new Date().toISOString() })
          .eq("id", id);

        const firstError = email.campaignSummaries[0]?.sampleErrors[0] ?? email.errors[0] ?? "Unknown send error";
        const kind = isDomainError(firstError) ? "critical" : "error";

        await createTicket({
          kind,
          title: `${kind === "critical" ? "Domain/sender issue" : "All emails failed"} — ${campaignName}`,
          message: firstError,
          userId: user.id,
          campaignId: id,
          context: {
            campaignName,
            channel: "email",
            sent: email.processed,
            failed: email.errors.length,
            sampleErrors: email.errors.slice(0, 5),
          },
        });

        return NextResponse.json(
          { error: "Something went wrong. Please try again later." },
          { status: 502 }
        );
      }

      // Partial failures → warning tickets (fire-and-forget, don't block response)
      void createSendBatchTickets(email.campaignSummaries, "email");

      return NextResponse.json({
        ok: true,
        status: "running",
        email: { processed: email.processed, errors: email.errors.length },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Email queue processing failed";
      await supabase
        .from("campaigns")
        .update({ status: "ready_to_launch", updated_at: new Date().toISOString() })
        .eq("id", id);
      await createTicket({
        kind: "error",
        title: `Email queue crashed — ${campaignName}`,
        message: msg,
        userId: user.id,
        campaignId: id,
        context: { campaignName, channel: "email", source: "api/campaigns/[id]/start" },
      });
      return NextResponse.json(
        { error: "Something went wrong. Please try again later." },
        { status: 500 }
      );
    }
  }

  // ── SMS campaigns: trigger a quick send pass ──────────────────────────────
  if (channel === "sms") {
    try {
      const sms = await processDueOutboundSms(supabase, { limit: 50 });
      await syncQueuedCampaignsToCompleted(supabase, sms.campaignIds);

      if (sms.providerError) {
        await supabase
          .from("campaigns")
          .update({ status: "ready_to_launch", updated_at: new Date().toISOString() })
          .eq("id", id);
        await createTicket({
          kind: "critical",
          title: `SMS provider not configured — ${campaignName}`,
          message: sms.providerError,
          userId: user.id,
          campaignId: id,
          context: { campaignName, channel: "sms", source: "api/campaigns/[id]/start" },
          deduplicate: true,
        });
        return NextResponse.json(
          { error: "Something went wrong. Please try again later." },
          { status: 500 }
        );
      }

      if (sms.campaignSummaries.length > 0 && sms.processed === 0) {
        await supabase
          .from("campaigns")
          .update({ status: "ready_to_launch", updated_at: new Date().toISOString() })
          .eq("id", id);
        const firstError = sms.campaignSummaries[0]?.sampleErrors[0] ?? sms.errors[0] ?? "Unknown error";
        await createTicket({
          kind: "error",
          title: `All SMS failed — ${campaignName}`,
          message: firstError,
          userId: user.id,
          campaignId: id,
          context: { campaignName, channel: "sms", sampleErrors: sms.errors.slice(0, 5) },
        });
        return NextResponse.json(
          { error: "Something went wrong. Please try again later." },
          { status: 502 }
        );
      }

      void createSendBatchTickets(sms.campaignSummaries, "sms");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "SMS queue processing failed";
      void createTicket({
        kind: "error",
        title: `SMS queue crashed — ${campaignName}`,
        message: msg,
        userId: user.id,
        campaignId: id,
        context: { campaignName, channel: "sms" },
      });
    }
  }

  return NextResponse.json({ ok: true, status: "running" });
}
