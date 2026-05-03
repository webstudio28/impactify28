/** Build Resend `from` header: optional display name + verified mailbox. */
export function formatResendFrom(
  senderEmail: string | null | undefined,
  senderDisplayName: string | null | undefined
): string | null {
  const email = senderEmail?.trim();
  if (!email) return null;
  const rawName = senderDisplayName?.trim();
  if (!rawName) return email;
  const safeName = rawName.replace(/[\r\n<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  if (!safeName) return email;
  return `${safeName} <${email}>`;
}
