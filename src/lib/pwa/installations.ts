import 'server-only';
import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://txerarcajxjzxifanzxw.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_BaBiHYfqG1rIf0ns3b-alQ_fqNRPoHe';

const publicClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
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
 * Fetches the total distinct PWA installations count for an active college.
 * Cached server-side for 60 seconds with graceful fallback to 0.
 * Non-blocking, cookie-free, and safe for high-concurrency public browsing.
 */
export async function getPwaInstallCount(collegeId: string): Promise<number> {
  if (!collegeId) return 0;

  try {
    return await unstable_cache(
      () => fetchPwaInstallCountDirect(collegeId),
      [`pwa_install_count_${collegeId}`],
      {
        revalidate: 60,
        tags: [`pwa_install_count_${collegeId}`],
      }
    )();
  } catch {
    return fetchPwaInstallCountDirect(collegeId);
  }
}
