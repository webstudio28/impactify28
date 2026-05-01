import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CampaignWizard } from "@/components/campaigns/CampaignWizard";

export default async function NewCampaignPage({ searchParams }: { searchParams: { id?: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!searchParams.id) {
    const { data, error } = await supabase
      .from("campaigns")
      .insert({ user_id: user.id, name: "New campaign", status: "draft" })
      .select("id")
      .single();

    if (error || !data) {
      redirect("/dashboard/campaigns");
    }
    redirect(`/dashboard/campaigns/new?id=${data.id}`);
  }

  return (
    <Suspense
      fallback={<div className="mx-auto max-w-xl text-sm text-ink-muted">Loading wizard…</div>}
    >
      <CampaignWizard />
    </Suspense>
  );
}
