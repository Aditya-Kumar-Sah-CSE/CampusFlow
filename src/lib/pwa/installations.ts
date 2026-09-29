import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function getPwaInstallCount(collegeId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_pwa_install_count', { p_college_id: collegeId });
  if (error) {
    console.error('[PWA] Could not get installation count:', error.message);
    return 0;
  }
  return Number(data ?? 0);
}
