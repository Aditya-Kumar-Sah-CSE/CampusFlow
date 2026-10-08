/**
 * Staging-isolated Supabase Environment Configuration
 *
 * SAFETY INVARIANT:
 * On branch staging/load-test, ALL Supabase clients MUST connect exclusively to
 * the dedicated staging database (ggisjcegbcvxwgczwdbd.supabase.co).
 *
 * If any environment variable (or missing variable) points to the production
 * instance (txerarcajxjzxifanzxw), it is automatically overridden with the staging
 * instance to prevent any load testing or staging traffic from touching production.
 */

export const STAGING_SUPABASE_URL = 'https://ggisjcegbcvxwgczwdbd.supabase.co';
export const STAGING_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnaXNqY2VnYmN2eHdnY3p3ZGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NDE4ODIsImV4cCI6MjEwNzAxNzg4Mn0.QMXwIoGI2xleynbBO-5f4Ix_PrXqrhDuRFdKvcoNaIU';
export const STAGING_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdnaXNqY2VnYmN2eHdnY3p3ZGJkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTQ0MTg4MiwiZXhwIjoyMTA3MDE3ODgyfQ.t49Myem62JJHBsyIfXIbtJAtJfFfvweh5pWijb4DSLA';

export function getSupabaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!envUrl || envUrl.includes('txerarcajxjzxifanzxw')) {
    return STAGING_SUPABASE_URL;
  }
  return envUrl;
}

export function getSupabaseAnonKey(): string {
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (
    !envKey ||
    !envUrl ||
    envUrl.includes('txerarcajxjzxifanzxw') ||
    envKey.includes('BaBiHYfqG1rIf0ns3b-alQ_fqNRPoHe')
  ) {
    return STAGING_ANON_KEY;
  }
  return envKey;
}

export function getSupabaseServiceRoleKey(): string {
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!envKey || !envUrl || envUrl.includes('txerarcajxjzxifanzxw')) {
    return STAGING_SERVICE_ROLE_KEY;
  }
  return envKey;
}
