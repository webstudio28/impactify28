"use client";

import { DomainSetupModal } from "./DomainSetupModal";

interface Props {
  hasSenderEmail: boolean;
  children: React.ReactNode;
}

/**
 * Wraps dashboard content. When the profile has no sender_email set,
 * it blurs the content and renders the mandatory domain-setup modal.
 */
export function DomainSetupGate({ hasSenderEmail, children }: Props) {
  if (hasSenderEmail) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Dashboard content rendered but blurred so the user gets context */}
      <div className="pointer-events-none select-none blur-sm" aria-hidden="true">
        {children}
      </div>
      <DomainSetupModal />
    </>
  );
}
