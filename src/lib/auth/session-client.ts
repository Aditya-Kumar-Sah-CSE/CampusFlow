'use client';

import { createClient } from '@/lib/supabase/client';

export const SESSION_REVOKED_CODE = 'SESSION_REVOKED';

export interface SessionRevokedPayload {
  code: 'SESSION_REVOKED';
  message: string;
  platform?: 'WEB' | 'ANDROID';
}

/**
 * Centrally handles session revocation received from any API or server action.
 * Clears local Supabase Auth state and redirects cleanly to the login page with
 * the appropriate platform-specific message.
 */
export async function handleSessionRevocation(options?: {
  platform?: 'WEB' | 'ANDROID';
  customMessage?: string;
}) {
  if (typeof window === 'undefined') return;

  const currentPlatform =
    options?.platform ||
    (localStorage.getItem('cf_platform') === 'ANDROID' ? 'ANDROID' : 'WEB');

  const supabase = createClient();
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[SessionClient] Local sign out error:', err);
  }

  const reasonParam = currentPlatform === 'ANDROID' ? 'another_device' : 'another_browser';
  const targetUrl = `/admin/login?reason=${reasonParam}`;

  // Prevent redirect loop if already on login
  if (!window.location.pathname.includes('/admin/login')) {
    window.location.href = targetUrl;
  }
}

/**
 * Checks a fetch Response or parsed JSON body for SESSION_REVOKED code.
 * If revoked, triggers central logout and returns true.
 */
export async function checkAndHandleRevocation(
  responseOrData: Response | Record<string, any>
): Promise<boolean> {
  if (responseOrData instanceof Response) {
    if (responseOrData.status === 401) {
      try {
        const cloned = responseOrData.clone();
        const body = await cloned.json();
        if (body && body.code === SESSION_REVOKED_CODE) {
          await handleSessionRevocation({ platform: body.platform });
          return true;
        }
      } catch {
        // Not JSON
      }
    }
    return false;
  }

  if (responseOrData && responseOrData.code === SESSION_REVOKED_CODE) {
    await handleSessionRevocation({ platform: responseOrData.platform });
    return true;
  }

  return false;
}
