export function googleAdsMccReadinessBlockers(
  manager: any,
  customerIdInput: unknown,
  now = new Date(),
): string[] {
  const customerId = digits(customerIdInput);
  const blockers: string[] = [];
  if (!manager) return ['MCC_NOT_CONFIGURED'];
  if (manager.provider !== 'google'
    || manager.managerAccountType !== 'google_ads_mcc'
    || manager.isActive !== true) {
    blockers.push('MCC_NOT_ACTIVE');
  }
  if (manager.providerVerificationStatus !== 'verified') {
    blockers.push('MCC_PROVIDER_NOT_VERIFIED');
  }
  const expiresAt = manager.providerVerificationExpiresAt
    ? new Date(manager.providerVerificationExpiresAt)
    : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
    blockers.push('MCC_PROVIDER_VERIFICATION_EXPIRED');
  }
  if (manager.runtimeCredentialResolved !== true) {
    blockers.push('MCC_RUNTIME_CREDENTIAL_NOT_RESOLVED');
  }
  if (manager.providerConnectionVerified !== true) {
    blockers.push('MCC_PROVIDER_CONNECTION_NOT_VERIFIED');
  }
  if (manager.childAccountsVerifiedByProvider !== true) {
    blockers.push('MCC_CHILDREN_NOT_PROVIDER_VERIFIED');
  }
  const child = Array.isArray(manager.verifiedChildAccounts)
    ? manager.verifiedChildAccounts.find((item: any) => digits(item?.accountId) === customerId)
    : undefined;
  if (!child) {
    blockers.push('MCC_CHILD_ACCOUNT_NOT_VERIFIED');
  } else {
    if (String(child.currency || '').trim() !== 'VND') {
      blockers.push('MCC_CHILD_CURRENCY_NOT_VND');
    }
    if (String(child.timezoneId || '').trim() !== 'Asia/Ho_Chi_Minh') {
      blockers.push('MCC_CHILD_TIMEZONE_NOT_ASIA_HO_CHI_MINH');
    }
    if (!['ACTIVE', 'ENABLED'].includes(String(child.status || '').trim().toUpperCase())) {
      blockers.push('MCC_CHILD_NOT_ACTIVE');
    }
  }
  return blockers;
}

export function googleAdsManagerByLoginCustomerId(
  managers: any[],
  loginCustomerIdInput: unknown,
) {
  const loginCustomerId = digits(loginCustomerIdInput);
  return (managers || []).find((manager) =>
    manager?.provider === 'google'
    && manager?.managerAccountType === 'google_ads_mcc'
    && digits(manager?.managerAccountId) === loginCustomerId);
}

function digits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}
