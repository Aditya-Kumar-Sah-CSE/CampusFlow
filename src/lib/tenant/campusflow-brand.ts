export interface CampusFlowTenantIdentity {
  code?: string | null;
  shortName?: string | null;
}

export interface CampusFlowBrand {
  platformName: 'CampusFlow';
  tenantCode: string | null;
  displayName: string;
  shortName: string;
}

/** Builds user-facing platform branding from authoritative tenant metadata. */
export function getCampusFlowBrand(tenant?: CampusFlowTenantIdentity | null): CampusFlowBrand {
  const rawCode = tenant?.code || tenant?.shortName;
  const tenantCode = typeof rawCode === 'string' && rawCode.trim() ? rawCode.trim() : null;
  return {
    platformName: 'CampusFlow',
    tenantCode,
    displayName: tenantCode ? `${tenantCode} CampusFlow` : 'CampusFlow',
    shortName: tenantCode ? `${tenantCode} CampusFlow` : 'CampusFlow',
  };
}

export const CAMPUSFLOW_DESCRIPTION =
  'CampusFlow — Campus Management Platform for institutional feedback, events, programs, and registrations.';

export function getCampusFlowDescription(tenant?: CampusFlowTenantIdentity | null): string {
  const brand = getCampusFlowBrand(tenant);
  return brand.tenantCode
    ? `${brand.displayName} — Campus Management Platform for institutional feedback, events, programs, and registrations.`
    : CAMPUSFLOW_DESCRIPTION;
}
