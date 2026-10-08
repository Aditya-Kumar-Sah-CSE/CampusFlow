import fs from 'fs';
import path from 'path';

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
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
          let val = trimmed.slice('SUPABASE_SERVICE_ROLE_KEY='.length).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (val) {
            process.env.SUPABASE_SERVICE_ROLE_KEY = val;
            return val;
          }
        }
      }
    }
  } catch {
    // Non-fatal if fs not available or in browser
  }

  return undefined;
}
