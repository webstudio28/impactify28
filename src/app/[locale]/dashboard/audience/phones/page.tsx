import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhonesAudienceList } from "./ui";

export default async function PhonesAudiencePage() {
  const t = await getTranslations("phones");
  const tHub = await getTranslations("audienceHub");
  const locale = await getLocale();
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
      <Link href="/dashboard/audience" className="text-sm text-ink-muted hover:text-ink">
        {tHub("backToHub")}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t("subtitle")}</p>
      </div>
      <PhonesAudienceList initialAudiences={withCounts} locale={locale} />
    </div>
  );
}
