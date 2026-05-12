"use client";

import { useState } from "react";

export function RoleToggle({ userId, currentRole }: { userId: string; currentRole: string }) {
  const [role, setRole] = useState(currentRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    const newRole = role === "admin" ? "user" : "admin";
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Failed to update role");
        return;
      }
      setRole(newRole);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
          role === "admin"
            ? "bg-purple-500/20 text-purple-300"
            : "bg-zinc-700/50 text-zinc-400"
        }`}
      >
        {role}
      </span>
      <button
        onClick={toggle}
        disabled={loading}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {loading ? "Saving…" : role === "admin" ? "Revoke admin" : "Make admin"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
