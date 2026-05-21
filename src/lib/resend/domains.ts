/** Resend Domains API helpers — register and check verification status. */

export type ResendDnsRecord = {
  record: string;
  name: string;
  type: string;
  ttl: string;
  status: string;
  value: string;
  priority?: number;
};

export type ResendDomain = {
  id: string;
  name: string;
  status: "not_started" | "pending" | "verified" | "failure" | "temporary_failure";
  records: ResendDnsRecord[];
  region: string;
  created_at: string;
};

type ResendErrorResponse = { name: string; message: string; statusCode: number };

function resendKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

/** Extract the domain part from an email address. */
export function domainFromEmail(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase().trim();
  return domain.includes(".") ? domain : null;
}

/**
 * Register a domain in Resend.
 * - If the domain already exists in your account, Resend returns a 422 with
 *   `domain_already_exists`; we fall back to fetching it by listing domains.
 * - Returns the domain object (status may be "pending" until DNS propagates).
 */
export async function registerResendDomain(
  domain: string
): Promise<{ ok: true; domain: ResendDomain } | { ok: false; error: string }> {
  const key = resendKey();
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };

  const res = await fetch("https://api.resend.com/domains", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: domain }),
  });

  if (res.ok) {
    const data = (await res.json()) as ResendDomain;
    return { ok: true, domain: data };
  }

  // 422 = domain already exists in this Resend account
  if (res.status === 422) {
    const err = (await res.json()) as ResendErrorResponse;
    if (err.name === "domain_already_exists") {
      return findDomainByName(domain, key);
    }
  }

  const body = await res.text();
  return { ok: false, error: `Resend error ${res.status}: ${body}` };
}

/**
 * Re-trigger Resend's verification check for a domain and return the updated status.
 */
export async function verifyResendDomain(
  domainId: string
): Promise<{ ok: true; domain: ResendDomain } | { ok: false; error: string }> {
  const key = resendKey();
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };

  // Trigger the verification check
  await fetch(`https://api.resend.com/domains/${domainId}/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
  });

  // Fetch fresh status
  const res = await fetch(`https://api.resend.com/domains/${domainId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `Resend error ${res.status}: ${body}` };
  }

  const data = (await res.json()) as ResendDomain;
  return { ok: true, domain: data };
}

/** Fetch a domain by ID (to refresh status/records). */
export async function getResendDomain(
  domainId: string
): Promise<{ ok: true; domain: ResendDomain } | { ok: false; error: string }> {
  const key = resendKey();
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };

  const res = await fetch(`https://api.resend.com/domains/${domainId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `Resend error ${res.status}: ${body}` };
  }

  const data = (await res.json()) as ResendDomain;
  return { ok: true, domain: data };
}

/** Find an already-registered domain in this Resend account by name. */
async function findDomainByName(
  domain: string,
  key: string
): Promise<{ ok: true; domain: ResendDomain } | { ok: false; error: string }> {
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    return { ok: false, error: `Could not list domains: ${res.status}` };
  }

  const json = (await res.json()) as { data: ResendDomain[] };
  const match = json.data?.find((d) => d.name.toLowerCase() === domain.toLowerCase());

  if (!match) {
    return {
      ok: false,
      error: `Domain ${domain} not found in Resend account after create conflict.`,
    };
  }

  return { ok: true, domain: match };
}
