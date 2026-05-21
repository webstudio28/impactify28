import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { StatusBadge, ChannelBadge } from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

function DeliveryBar({
  sent,
  failed,
  pending,
}: {
  sent: number;
  failed: number;
  pending: number;
}) {
  const total = sent + failed + pending;
  if (total === 0) return <p className="text-sm text-zinc-600">No messages queued.</p>;

  const sentPct = (sent / total) * 100;
  const failedPct = (failed / total) * 100;
  const pendingPct = (pending / total) * 100;

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="bg-green-500" style={{ width: `${sentPct}%` }} />
        <div className="bg-red-500" style={{ width: `${failedPct}%` }} />
        <div className="bg-zinc-600" style={{ width: `${pendingPct}%` }} />
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-zinc-400">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          Sent: <strong className="text-white">{sent.toLocaleString()}</strong>
          <span className="text-zinc-600">({sentPct.toFixed(1)}%)</span>
        </span>
        <span className="flex items-center gap-1.5 text-zinc-400">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          Failed: <strong className="text-white">{failed.toLocaleString()}</strong>
          <span className="text-zinc-600">({failedPct.toFixed(1)}%)</span>
        </span>
        <span className="flex items-center gap-1.5 text-zinc-400">
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-600" />
          Pending: <strong className="text-white">{pending.toLocaleString()}</strong>
          <span className="text-zinc-600">({pendingPct.toFixed(1)}%)</span>
        </span>
        <span className="text-zinc-600">Total: {total.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default async function AdminCampaignDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const adminUser = await getAdminUser();
  if (!adminUser) redirect(`/${locale}/dashboard`);

  const db = createAdminClient();

  const [
    { data: campaign },
    { data: steps },
    { data: recentSms },
    { data: recentEmail },
    { count: smsSent },
    { count: smsFailed },
    { count: smsPending },
    { count: emailSent },
    { count: emailFailed },
    { count: emailPending },
  ] = await Promise.all([
    db
      .from("campaigns")
      .select(`
        id, name, status, channel, scheduled_at, send_immediately,
        created_at, updated_at, user_id, email_subject,
        send_rate_count, audience_id,
        profiles!inner(id, business_name, sender_email, sender_display_name),
        audiences(id, name, audience_type, audience_members(count))
      `)
      .eq("id", id)
      .single(),
    db
      .from("campaign_steps")
      .select("id, step_order, body, link_url, delay_after_previous_hours")
      .eq("campaign_id", id)
      .order("step_order"),
    db
      .from("outbound_sms")
      .select("id, to_phone, body, status, run_at, updated_at, error_message, step_order")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("outbound_email")
      .select("id, to_email, subject, status, run_at, updated_at, error_message")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "sent"),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "failed"),
    db.from("outbound_sms").select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "pending"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "sent"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "failed"),
    db.from("outbound_email").select("*", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "pending"),
  ]);

  if (!campaign) notFound();

  type ProfilesJoin = { id: string; business_name: string; sender_email: string | null; sender_display_name: string | null };
  type AudienceJoin = { id: string; name: string; audience_type: string; audience_members: { count: number }[] };

  const profilesRaw = campaign.profiles as unknown;
  const audienceRaw = campaign.audiences as unknown;
  const profiles: ProfilesJoin | null = Array.isArray(profilesRaw)
    ? (profilesRaw as ProfilesJoin[])[0] ?? null
    : (profilesRaw as ProfilesJoin | null);
  const audienceData: AudienceJoin | null = Array.isArray(audienceRaw)
    ? (audienceRaw as AudienceJoin[])[0] ?? null
    : (audienceRaw as AudienceJoin | null);
  const audienceMemberCount = Array.isArray(audienceData?.audience_members)
    ? audienceData!.audience_members[0]?.count ?? 0
    : 0;

  const isSms = campaign.channel === "sms";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-600">
        <Link href={`/${locale}/admin/campaigns`} className="transition hover:text-zinc-300">
          Campaigns
        </Link>
        <span>/</span>
        <span className="text-zinc-400">{campaign.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
            <ChannelBadge channel={campaign.channel} />
            <StatusBadge status={campaign.status} />
          </div>
          {campaign.email_subject && (
            <p className="mt-1 text-sm text-zinc-500">Subject: {campaign.email_subject}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600">
            <Link
              href={`/${locale}/admin/users/${campaign.user_id}`}
              className="transition hover:text-zinc-300"
            >
              By: {profiles?.business_name ?? "—"}
            </Link>
            <span>Created: {new Date(campaign.created_at).toLocaleString()}</span>
            {campaign.scheduled_at && (
              <span>Scheduled: {new Date(campaign.scheduled_at).toLocaleString()}</span>
            )}
            {campaign.send_immediately && <span>Send immediately</span>}
          </div>
        </div>
        {!isSms && (
          <a
            href={`/api/admin/campaigns/${id}/email-preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Preview email ↗
          </a>
        )}
      </div>

      {/* Audience */}
      {audienceData && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-600">
            Audience
          </h2>
          <div className="flex items-center gap-4">
            <div>
              <p className="font-medium text-zinc-200">{audienceData.name}</p>
              <p className="text-xs text-zinc-600 capitalize">{audienceData.audience_type}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold tabular-nums text-white">{audienceMemberCount.toLocaleString()}</p>
              <p className="text-xs text-zinc-600">contacts</p>
            </div>
          </div>
        </section>
      )}

      {/* Delivery analytics */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-600">
          Delivery Analytics
        </h2>
        {isSms ? (
          <DeliveryBar
            sent={smsSent ?? 0}
            failed={smsFailed ?? 0}
            pending={smsPending ?? 0}
          />
        ) : (
          <DeliveryBar
            sent={emailSent ?? 0}
            failed={emailFailed ?? 0}
            pending={emailPending ?? 0}
          />
        )}
      </section>

      {/* Campaign steps (SMS) */}
      {isSms && (steps ?? []).length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">
            SMS Steps ({steps!.length})
          </h2>
          <div className="space-y-3">
            {steps!.map((step) => (
              <div
                key={step.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="mb-2 flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-400">
                    {step.step_order}
                  </span>
                  {step.delay_after_previous_hours > 0 && (
                    <span className="text-xs text-zinc-600">
                      +{step.delay_after_previous_hours}h after previous
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-300">{step.body}</p>
                {step.link_url && (
                  <p className="mt-1.5 text-xs text-blue-400 truncate">{step.link_url}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Message list */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">
          {isSms ? `Recent SMS Messages (showing up to 100)` : `Recent Emails (showing up to 100)`}
        </h2>
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          {isSms ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">To</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">Step</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">Scheduled</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {(recentSms ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-600">
                      No SMS messages.
                    </td>
                  </tr>
                ) : (
                  (recentSms ?? []).map((m) => (
                    <tr key={m.id} className="transition hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-mono text-zinc-300">{m.to_phone}</td>
                      <td className="px-4 py-3 text-zinc-500">{m.step_order}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={m.status} />
                        {m.status === "failed" && m.error_message && (
                          <p className="mt-0.5 text-xs text-red-500 truncate max-w-xs" title={m.error_message}>
                            {m.error_message}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(m.run_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(m.updated_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">To</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">Subject</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">Scheduled</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {(recentEmail ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-600">
                      No emails.
                    </td>
                  </tr>
                ) : (
                  (recentEmail ?? []).map((m) => (
                    <tr key={m.id} className="transition hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-mono text-zinc-300">{m.to_email}</td>
                      <td className="px-4 py-3 text-zinc-400 truncate max-w-xs">{m.subject}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={m.status} />
                        {m.status === "failed" && m.error_message && (
                          <p className="mt-0.5 text-xs text-red-500 truncate max-w-xs" title={m.error_message}>
                            {m.error_message}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(m.run_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(m.updated_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
