import twilio from "twilio";
import type { SmsProvider, SmsSendOptions, SmsSendResult } from "../types";

export function createTwilioSmsProvider(): SmsProvider {
  return {
    async send(to: string, message: string, options?: SmsSendOptions): Promise<SmsSendResult> {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from =
        options?.senderId?.trim() || process.env.TWILIO_FROM_NUMBER?.trim();

      if (!sid || !token || !from) {
        throw new Error(
          "Twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER (or senderId)."
        );
      }

      try {
        const client = twilio(sid, token);
        const msg = await client.messages.create({ from, to, body: message });
        return { ok: true, status: 200, data: { sid: msg.sid, status: msg.status } };
      } catch (e) {
        const err =
          typeof e === "object" &&
          e !== null &&
          "message" in e &&
          typeof (e as { message?: unknown }).message === "string"
            ? (e as { message: string }).message
            : "Twilio send failed";
        return { ok: false, status: 500, data: { error: err } };
      }
    },
  };
}
