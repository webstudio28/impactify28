/** Human-readable Resend send failures for admins and outbound_email rows. */

export type EmailSendContext = {
  platformFrom: string | null;
  fromHeader: string | null;
  replyTo?: string | null;
};

export function domainFromAddress(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

/** Warn if RESEND_FROM_EMAIL cannot work with Resend (e.g. @gmail.com). */
export function getInvalidPlatformFromWarning(platformFrom: string | null): string | null {
  if (!platformFrom?.trim()) {
    return "RESEND_FROM_EMAIL is not set in .env.local. Set it to an address on your verified domain, e.g. hello@impactify28.com";
  }
  const domain = domainFromAddress(platformFrom);
  if (!domain) return `RESEND_FROM_EMAIL "${platformFrom}" is not a valid email address.`;

  const blocked = ["gmail.com", "googlemail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com"];
  if (blocked.includes(domain)) {
    return (
      `RESEND_FROM_EMAIL is set to ${platformFrom}, but Resend cannot send from @${domain} — you cannot verify Google/Microsoft mail in Resend. ` +
      `Change .env.local to an address on your own domain (e.g. hello@impactify28.com), restart the server, then verify that domain at resend.com/domains.`
    );
  }
  return null;
}

/**
 * Turn Resend API errors into a clear message: which address failed and what to fix.
 */
export function explainResendSendFailure(rawError: string, ctx: EmailSendContext): string {
  const platformFrom = ctx.platformFrom?.trim() || null;
  const replyTo = ctx.replyTo?.trim() || null;
  const platformDomain = platformFrom ? domainFromAddress(platformFrom) : null;

  const invalidPlatform = getInvalidPlatformFromWarning(platformFrom);
  if (invalidPlatform) return invalidPlatform;

  const lower = rawError.toLowerCase();
  const domainMatch = rawError.match(/The\s+([^\s]+)\s+domain is not verified/i);
  const failingDomain = domainMatch?.[1]?.toLowerCase() ?? null;

  if (lower.includes("domain") && (lower.includes("not verified") || lower.includes("verif"))) {
    const lines: string[] = [];

    if (failingDomain && platformDomain && failingDomain === platformDomain) {
      lines.push(
        `Platform send address (RESEND_FROM_EMAIL): ${platformFrom} — domain "${failingDomain}" is not verified in Resend.`
      );
      lines.push(
        `Fix: In Resend → Domains, verify ${failingDomain}, or change RESEND_FROM_EMAIL in .env.local to an address on an already-verified domain, then restart npm run dev.`
      );
    } else if (failingDomain) {
      lines.push(`Resend rejected domain "${failingDomain}" (not verified).`);
      if (platformFrom) lines.push(`Configured platform From: ${platformFrom}`);
    } else {
      lines.push(rawError);
    }

    if (replyTo) {
      lines.push(
        `User reply-to (${replyTo}) is only used for replies — it does NOT need Resend verification and is NOT the cause of this error unless shown above.`
      );
    } else {
      lines.push("User reply-to: not set (optional in profile settings).");
    }

    if (ctx.fromHeader) lines.push(`Full From header sent to Resend: ${ctx.fromHeader}`);

    return lines.join(" ");
  }

  if (lower.includes("request.body") && lower.includes("array")) {
    return (
      `${rawError} — Resend batch send expects a JSON array of email objects, not a wrapped object. ` +
      `Platform From: ${platformFrom ?? "(not set)"}.`
    );
  }

  if (lower.includes("validation_error")) {
    return `${rawError} | Platform From: ${platformFrom ?? "(not set)"}${replyTo ? ` | User reply-to: ${replyTo}` : ""}`;
  }

  return rawError;
}

/** Context fields stored on tickets for the admin UI. */
export function emailFailureTicketContext(
  ctx: EmailSendContext & {
    campaignName?: string;
    sent?: number;
    failed?: number;
    sampleErrors?: string[];
  }
): Record<string, unknown> {
  const platformFrom = ctx.platformFrom?.trim() || null;
  const replyTo = ctx.replyTo?.trim() || null;
  return {
    channel: "email",
    campaignName: ctx.campaignName ?? "",
    sent: ctx.sent ?? 0,
    failed: ctx.failed ?? 0,
    platformFromEmail: platformFrom ?? "(not set in RESEND_FROM_EMAIL)",
    displayFromHeader: ctx.fromHeader ?? "",
    userReplyTo: replyTo ?? "(not set — optional)",
    sampleErrors: ctx.sampleErrors?.slice(0, 5) ?? [],
    fixHint: getInvalidPlatformFromWarning(platformFrom) ?? (
      platformFrom
        ? `Verify ${domainFromAddress(platformFrom) ?? "your domain"} in Resend, or change RESEND_FROM_EMAIL in .env.local.`
        : "Set RESEND_FROM_EMAIL in .env.local to hello@impactify28.com (or similar on your verified domain)."
    ),
  };
}
