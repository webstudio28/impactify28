import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicAppOrigin } from "@/lib/site/public-url";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const origin = publicAppOrigin();
  const scriptUrl = `${origin}/tracker.js`;

  const loaderSnippet = `<script src="${scriptUrl}" data-workspace="${user.id}"></script>`;

  const checkoutSnippet = `<script>
  window.impact28.trackConversion({
    orderId: "ORDER_ID",
    value: 99.90,
    currency: "EUR"
  });
</script>`;

  const { data: lastEvent } = await supabase
    .from("campaign_sales_events")
    .select("order_id, order_value, currency, event_time, source, campaign_id")
    .eq("user_id", user.id)
    .order("event_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    workspaceId: user.id,
    scriptUrl,
    loaderSnippet,
    checkoutSnippet,
    lastEvent: lastEvent ?? null,
  });
}
