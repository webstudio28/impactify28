import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkSalesIngestRateLimit } from "@/lib/sales/rate-limit";

type Body = { currency?: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* empty body ok */
  }

  const currency = (body.currency?.trim() || "BGN").toUpperCase().slice(0, 8);
  const orderId = `tracker-test-${Date.now()}`;

  const allowed = await checkSalesIngestRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("campaign_sales_events").upsert(
    {
      user_id: user.id,
      order_id: orderId,
      campaign_id: null,
      recipient_token: null,
      order_value: 1,
      currency,
      event_time: new Date().toISOString(),
      source: "test",
    },
    { onConflict: "user_id,order_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    orderId,
    value: 1,
    currency,
    message: "Test conversion recorded.",
  });
}
