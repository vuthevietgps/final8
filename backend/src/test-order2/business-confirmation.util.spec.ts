import { Types } from 'mongoose';
import {
  businessConfirmationAudit,
  stripBusinessConfirmationAuditFields,
} from './business-confirmation.util';

describe('business confirmation helpers', () => {
  const now = new Date('2026-07-10T10:00:00.000Z');
  const actorId = new Types.ObjectId().toHexString();

  it('derives timestamp and canonical provenance only from the authenticated actor', () => {
    expect(businessConfirmationAudit({ id: actorId }, 'erp_manual_confirmation', now)).toEqual({
      businessConfirmedAt: now,
      businessConfirmedBy: new Types.ObjectId(actorId),
      businessConfirmationSource: 'erp_manual_confirmation',
    });
    expect(() => businessConfirmationAudit({}, 'erp_manual_confirmation', now))
      .toThrow('canonical authenticated actor is required');
    expect(() => businessConfirmationAudit({ id: 'not-an-object-id' }, 'erp_manual_confirmation', now))
      .toThrow('canonical authenticated actor is required');
  });

  it('strips the timestamp and all spoofed provenance from a generic payload', () => {
    expect(stripBusinessConfirmationAuditFields({
      businessConfirmedAt: '2026-07-10T09:00:00.000Z',
      businessConfirmedBy: new Types.ObjectId().toHexString(),
      businessConfirmationSource: 'spoofed-source',
      customerName: 'Customer',
    })).toEqual({
      customerName: 'Customer',
    });
  });
});
