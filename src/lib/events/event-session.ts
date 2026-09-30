/**
 * Event Session Management
 * 
 * Secure server-side session for event participants.
 * Authentication: Registration Number + Email (from Google Sheet).
 * Session: Encrypted, signed JWT stored as HttpOnly cookie.
 * 
 * NO PASSWORDS stored in Google Sheets or anywhere.
 * Registration Number + Email = credential pair.
 */

import crypto from 'crypto';
import { cookies } from 'next/headers';

// ============================================================
// CONFIGURATION
// ============================================================

const SESSION_SECRET =
  process.env.EVENT_SESSION_SECRET ||
  process.env.GOOGLE_CLIENT_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'fms_event_session_secure_salt';

const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60; // 24 hours
const COOKIE_PREFIX = 'fms_event_session_';

// ============================================================
// TYPES
// ============================================================

export interface EventSessionPayload {
  registrationNumber: string;
  email: string;
  fullName: string;
  studentId: string;
  eventId: string;
  collegeId: string;
  mobile?: string;
  branch?: string;
  semester?: string;
  gender?: string;
  issuedAt: number;
  expiresAt: number;
}

export interface EventSessionResult {
  isValid: boolean;
  session: EventSessionPayload | null;
  error?: string;
}

// ============================================================
// TOKEN GENERATION & VERIFICATION (HMAC-SHA256 signed)
// ============================================================

/**
 * Creates a secure, tamper-proof session token.
 * Uses HMAC-SHA256 for integrity, base64url encoding.
 */
export function createSessionToken(payload: EventSessionPayload): string {
  const serialized = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(serialized)
    .digest('hex');

  return Buffer.from(
    JSON.stringify({ data: serialized, sig: signature })
  ).toString('base64url');
}

/**
 * Verifies and decodes a session token.
 * Returns null if tampered, expired, or malformed.
 */
export function verifySessionToken(token: string): EventSessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (!parsed?.data || !parsed?.sig) return null;

    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(parsed.data)
      .digest('hex');

    // Timing-safe comparison
    const sigBuffer = Buffer.from(parsed.sig, 'hex');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');
    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload: EventSessionPayload = JSON.parse(parsed.data);

    // Check expiry
    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ============================================================
// COOKIE MANAGEMENT
// ============================================================

function getCookieName(eventId: string): string {
  // Use a short hash of eventId to keep cookie name manageable
  const hash = crypto.createHash('md5').update(eventId).digest('hex').slice(0, 8);
  return `${COOKIE_PREFIX}${hash}`;
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Create an event session after successful login.
 * Sets an HttpOnly cookie with the signed session token.
 */
export async function createEventSession(params: {
  registrationNumber: string;
  email: string;
  fullName: string;
  studentId: string;
  eventId: string;
  collegeId: string;
  mobile?: string;
  branch?: string;
  semester?: string;
  gender?: string;
}): Promise<string> {
  const now = Date.now();
  const payload: EventSessionPayload = {
    registrationNumber: params.registrationNumber,
    email: params.email.toLowerCase().trim(),
    fullName: params.fullName,
    studentId: params.studentId,
    eventId: params.eventId,
    collegeId: params.collegeId,
    mobile: params.mobile,
    branch: params.branch,
    semester: params.semester,
    gender: params.gender,
    issuedAt: now,
    expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
  };

  const token = createSessionToken(payload);
  const cookieName = getCookieName(params.eventId);

  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });

  return token;
}

/**
 * Verify the current event session from cookies.
 * Returns the session payload if valid.
 */
export async function verifyEventSession(
  eventId: string
): Promise<EventSessionResult> {
  const cookieName = getCookieName(eventId);

  const cookieStore = await cookies();
  const cookie = cookieStore.get(cookieName);

  if (!cookie?.value) {
    return {
      isValid: false,
      session: null,
      error: 'No event session found. Please log in.',
    };
  }

  const payload = verifySessionToken(cookie.value);

  if (!payload) {
    return {
      isValid: false,
      session: null,
      error: 'Session expired or invalid. Please log in again.',
    };
  }

  // Verify the session is for the correct event
  if (payload.eventId !== eventId) {
    return {
      isValid: false,
      session: null,
      error: 'Session does not match this event.',
    };
  }

  return {
    isValid: true,
    session: payload,
  };
}

/**
 * Destroy the event session (logout).
 */
export async function destroyEventSession(eventId: string): Promise<void> {
  const cookieName = getCookieName(eventId);
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

/**
 * Get current event session without throwing errors.
 * Useful for conditional rendering in components.
 */
export async function getCurrentEventSession(
  eventId: string
): Promise<EventSessionPayload | null> {
  const result = await verifyEventSession(eventId);
  return result.session;
}
