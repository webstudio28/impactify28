"use client";

import { useState } from "react";
import { ProfileSettingsModal } from "./ProfileSettingsModal";

interface Props {
  userEmail: string;
}

export function ProfileButton({ userEmail }: Props) {
  const [open, setOpen] = useState(false);
  const initial = userEmail.charAt(0).toUpperCase();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-surface-muted"
        aria-label="Open profile settings"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-ink">{userEmail}</span>
          <span className="block text-xs text-ink-muted">Settings</span>
        </span>
        <svg
          className="h-3.5 w-3.5 shrink-0 text-zinc-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {open && (
        <ProfileSettingsModal
          onClose={() => setOpen(false)}
          userEmail={userEmail}
        />
      )}
    </>
  );
}
