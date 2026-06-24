import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PhoneAudienceDetail } from "./ui";

type Props = { params: Promise<{ id: string }> };

export default async function PhoneAudienceDetailPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("phones");

  const supabase = await createClient();
  const { data: audience, error } = await supabase
    .from("audiences")
    .select("id, name, audience_type, created_at")
    .eq("id", id)
    .eq("audience_type", "phone")
    .single();

  if (error || !audience) notFound();

  const { count } = await supabase
    .from("audience_members")
    .select("*", { count: "exact", head: true })
    .eq("audience_id", id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/audience/phones" className="text-sm text-ink-muted hover:text-ink">
        {t("backToLists")}
      </Link>
      <PhoneAudienceDetail
        audienceId={id}
        initialAudience={{ id: audience.id, name: audience.name, count: count ?? 0 }}
      />
    </div>
  );
}
