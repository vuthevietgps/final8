export const GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST = Object.freeze({
  origin: "https://googleads.googleapis.com",
  method: "POST",
  pathFamily: "/v*/customers/{allowlistedCustomerId}/googleAds:searchStream",
  querySource: "adapter_owned_static_templates",
  mutationAllowed: false,
  validateOnlyAllowed: false,
});

export interface GoogleAdsReadonlyTransportDescriptor {
  origin: string;
  method: string;
  path: string;
  querySource: string;
}

export function assertGoogleAdsReadonlyTransport(
  descriptor: GoogleAdsReadonlyTransportDescriptor,
  allowedCustomerIds: readonly string[],
): void {
  if (
    descriptor.origin !== GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.origin ||
    descriptor.method !== GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.method ||
    descriptor.querySource !==
      GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.querySource
  ) {
    throw new Error("Provider transport is not allowed for read-only sync.");
  }

  const match = descriptor.path.match(
    /^\/v\d+\/customers\/(\d+)\/googleAds:searchStream$/,
  );
  if (!match || !allowedCustomerIds.includes(match[1])) {
    throw new Error("Provider path is not allowed for read-only sync.");
  }
}
