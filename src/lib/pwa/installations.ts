import 'server-only';
import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/env';

const publicClient = createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PWA_QUERY_TIMEOUT_MS = 2500;

async function fetchPwaInstallCountDirect(collegeId: string): Promise<number> {
  try {
    const rpcPromise = publicClient.rpc('get_pwa_install_count', { p_college_id: collegeId });
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('PWA install count query timed out')), PWA_QUERY_TIMEOUT_MS);
      if (typeof timer.unref === 'function') timer.unref();
    });

    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);
    if (error) {
      console.warn('[PWA] Could not get installation count:', error.message);
      return 0;
    }
    return Number(data ?? 0);
  } catch (err: any) {
    console.warn('[PWA] Could not get installation count:', err?.message || err);
    return 0;
  }
}

/**
 * Module-level cached lookup for PWA installations count.
 * Defining at module scope ensures stable function identity in Next.js runtime.
 */
const getCachedPwaInstallCount = unstable_cache(
  async (collegeId: string): Promise<number> => {
    return fetchPwaInstallCountDirect(collegeId);
  },
  ['pwa_install_count_cache'],
  {
    revalidate: 60,
    tags: ['pwa_installations'],
  }
);

/**
 * Fetches the total distinct PWA installations count for an active college.
 * Cached server-side for 60 seconds with graceful fallback to 0.
 * Non-blocking, cookie-free, and safe for high-concurrency public browsing.
 */
export async function getPwaInstallCount(collegeId: string): Promise<number> {
  if (!collegeId) return 0;

  try {
    return await getCachedPwaInstallCount(collegeId);
  } catch {
    return fetchPwaInstallCountDirect(collegeId);
  }
}

