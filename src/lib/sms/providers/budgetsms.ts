import type { SmsProvider, SmsSendOptions, SmsSendResult } from "../types";

/**
 * BudgetSMS.net provider (same integration as Guestcap).
 * Docs: https://www.budgetsms.net/sms-http-api/
 */
export function createBudgetSmsProvider(): SmsProvider {
  return {
    async send(to: string, message: string, options?: SmsSendOptions): Promise<SmsSendResult> {
      const username = process.env.BUDGETSMS_USERNAME;
      const userid = process.env.BUDGETSMS_USERID;
      const handle = process.env.BUDGETSMS_HANDLE;

      if (!username || !userid || !handle) {
        throw new Error(
          "BudgetSMS requires BUDGETSMS_USERNAME, BUDGETSMS_USERID, BUDGETSMS_HANDLE in environment"
        );
      }

      const useTest = process.env.BUDGETSMS_USE_TEST !== "0";
      const baseUrl = useTest
        ? "https://api.budgetsms.net/testsms/"
        : "https://api.budgetsms.net/sendsms/";

      const from = options?.senderId || process.env.SMS_SENDER_ID || "Impact28";
      const toClean = to.replace(/\D/g, "");
      if (!toClean) {
        return { ok: false, status: 400, data: { error: "Invalid phone number" } };
      }

      const params = new URLSearchParams({
        username,
        userid,
        handle,
        msg: message,
        from,
        to: toClean,
      });

      const url = `${baseUrl}?${params.toString()}`;
      const res = await fetch(url, { method: "GET" });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        return { ok: false, status: res.status, data };
      }

      const body = data as Record<string, unknown> | null;
      const errCode =
        (typeof body?.status === "number" ? body.status : null) ??
        (typeof body?.error === "number" ? body.error : null) ??
        (typeof body?.code === "number" ? body.code : null);
      const isError = typeof errCode === "number" && errCode >= 1001 && errCode <= 7903;

      if (isError) {
        return {
          ok: false,
          status: 400,
          data: body || { error: `BudgetSMS error ${errCode}` },
        };
      }

      return { ok: true, status: 200, data: body };
    },
  };
}
