import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, status, created_at, scheduled_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-ink-muted">Linear SMS sequences for your store.</p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent-hover"
        >
          Create new campaign
        </Link>
      </div>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Schedule</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {(campaigns ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink-muted">
                  No campaigns yet.{" "}
                  <Link href="/dashboard/campaigns/new" className="font-medium text-accent hover:text-accent-hover">
                    Create one
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              campaigns?.map((c) => (
                <tr key={c.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                  <td className="px-4 py-3 capitalize text-ink-muted">{c.status}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
