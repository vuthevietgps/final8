export const DEFAULT_META_GRAPH_API_VERSION = 'v25.0';
export const DEFAULT_GOOGLE_ADS_API_VERSION = 'v24';

export function getMetaGraphApiVersion(): string {
  return (process.env.META_GRAPH_API_VERSION || process.env.FB_GRAPH_API_VERSION || DEFAULT_META_GRAPH_API_VERSION).trim();
}

export function getGoogleAdsApiVersion(): string {
  return (process.env.GOOGLE_ADS_API_VERSION || DEFAULT_GOOGLE_ADS_API_VERSION).trim();
}
