import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PhonesAudienceClient } from "./ui";

export default async function PhonesAudiencePage() {
  const t = await getTranslations("phones");
  const supabase = await createClient();
  const { data: audiences } = await supabase
    .from("audiences")
    .select("id, name, created_at")
    .eq("audience_type", "phone")
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
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("subtitle")}</p>
      </div>
      <PhonesAudienceClient initialAudiences={withCounts} />
    </div>
  );
}
