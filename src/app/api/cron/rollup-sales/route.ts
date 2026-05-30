import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rollupCampaignSales } from "@/lib/sales/rollup";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handleCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return unauthorized();
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 503 });
  }

  try {
    const result = await rollupCampaignSales(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Rollup failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Heartbeat: aggregate campaign sales into 12-hour rollup windows. */
export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
