export interface CampusFlowTenantIdentity {
  code?: string | null;
  slug?: string | null;
  shortName?: string | null;
}

export interface CampusFlowBrand {
  platformName: 'CampusFlow';
  tenantCode: string | null;
  displayName: string;
  shortName: string;
}

const KNOWN_CODE_TO_SLUG: Record<string, string> = {
  '108': 'BCE BGP',
  'bce-bgp': 'BCE BGP',
  'bce_bgp': 'BCE BGP',
  'bce': 'BCE BGP',
  'gec-gaya': 'GEC GAYA',
  'gce-gaya': 'GCE GAYA',
  'gec_gaya': 'GEC GAYA',
  'gce_gaya': 'GEC GAYA',
  'gecgaya': 'GEC GAYA',
  'bcebgp': 'BCE BGP',
};

/** Formats a slug like "bce-bgp" or code like "GCE-GAYA" into uppercase display form "BCE BGP". */
export function slugToDisplay(slug: string): string {
  return slug.replace(/[-_]+/g, ' ').trim().toUpperCase();
}

/** Builds user-facing platform branding from authoritative tenant metadata. */
export function getCampusFlowBrand(tenant?: CampusFlowTenantIdentity | null): CampusFlowBrand {
  // 1. Prefer slug (e.g. "bce-bgp" → "BCE BGP", "gce-gaya" → "GCE GAYA")
  const rawSlug = tenant?.slug?.trim();
  const slugDisplay = rawSlug ? slugToDisplay(rawSlug) : null;

  // 2. Check code or shortName
  const rawCode = tenant?.code?.trim() || tenant?.shortName?.trim();
  let codeDisplay: string | null = null;
  if (rawCode) {
    const lower = rawCode.toLowerCase();
    if (KNOWN_CODE_TO_SLUG[lower]) {
      codeDisplay = KNOWN_CODE_TO_SLUG[lower];
    } else if (!/^\d+$/.test(rawCode)) {
      // Non-numeric code like "BCE-BGP" or "GCE-GAYA"
      codeDisplay = slugToDisplay(rawCode);
    }
  }

  const display = slugDisplay || codeDisplay || 'CampusFlow';
  const tenantCode =
    rawSlug ||
    (rawCode && !/^\d+$/.test(rawCode)
      ? rawCode
      : codeDisplay
      ? codeDisplay.toLowerCase().replace(/\s+/g, '-')
      : null);

  return {
    platformName: 'CampusFlow',
    tenantCode,
    displayName: display,
    shortName: display,
  };
}

export const CAMPUSFLOW_DESCRIPTION =
  'CampusFlow — Campus Management Platform for institutional feedback, events, programs, and registrations.';

export function getCampusFlowDescription(tenant?: CampusFlowTenantIdentity | null): string {
  const brand = getCampusFlowBrand(tenant);
  return brand.displayName !== 'CampusFlow'
    ? `${brand.displayName} — Campus Management Platform for institutional feedback, events, programs, and registrations.`
    : CAMPUSFLOW_DESCRIPTION;
}
