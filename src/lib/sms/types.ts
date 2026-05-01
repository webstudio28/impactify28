/**
 * Result returned by any SMS provider (Guestcap-aligned).
 */
export interface SmsSendResult {
  ok: boolean;
  status: number;
  data?: unknown;
}

/**
 * Options passed to sendSms (provider-agnostic).
 */
export interface SmsSendOptions {
  senderId?: string;
  callbackUrl?: string;
}

/**
 * Each provider implements this. Register new providers in sendSms.ts.
 */
export interface SmsProvider {
  send(to: string, message: string, options?: SmsSendOptions): Promise<SmsSendResult>;
}
