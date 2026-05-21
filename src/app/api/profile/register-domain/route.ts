import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerResendDomain } from "@/lib/resend/domains";

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * POST /api/profile/register-domain
 * Explicitly registers a domain in Resend and persists the result to the profile.
 * Body: { domain: string }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { domain?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.domain !== "string" || !body.domain.trim()) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  const domain = body.domain.trim().toLowerCase();

  if (!DOMAIN_RE.test(domain)) {
    return NextResponse.json(
      { error: `"${domain}" is not a valid domain name (e.g. yourcompany.com)` },
      { status: 400 }
    );
  }

  const result = await registerResendDomain(domain);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const { error: dbErr } = await supabase
    .from("profiles")
    .update({
      resend_domain_id: result.domain.id,
      resend_domain_status: result.domain.status,
      resend_domain_records: result.domain.records,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({
    resend_domain_id: result.domain.id,
    resend_domain_status: result.domain.status,
    resend_domain_records: result.domain.records,
  });
}
