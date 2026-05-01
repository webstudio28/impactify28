import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processDueOutboundSms } from "@/lib/campaigns/process-queue";

/**
 * Vercel Cron / scheduler — same authorization pattern as other server crons.
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 503 });
  }

  try {
    const result = await processDueOutboundSms(admin, { limit: 50 });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Process failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
