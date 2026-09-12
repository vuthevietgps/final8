/** Contact counters are conversion evidence even when a legacy collector has no event log.
 * Do not fabricate an event time, channel or event ID from a cumulative snapshot.
 */
export function conversionTypesFromEvidence(types: string[], engagement?: { contactActions?: number; formSubmits?: number }) {
  return [...new Set([...types,
    ...((engagement?.contactActions || 0) > 0 ? ['contact'] : []),
    ...((engagement?.formSubmits || 0) > 0 ? ['form_submit'] : []),
  ])];
}

export const conversionTypesExpression = {
  $setUnion: [
    '$conversionRows._id',
    { $cond: [{ $gt: [{ $ifNull: ['$engagement.contactActions', 0] }, 0] }, ['contact'], []] },
    { $cond: [{ $gt: [{ $ifNull: ['$engagement.formSubmits', 0] }, 0] }, ['form_submit'], []] },
  ],
};
