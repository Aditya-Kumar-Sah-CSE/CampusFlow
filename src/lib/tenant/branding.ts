/**
 * Tenant Branding Loader — Server-Only
 * Loads college branding from the `colleges` table using a trusted college_id.
 * Never trust college_id from client input — caller must derive it from DB.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface CollegeBranding {
  id?: string;
  name: string;
  code: string;
  slug: string;
  tagline?: string;
  establishedYear?: number;
  affiliatedUniversity?: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  websiteUrl?: string;
  isPaidActive?: boolean;
}

/**
 * Safe generic fallback — never references any specific institution.
 */
export const DEFAULT_BRANDING: CollegeBranding = {
  name: 'Bhagalpur College of Engineering',
  code: '108',
  slug: 'bce-bgp',
  logoUrl: '/images/colleges/bce-bgp.png',
  primaryColor: '#1B365D',
  secondaryColor: '#334155',
  accentColor: '#2563EB',
  isPaidActive: false,
};

/**
 * Loads college branding from the `colleges` table.
 *
 * SECURITY: This function uses service-role and trusts the provided `collegeId`.
 * The caller MUST derive `collegeId` from an authoritative DB record
 * (e.g., `feedback_forms.college_id`), NEVER from client input.
 *
 * Returns DEFAULT_BRANDING if the college is not found or DB is unavailable.
 */
export async function getCollegeBranding(collegeId: string): Promise<CollegeBranding> {
  if (!collegeId) return DEFAULT_BRANDING;

  try {
    const supabase = createAdminClient();
    if (!supabase) return DEFAULT_BRANDING;

    const [collegeRes, billingRes] = await Promise.all([
      supabase
        .from('colleges')
        .select(
          'id, name, code, slug, tagline, established_year, affiliated_university, logo_url, primary_color, secondary_color, accent_color, contact_email, contact_phone, address, website_url'
        )
        .eq('id', collegeId)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('college_billing_accounts')
        .select('plan_type, access_status, expires_at')
        .eq('college_id', collegeId)
        .maybeSingle(),
    ]);

    const data = collegeRes.data;
    if (collegeRes.error || !data) return DEFAULT_BRANDING;

    const billing = billingRes.data;
    const now = new Date();
    const rawPlan = (billing?.plan_type || 'FREE').toUpperCase();
    const isPaid = rawPlan !== 'FREE';
    const isUnlocked = billing?.access_status === 'UNLOCKED';
    const isExpired = Boolean(
      isPaid && billing?.expires_at && new Date(billing.expires_at) <= now
    );
    const isPaidActive = Boolean(isPaid && !isExpired && isUnlocked);

    return {
      id: data.id || collegeId,
      name: data.name || DEFAULT_BRANDING.name,
      code: data.code || DEFAULT_BRANDING.code,
      slug: data.slug || DEFAULT_BRANDING.slug,
      tagline: data.tagline || undefined,
      establishedYear: data.established_year || undefined,
      affiliatedUniversity: data.affiliated_university || undefined,
      logoUrl: data.logo_url || (data.code === '108' || data.slug === 'bce-bgp' ? '/images/colleges/bce-bgp.png' : DEFAULT_BRANDING.logoUrl),
      primaryColor: data.primary_color || DEFAULT_BRANDING.primaryColor,
      secondaryColor: data.secondary_color || DEFAULT_BRANDING.secondaryColor,
      accentColor: data.accent_color || DEFAULT_BRANDING.accentColor,
      contactEmail: data.contact_email || undefined,
      contactPhone: data.contact_phone || undefined,
      address: data.address || undefined,
      websiteUrl: data.website_url || undefined,
      isPaidActive,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}
