"use client";

import { useRef, useEffect } from "react";
import type { ImprovementField, ImprovementIssue } from "@/lib/openai/email-improvements";

type Props = {
  field: ImprovementField;
  label: React.ReactNode;
  issues: ImprovementIssue[];
  dismissed: Set<ImprovementField>;
  openPopover: ImprovementField | null;
  onOpenPopover: (field: ImprovementField | null) => void;
  onApplySuggestion: (field: ImprovementField, text: string) => void;
  seeSuggestionsLabel: string;
  children: React.ReactNode;
};

export function EmailImprovementField({
  field,
  label,
  issues,
  dismissed,
  openPopover,
  onOpenPopover,
  onApplySuggestion,
  seeSuggestionsLabel,
  children,
}: Props) {
  const issue = issues.find((i) => i.field === field);
  const highlighted = Boolean(issue) && !dismissed.has(field);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openPopover !== field) return;
    function onDocClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onOpenPopover(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openPopover, field, onOpenPopover]);

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {highlighted ? (
          <span className="text-amber-500" title={issue?.reason} aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
          </span>
        ) : null}
      </div>
      <div className={highlighted ? "mt-1 rounded-lg ring-2 ring-amber-400" : "mt-1"}>{children}</div>
      {highlighted && issue ? (
        <div className="mt-2 space-y-1" ref={popoverRef}>
          <p className="text-xs text-amber-800">{issue.reason}</p>
          <button
            type="button"
            onClick={() => onOpenPopover(openPopover === field ? null : field)}
            className="text-xs font-medium text-accent hover:underline"
          >
            {seeSuggestionsLabel}
          </button>
          {openPopover === field ? (
            <div className="absolute left-0 z-20 mt-1 w-full max-w-md rounded-lg border border-zinc-200 bg-white p-2 shadow-lg">
              <ul className="space-y-1">
                {issue.suggestions.map((s, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => {
                        onApplySuggestion(field, s);
                        onOpenPopover(null);
                      }}
                      className="w-full rounded-md px-2 py-2 text-left text-xs text-ink hover:bg-zinc-50"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
