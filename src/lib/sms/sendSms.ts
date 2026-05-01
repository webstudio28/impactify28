import type { SmsProvider, SmsSendOptions, SmsSendResult } from "./types";
import { createBudgetSmsProvider } from "./providers/budgetsms";
import { createConnectixProvider } from "./providers/connectix";
import { createTwilioSmsProvider } from "./providers/twilio";
import { createVonageSmsProvider } from "./providers/vonage";

/**
 * Provider registry: SMS_PROVIDER env value → factory (Guestcap-style).
 */
const providers: Record<string, () => SmsProvider> = {
  budgetsms: () => createBudgetSmsProvider(),
  connectix: () => createConnectixProvider(),
  twilio: () => createTwilioSmsProvider(),
  vonage: () => createVonageSmsProvider(),
};

/**
 * Send an SMS using the provider configured via SMS_PROVIDER env var.
 */
export async function sendSms(
  to: string,
  message: string,
  options?: SmsSendOptions
): Promise<SmsSendResult> {
  const name = process.env.SMS_PROVIDER?.toLowerCase().trim();
  if (!name) {
    throw new Error(`SMS_PROVIDER is not set. Supported: ${Object.keys(providers).join(", ") || "none"}.`);
  }

  const factory = providers[name];
  if (!factory) {
    throw new Error(
      `Unknown SMS provider: "${name}". Supported: ${Object.keys(providers).join(", ") || "none"}.`
    );
  }

  const provider = factory();
  return provider.send(to, message, options);
}

export function listRegisteredSmsProviders(): string[] {
  return Object.keys(providers);
}
