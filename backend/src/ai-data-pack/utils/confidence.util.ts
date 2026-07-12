export interface AttributionSignals {
  platformAccount?: boolean;
  campaign?: boolean;
  adGroup?: boolean;
  adCreative?: boolean;
  keywordOrUtm?: boolean;
  leadToOrder?: boolean;
  durableCustomer?: boolean;
  freshAdsData?: boolean;
}

export function calculateAttributionConfidence(signals: AttributionSignals): number {
  let score = 0;
  if (signals.platformAccount) score += 0.2;
  if (signals.campaign) score += 0.15;
  if (signals.adGroup) score += 0.15;
  if (signals.adCreative) score += 0.1;
  if (signals.keywordOrUtm) score += 0.1;
  if (signals.leadToOrder) score += 0.15;
  if (signals.durableCustomer) score += 0.1;
  if (signals.freshAdsData) score += 0.05;
  if (!signals.platformAccount) score = Math.min(score, 0.6);
  if (!signals.leadToOrder || !signals.durableCustomer) score = Math.min(score, 0.7);
  return Number(Math.min(1, score).toFixed(4));
}

export function confidenceLevel(score: number): 'high' | 'medium' | 'low' {
  return score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';
}

export function rate(mapped: number, total: number): number | null {
  return total > 0 ? Number(((mapped / total) * 100).toFixed(2)) : null;
}

