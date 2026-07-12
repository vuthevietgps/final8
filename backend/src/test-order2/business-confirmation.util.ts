import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

export const BUSINESS_CONFIRMATION_SOURCES = [
  'erp_manual_confirmation',
  'pending_order_approval',
] as const;
export type BusinessConfirmationSource = (typeof BUSINESS_CONFIRMATION_SOURCES)[number];

export const BUSINESS_CONFIRMATION_FIELDS = [
  'businessConfirmedAt',
  'businessConfirmedBy',
  'businessConfirmationSource',
] as const;

export interface BusinessConfirmationAudit {
  businessConfirmedAt: Date;
  businessConfirmedBy: Types.ObjectId;
  businessConfirmationSource: BusinessConfirmationSource;
}

/**
 * Build the immutable, server-owned values for the absent -> confirmed state
 * transition. Neither the timestamp, actor nor source is accepted from the
 * request body.
 */
export function businessConfirmationAudit(
  currentUser: any,
  source: BusinessConfirmationSource,
  at = new Date(),
): BusinessConfirmationAudit {
  const rawActorId = currentUser?.id ?? currentUser?._id ?? currentUser?.userId ?? currentUser?.sub;
  const actorId = String(rawActorId ?? '').trim();
  if (!Types.ObjectId.isValid(actorId)) {
    throw new ForbiddenException('A canonical authenticated actor is required to confirm an order.');
  }
  return {
    businessConfirmedAt: at,
    businessConfirmedBy: new Types.ObjectId(actorId),
    businessConfirmationSource: source,
  };
}

/** Remove every client-supplied confirmation field before a generic update. */
export function stripBusinessConfirmationAuditFields<T extends Record<string, any>>(payload: T): T {
  const sanitized = { ...payload };
  for (const field of BUSINESS_CONFIRMATION_FIELDS) delete sanitized[field];
  return sanitized;
}
