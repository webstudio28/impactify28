const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-700/50 text-zinc-400",
  pending_approval: "bg-amber-500/15 text-amber-300",
  ready_to_launch: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-red-500/15 text-red-300",
  running: "bg-green-500/15 text-green-400",
  in_progress: "bg-green-500/15 text-green-400",
  paused: "bg-yellow-500/15 text-yellow-400",
  paused_system: "bg-orange-500/15 text-orange-300",
  open: "bg-orange-500/15 text-orange-300",
  resolved: "bg-zinc-700/50 text-zinc-400",
  completed: "bg-blue-500/15 text-blue-400",
  failed: "bg-red-500/15 text-red-400",
  cancelled: "bg-zinc-700/50 text-zinc-500",
  queued: "bg-teal-500/15 text-teal-300",
  sent: "bg-green-500/15 text-green-400",
  pending: "bg-yellow-500/15 text-yellow-400",
  admin: "bg-purple-500/15 text-purple-400",
  user: "bg-zinc-700/50 text-zinc-500",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-zinc-700/50 text-zinc-400";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {status}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        channel === "email"
          ? "bg-indigo-500/15 text-indigo-400"
          : "bg-teal-500/15 text-teal-400"
      }`}
    >
      {channel === "email" ? "✉" : "💬"} {channel}
    </span>
  );
}
