/** Owner / ops inbox from env (no trailing logic in every action). */
export function getOwnerEmail(): string | null {
  const raw = process.env.OWNER_EMAIL?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function shouldSendOwnerCopy(customerEmail: string): boolean {
  const owner = getOwnerEmail();
  if (!owner) return false;
  return owner.toLowerCase() !== customerEmail.trim().toLowerCase();
}
