import { createAdminClient } from '@/lib/supabase/admin';
import type { AdminPlatform, AdminSessionRecord } from '@/types/auth';

export const ADMIN_SESSION_COOKIE = 'cf_admin_session_id';
export const ADMIN_PLATFORM_COOKIE = 'cf_admin_platform';
export const SESSION_REVOKED_CODE = 'SESSION_REVOKED';

/**
 * Parses user agent string into friendly human-readable browser & OS labels
 */
export function parseUserAgentInfo(uaString: string | null | undefined): {
  browser: string;
  os: string;
  label: string;
} {
  if (!uaString) {
    return { browser: 'Unknown Browser', os: 'Unknown OS', label: 'Web Browser' };
  }

  const ua = uaString.toLowerCase();

  // OS detection
  let os = 'Unknown OS';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) os = 'iOS';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';

  // Browser detection
  let browser = 'Browser';
  if (ua.includes('edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('chrome') && !ua.includes('edg/')) browser = 'Google Chrome';
  else if (ua.includes('firefox')) browser = 'Mozilla Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Apple Safari';
  else if (ua.includes('opera') || ua.includes('opr/')) browser = 'Opera';

  return { browser, os, label: `${browser} on ${os}` };
}

/**
 * Checks if a Supabase PostgREST error represents a missing table (e.g. before migration runs)
 */
function isTableMissingError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('relation "public.admin_sessions" does not exist') ||
    msg.includes('schema cache')
  );
}

/**
 * Determines whether a request originated from the Android TWA or standard Web
 */
export function detectPlatform(
  headerPlatform?: string | null,
  cookiePlatform?: string | null,
  userAgent?: string | null,
  bodyPlatform?: string | null
): AdminPlatform {
  const candidate = (
    bodyPlatform ||
    headerPlatform ||
    cookiePlatform ||
    ''
  ).toUpperCase().trim();

  // Explicit ANDROID marker from TWA launcher / header / body
  if (candidate === 'ANDROID') {
    return 'ANDROID';
  }

  // PWA on desktop or mobile is explicitly WEB per Requirement 6
  return 'WEB';
}

/**
 * Creates a new active session record for an admin, revoking any previous session on the SAME platform.
 * Employs atomic RPC claim_admin_session to guarantee race-condition safety.
 */
export async function createAdminSessionRecord(params: {
  userId: string;
  platform: AdminPlatform;
  deviceId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<{
  sessionId: string;
  platform: AdminPlatform;
  revokedCount: number;
}> {
  const { userId, platform, deviceId, userAgent, ipAddress } = params;
  const sessionId = crypto.randomUUID();
  const adminDb = createAdminClient();

  if (!adminDb) {
    console.warn('[SessionService] createAdminClient unavailable; proceeding in memory mode.');
    return { sessionId, platform, revokedCount: 0 };
  }

  try {
    // 1. Try atomic database RPC (handles row locking and atomic revocation in 1 transaction)
    const { data: rpcData, error: rpcError } = await adminDb.rpc('claim_admin_session', {
      p_user_id: userId,
      p_platform: platform,
      p_session_id: sessionId,
      p_device_id: deviceId || null,
      p_user_agent: userAgent || null,
      p_ip_address: ipAddress || null,
    });

    if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
      return {
        sessionId,
        platform,
        revokedCount: rpcData[0].revoked_count ?? 0,
      };
    }

    // 2. If RPC is not present (e.g. migration pending), use fallback transactional queries
    if (rpcError && !isTableMissingError(rpcError)) {
      console.warn('[SessionService] RPC claim_admin_session failed, using direct query fallback:', rpcError.message);
    }

    const now = new Date().toISOString();

    // Revoke any existing active session for this user + platform
    const { data: revokedRows, error: revokeErr } = await adminDb
      .from('admin_sessions')
      .update({
        revoked_at: now,
        revoke_reason: 'SUPERSEDED_BY_NEW_LOGIN',
      })
      .eq('user_id', userId)
      .eq('platform', platform)
      .is('revoked_at', null)
      .select('id');

    if (revokeErr && isTableMissingError(revokeErr)) {
      console.warn('[SessionService] admin_sessions table pending migration. Fallback to session token.');
      return { sessionId, platform, revokedCount: 0 };
    }

    // Insert new session
    const { error: insertErr } = await adminDb.from('admin_sessions').insert({
      user_id: userId,
      platform,
      session_id: sessionId,
      device_id: deviceId || null,
      user_agent: userAgent || null,
      ip_address: ipAddress || null,
      created_at: now,
      last_seen_at: now,
    });

    if (insertErr && isTableMissingError(insertErr)) {
      return { sessionId, platform, revokedCount: 0 };
    }

    if (insertErr) {
      console.error('[SessionService] Failed to insert admin session:', insertErr);
    }

    return {
      sessionId,
      platform,
      revokedCount: revokedRows?.length || 0,
    };
  } catch (err: any) {
    console.error('[SessionService] Exception creating session record:', err);
    return { sessionId, platform, revokedCount: 0 };
  }
}

export interface SessionValidationResult {
  valid: boolean;
  code?: 'SESSION_REVOKED';
  reason?: string;
  platform?: AdminPlatform;
  session?: AdminSessionRecord;
  unmigrated?: boolean;
}

/**
 * Validates whether an admin session ID is still current, unexpired, and unrevoked.
 */
export async function validateAdminSession(params: {
  userId: string;
  sessionId?: string | null;
  updateLastSeen?: boolean;
}): Promise<SessionValidationResult> {
  const { userId, sessionId, updateLastSeen = false } = params;

  // If no sessionId is provided:
  if (!sessionId) {
    return {
      valid: false,
      code: SESSION_REVOKED_CODE,
      reason: 'MISSING_SESSION_ID',
      platform: 'WEB',
    };
  }

  const adminDb = createAdminClient();
  if (!adminDb) {
    // Service key not available in environment; fail open safely for local development without DB
    return { valid: true };
  }

  try {
    const { data: session, error } = await adminDb
      .from('admin_sessions')
      .select('id, user_id, platform, session_id, device_id, user_agent, created_at, last_seen_at, expires_at, revoked_at, revoke_reason')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error)) {
        // Table not yet migrated; allow access until migration is executed
        return { valid: true, unmigrated: true };
      }
      console.error('[SessionService] Error querying admin session:', error);
      return { valid: false, code: SESSION_REVOKED_CODE, reason: 'QUERY_ERROR', platform: 'WEB' };
    }

    // Session record not found in database
    if (!session) {
      return {
        valid: false,
        code: SESSION_REVOKED_CODE,
        reason: 'SESSION_NOT_FOUND',
        platform: 'WEB',
      };
    }

    const platform = (session.platform as AdminPlatform) || 'WEB';

    // Verify user identity strictly matches auth.uid()
    if (session.user_id !== userId) {
      return {
        valid: false,
        code: SESSION_REVOKED_CODE,
        reason: 'USER_MISMATCH',
        platform,
      };
    }

    // Check if session has been revoked
    if (session.revoked_at) {
      return {
        valid: false,
        code: SESSION_REVOKED_CODE,
        reason: session.revoke_reason || 'REVOKED',
        platform,
      };
    }

    // Check if session has expired
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return {
        valid: false,
        code: SESSION_REVOKED_CODE,
        reason: 'EXPIRED',
        platform,
      };
    }

    // Throttled background last_seen_at update (at most once every 2 minutes to prevent DB pressure)
    if (updateLastSeen && session.last_seen_at) {
      const elapsedMs = Date.now() - new Date(session.last_seen_at).getTime();
      if (elapsedMs > 120_000) {
        // Non-blocking fire-and-forget update
        void (async () => {
          try {
            await adminDb
              .from('admin_sessions')
              .update({ last_seen_at: new Date().toISOString() })
              .eq('id', session.id);
          } catch (e) {
            console.warn('[SessionService] Throttled last_seen_at update error:', e);
          }
        })();
      }
    }

    return {
      valid: true,
      platform,
      session: {
        id: session.id,
        userId: session.user_id,
        platform,
        sessionId: session.session_id,
        deviceId: session.device_id,
        userAgent: session.user_agent,
        createdAt: session.created_at,
        lastSeenAt: session.last_seen_at,
        expiresAt: session.expires_at,
        revokedAt: session.revoked_at,
        revokeReason: session.revoke_reason,
      },
    };
  } catch (err: any) {
    console.error('[SessionService] Exception during session validation:', err);
    return { valid: false, code: SESSION_REVOKED_CODE, reason: 'VALIDATION_EXCEPTION', platform: 'WEB' };
  }
}

/**
 * Revokes an admin session on logout.
 */
export async function revokeAdminSession(params: {
  sessionId: string;
  reason?: string;
}): Promise<boolean> {
  const { sessionId, reason = 'USER_LOGOUT' } = params;
  const adminDb = createAdminClient();
  if (!adminDb) return true;

  try {
    const { error } = await adminDb
      .from('admin_sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revoke_reason: reason,
      })
      .eq('session_id', sessionId)
      .is('revoked_at', null);

    if (error && !isTableMissingError(error)) {
      console.error('[SessionService] Revocation error:', error);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[SessionService] Exception during session revocation:', err);
    return false;
  }
}

/**
 * Revokes all OTHER active sessions for a user, preserving the current session.
 */
export async function revokeOtherAdminSessions(params: {
  userId: string;
  currentSessionId: string;
}): Promise<{ revokedCount: number }> {
  const { userId, currentSessionId } = params;
  const adminDb = createAdminClient();
  if (!adminDb) return { revokedCount: 0 };

  try {
    const { data, error } = await adminDb
      .from('admin_sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revoke_reason: 'REVOKED_BY_USER_REQUEST',
      })
      .eq('user_id', userId)
      .neq('session_id', currentSessionId)
      .is('revoked_at', null)
      .select('id');

    if (error && !isTableMissingError(error)) {
      console.error('[SessionService] Error revoking other sessions:', error);
      return { revokedCount: 0 };
    }

    return { revokedCount: data?.length || 0 };
  } catch (err: any) {
    console.error('[SessionService] Exception revoking other sessions:', err);
    return { revokedCount: 0 };
  }
}

export interface ActiveSessionsInfo {
  webSession: {
    id: string;
    sessionId: string;
    browser: string;
    os: string;
    lastSeenAt: string;
    createdAt: string;
    isCurrent: boolean;
  } | null;
  androidSession: {
    id: string;
    sessionId: string;
    device: string;
    lastSeenAt: string;
    createdAt: string;
    isCurrent: boolean;
  } | null;
}

/**
 * Retrieves the current active sessions (WEB and ANDROID) for the authenticated admin user.
 */
export async function getActiveAdminSessions(
  userId: string,
  currentSessionId?: string | null
): Promise<ActiveSessionsInfo> {
  const adminDb = createAdminClient();
  if (!adminDb) {
    return { webSession: null, androidSession: null };
  }

  try {
    const { data: rows, error } = await adminDb
      .from('admin_sessions')
      .select('id, platform, session_id, device_id, user_agent, created_at, last_seen_at')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false });

    if (error || !rows) {
      return { webSession: null, androidSession: null };
    }

    let webSession: ActiveSessionsInfo['webSession'] = null;
    let androidSession: ActiveSessionsInfo['androidSession'] = null;

    for (const r of rows) {
      const isCurrent = Boolean(currentSessionId && r.session_id === currentSessionId);
      const uaInfo = parseUserAgentInfo(r.user_agent);

      if (r.platform === 'WEB' && !webSession) {
        webSession = {
          id: r.id,
          sessionId: r.session_id,
          browser: uaInfo.browser,
          os: uaInfo.os,
          lastSeenAt: r.last_seen_at,
          createdAt: r.created_at,
          isCurrent,
        };
      } else if (r.platform === 'ANDROID' && !androidSession) {
        androidSession = {
          id: r.id,
          sessionId: r.session_id,
          device: r.device_id || `Android App (${uaInfo.os})`,
          lastSeenAt: r.last_seen_at,
          createdAt: r.created_at,
          isCurrent,
        };
      }
    }

    return { webSession, androidSession };
  } catch (err) {
    console.error('[SessionService] Error getting active admin sessions:', err);
    return { webSession: null, androidSession: null };
  }
}
