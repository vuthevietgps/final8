import { ChatMessage } from '../chat-message.service';

/**
 * Find the most recent adGroupId from a list of chat messages.
 * Iterates from the end to the start for efficiency.
 */
export function findLastAdGroupFromMessages(list: ChatMessage[] | undefined): string | undefined {
  if (!list || !list.length) return undefined;
  for (let i = list.length - 1; i >= 0; i--) {
    const adg = (list[i] as any)?.adGroupId;
    if (adg) return String(adg);
  }
  return undefined;
}

/**
 * Strict check for a Vietnamese phone number pattern (optional leading +84/0 and 9-10 digits).
 * Not used directly in UI logic (which trusts backend denormalized orderPhone),
 * but provided for future backfill/validation utilities.
 */
export function isValidVietnamPhoneStrict(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const s = String(phone).replace(/\s|\(|\)|-/g, '');
  return /^(\+?84|0)([0-9]{9,10})$/.test(s);
}
