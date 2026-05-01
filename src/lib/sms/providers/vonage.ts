import type { SmsProvider, SmsSendOptions, SmsSendResult } from "../types";

/**
 * Vonage SMS via REST (stable, low SDK coupling).
 */
export function createVonageSmsProvider(): SmsProvider {
  return {
    async send(to: string, message: string, options?: SmsSendOptions): Promise<SmsSendResult> {
      const key = process.env.VONAGE_API_KEY;
      const secret = process.env.VONAGE_API_SECRET;
      const from =
        options?.senderId?.trim() || process.env.VONAGE_FROM_NUMBER?.trim();

      if (!key || !secret || !from) {
        throw new Error(
          "Vonage requires VONAGE_API_KEY, VONAGE_API_SECRET, and VONAGE_FROM_NUMBER (or senderId)."
        );
      }

      const params = new URLSearchParams({
        api_key: key,
        api_secret: secret,
        to,
        from,
        text: message,
      });

      const res = await fetch("https://rest.nexmo.com/sms/json", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      const rawText = await res.text();
      let data: unknown = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = { raw: rawText };
      }

      if (!res.ok) {
        return { ok: false, status: res.status, data };
      }

      const payload = data as {
        messages?: Array<{ status?: string; "message-id"?: string; "error-text"?: string }>;
      };
      const first = payload.messages?.[0];
      if (!first || first.status !== "0") {
        return {
          ok: false,
          status: 400,
          data: { error: first?.["error-text"] ?? "Vonage send failed", detail: data },
        };
      }

      return {
        ok: true,
        status: 200,
        data: { "message-id": first["message-id"], messages: payload.messages },
      };
    },
  };
}
