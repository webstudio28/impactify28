import type { SmsProvider, SmsSendOptions, SmsSendResult } from "../types";

const CONNECTIX_BASE_LIVE = "https://api.connectix.bg";
const CONNECTIX_BASE_SANDBOX = "https://api-sandbox.connectix.bg";

/**
 * Connectix.bg SMS provider (ported from Guestcap).
 */
export function createConnectixProvider(): SmsProvider {
  return {
    async send(to: string, message: string, _options?: SmsSendOptions): Promise<SmsSendResult> {
      const token = process.env.CONNECTIX_TOKEN;
      const templateId = process.env.CONNECTIX_TEMPLATE_ID;
      const messageParam = process.env.CONNECTIX_TEMPLATE_MESSAGE_PARAM?.trim() || "test_text";

      if (!token?.trim()) {
        throw new Error("Connectix requires CONNECTIX_TOKEN in environment");
      }
      if (!templateId?.trim()) {
        throw new Error("Connectix requires CONNECTIX_TEMPLATE_ID in environment");
      }

      const useSandbox = /^(1|true|yes)$/i.test(String(process.env.CONNECTIX_SANDBOX ?? "").trim());
      const baseOverride = process.env.CONNECTIX_BASE?.trim();
      const base = baseOverride || (useSandbox ? CONNECTIX_BASE_SANDBOX : CONNECTIX_BASE_LIVE);

      const digits = to.replace(/\D/g, "");
      let phone: string;
      if (to.startsWith("+")) {
        phone = to.trim();
      } else if (digits.startsWith("359") && digits.length >= 12) {
        phone = `+${digits}`;
      } else if (digits.startsWith("0") && digits.length >= 9) {
        phone = `+359${digits.slice(1)}`;
      } else if (digits.length >= 9) {
        phone = `+359${digits}`;
      } else {
        phone = `+${digits}`;
      }
      if (!phone || phone.length < 10) {
        return { ok: false, status: 400, data: { error: "Invalid phone number" } };
      }

      const url = new URL(`${base}/messages`);
      url.searchParams.set("integration", token.trim());

      const body = {
        template: templateId.trim(),
        phone,
        parameters: { [messageParam]: message },
      };

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          Authorization: token.trim(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      let data: unknown = null;
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data: data as Record<string, unknown>,
        };
      }

      return { ok: true, status: res.status, data };
    },
  };
}
