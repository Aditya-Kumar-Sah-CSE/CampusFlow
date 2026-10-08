import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { College, TenantContext, TenantResolverOptions } from '@/types/tenant';

import { getCollegeLandingSettings, type LandingPageSettings } from '@/lib/tenant/landing-settings';

/**
 * Normalizes and validates slug format.
 * Allowed characters: lowercase alphanumeric and hyphens (1-50 chars).
 */
export function normalizeSlug(rawSlug: string): string | null {
  if (!rawSlug || typeof rawSlug !== 'string') return null;
  const trimmed = rawSlug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * Transforms a database College record into a typed TenantContext.
 * Guaranteed not to expose sensitive administrative or secret credentials.
 */
export function createTenantContext(college: College, settings?: LandingPageSettings): TenantContext {
  const showFeedbacks = settings ? settings.showFeedbacks : (college.show_feedbacks !== false);
  const showEvents = settings ? settings.showEvents : (college.show_events !== false);

  return {
    collegeId: college.id,
    slug: college.slug,
    name: college.name,
    shortName: college.code,
    code: college.code,
    logo: college.logo_url || null,
    websiteUrl: college.website_url || null,
    address: college.address || null,
    branding: {
      primaryColor: college.primary_color || '#0B192C',
      secondaryColor: college.secondary_color || '#1E3E62',
      accentColor: college.accent_color || '#F59E0B',
      logoUrl: college.logo_url || null,
    },
    isActive: college.is_active,
    showFeedbacks,
    showEvents,
    college: {
      id: college.id,
      name: college.name,
      code: college.code,
      slug: college.slug,
      website_url: college.website_url,
      logo_url: college.logo_url,
      primary_color: college.primary_color,
      secondary_color: college.secondary_color,
      accent_color: college.accent_color,
      address: college.address,
      is_active: college.is_active,
      show_feedbacks: showFeedbacks,
      show_events: showEvents,
      created_at: college.created_at,
      updated_at: college.updated_at,
    },
  };
}

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/env';

const publicResolverClient = createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Cross-request cached lookup for college record by slug.
 * Tagged for on-demand invalidation when college settings change.
 * Uses public anon client (never service-role credentials) respecting RLS.
 */
const fetchCollegeBySlugDirect = async (slug: string): Promise<College | null> => {
  const { data, error } = await publicResolverClient
    .from('colleges')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as College;
};

const getCachedCollegeBySlug = unstable_cache(
  async (slug: string): Promise<College | null> => {
    return fetchCollegeBySlugDirect(slug);
  },
  ['tenant_college_slug'],
  {
    revalidate: 60, // 60s cache TTL
    tags: ['colleges'],
  }
);

/**
 * Resolves a tenant by slug.
 * Per-request memoization via React cache() ensures layout and page components
 * sharing the same request do not trigger duplicate database queries.
 *
 * @param rawSlug - Tenant slug from URL route segment (e.g. "bce-bgp")
 * @param options - Additional resolution options (e.g. requireActive)
 * @returns TenantContext or null if not found/inactive
 */
export const getTenantBySlug = cache(
  async (
    rawSlug: string,
    options: TenantResolverOptions = { requireActive: true }
  ): Promise<TenantContext | null> => {
    const slug = normalizeSlug(rawSlug);
    if (!slug) {
      return null;
    }

    let college: College | null = null;
    try {
      college = await getCachedCollegeBySlug(slug);
    } catch {
      college = await fetchCollegeBySlugDirect(slug);
    }

    if (!college) {
      return null;
    }

    const requireActive = options.requireActive !== false;
    if (requireActive && !college.is_active) {
      return null;
    }

    let landingSettings: LandingPageSettings;
    if (
      college.show_feedbacks !== undefined &&
      college.show_feedbacks !== null &&
      college.show_events !== undefined &&
      college.show_events !== null
    ) {
      landingSettings = {
        showFeedbacks: college.show_feedbacks !== false,
        showEvents: college.show_events !== false,
      };
    } else {
      landingSettings = await getCollegeLandingSettings(college.id);
    }
    return createTenantContext(college, landingSettings);
  }
);

/**
 * Canonical tenant resolver export as required by FMS architecture.
 */
export const resolveTenantBySlug = getTenantBySlug;

/**
 * Context getter alias for Server Components and Server Actions.
 */
export const getTenantContext = getTenantBySlug;

/**
 * Authoritative tenant resolution for Server Components and Route Handlers.
 * Returns the TenantContext if valid and active, or invokes notFound() immediately.
 *
 * @param rawSlug - Tenant slug from params
 * @returns TenantContext (guaranteed non-null)
 */
export async function resolveTenantOrNotFound(rawSlug: string): Promise<TenantContext> {
  const tenant = await getTenantBySlug(rawSlug, { requireActive: true });
  if (!tenant) {
    notFound();
  }
  return tenant;
}

/**
 * Semantic alias for resolveTenantOrNotFound.
 */
export const requireTenant = resolveTenantOrNotFound;

const fetchAllActiveCollegesDirect = async (): Promise<College[]> => {
  const { data, error } = await publicResolverClient
    .from('colleges')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error || !data) return [];
  return data as College[];
};

const getCachedAllActiveColleges = unstable_cache(
  fetchAllActiveCollegesDirect,
  ['all_active_colleges_cache'],
  { revalidate: 60, tags: ['colleges'] }
);

/**
 * Fetches all active colleges for the root directory or tenant switcher.
 * Uses public anon client (never service-role credentials).
 */
export const getAllActiveColleges = cache(async (): Promise<TenantContext[]> => {
  let colleges: College[] = [];
  try {
    colleges = await getCachedAllActiveColleges();
  } catch {
    colleges = await fetchAllActiveCollegesDirect();
  }

  return Promise.all(
    colleges.map(async (c) => {
      let landingSettings: LandingPageSettings;
      if (
        c.show_feedbacks !== undefined &&
        c.show_feedbacks !== null &&
        c.show_events !== undefined &&
        c.show_events !== null
      ) {
        landingSettings = {
          showFeedbacks: c.show_feedbacks !== false,
          showEvents: c.show_events !== false,
        };
      } else {
        landingSettings = await getCollegeLandingSettings(c.id);
      }
      return createTenantContext(c, landingSettings);
    })
  );
});

