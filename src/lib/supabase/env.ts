/**
 * Supabase Environment Configuration
 *
 * Resolves Supabase credentials dynamically from environment variables,
 * falling back to configured project defaults for development/local execution.
 */

export const DEFAULT_SUPABASE_URL = 'https://txerarcajxjzxifanzxw.supabase.co';
export const DEFAULT_ANON_KEY =
  'sb_publishable_BaBiHYfqG1rIf0ns3b-alQ_fqNRPoHe';

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}
