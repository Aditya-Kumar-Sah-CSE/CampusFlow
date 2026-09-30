export interface CampusFlowTenantIdentity {
  code?: string | null;
  shortName?: string | null;
}

export interface CampusFlowBrand {
  platformName: 'CampusFlow';
  tenantCode: string | null;
  displayName: string;
  shortName: 'CampusFlow';
}

/** Builds user-facing platform branding from authoritative tenant metadata. */
export function getCampusFlowBrand(tenant?: CampusFlowTenantIdentity | null): CampusFlowBrand {
  const rawCode = tenant?.code || tenant?.shortName;
  const tenantCode = typeof rawCode === 'string' && rawCode.trim() ? rawCode.trim() : null;
  return {
    platformName: 'CampusFlow',
    tenantCode,
    displayName: tenantCode ? `CampusFlow ${tenantCode}` : 'CampusFlow',
    shortName: 'CampusFlow',
  };
}

export const CAMPUSFLOW_DESCRIPTION =
  'Unified college platform for feedback, events, student registration, participation and campus activities.';

export function getCampusFlowDescription(tenant?: CampusFlowTenantIdentity | null): string {
  const brand = getCampusFlowBrand(tenant);
  return brand.tenantCode
    ? `${brand.displayName} is a unified college platform for feedback, events, student registration, participation and campus activities.`
    : CAMPUSFLOW_DESCRIPTION;
}
