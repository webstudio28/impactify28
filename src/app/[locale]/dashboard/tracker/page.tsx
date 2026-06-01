import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SalesTrackerClient } from "@/components/tracker/SalesTrackerClient";
import { createClient } from "@/lib/supabase/server";

export default async function SalesTrackerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const t = await getTranslations("salesTracker");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      </div>
      <SalesTrackerClient />
    </div>
  );
}
