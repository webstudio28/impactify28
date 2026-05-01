import { createClient } from "@/lib/supabase/server";
import { EmailsAudienceClient } from "./ui";

export default async function EmailsAudiencePage() {
  const supabase = await createClient();
  const { data: audiences } = await supabase
    .from("audiences")
    .select("id, name, created_at")
    .eq("audience_type", "email")
    .order("created_at", { ascending: false });

  const withCounts = await Promise.all(
    (audiences ?? []).map(async (a) => {
      const { count } = await supabase
        .from("audience_members")
        .select("*", { count: "exact", head: true })
        .eq("audience_id", a.id);
      return { ...a, count: count ?? 0 };
    })
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Store email lists for future features. SMS campaigns use phone lists only.
        </p>
      </div>
      <EmailsAudienceClient initialAudiences={withCounts} />
    </div>
  );
}
