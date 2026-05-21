import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyResendDomain } from "@/lib/resend/domains";

/**
 * GET /api/profile/domain-status
 * Re-triggers Resend's verification check and returns the latest DNS records + status.
 * Call this when the user wants to refresh their domain verification state.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("resend_domain_id, resend_domain_status, resend_domain_records, sender_email")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (!profile.resend_domain_id) {
    return NextResponse.json(
      { error: "No domain registered yet. Save a sender email first." },
      { status: 404 }
    );
  }

  const result = await verifyResendDomain(profile.resend_domain_id as string);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Persist the refreshed status back to the profile
  await supabase
    .from("profiles")
    .update({
      resend_domain_status: result.domain.status,
      resend_domain_records: result.domain.records,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  return NextResponse.json({
    domain: result.domain.name,
    status: result.domain.status,
    records: result.domain.records,
  });
}
