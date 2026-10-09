/**
 * Sliding Window In-Memory Rate Limiter
 * Provides thread-safe, fast rate-limiting for auth, signup, resend verification, and password reset.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Periodic pruning every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupScheduled = false;

function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      // Remove timestamps older than 1 hour
      record.timestamps = record.timestamps.filter((t) => now - t < 3600 * 1000);
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref?.();
}

export interface RateLimitOptions {
  key: string;
  maxRequests: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  scheduleCleanup();

  const { key, maxRequests, windowSeconds } = options;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const threshold = now - windowMs;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter timestamps within current window
  record.timestamps = record.timestamps.filter((t) => t > threshold);

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: retryAfterSeconds,
      retryAfterSeconds,
    };
  }

  // Record this request
  record.timestamps.push(now);
  const remaining = maxRequests - record.timestamps.length;
  const oldest = record.timestamps[0];
  const resetInSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));

  return {
    allowed: true,
    remaining,
    resetInSeconds,
    retryAfterSeconds: 0,
  };
}

/**
 * Standard rate limiter keys for student authentication
 */
export const StudentRateLimits = {
  signup: (ip: string) => ({
    key: `student_signup:${ip}`,
    maxRequests: 60, // Accommodates shared campus Wi-Fi & computer lab NAT IPs (up to 60 registrations / 15m)
    windowSeconds: 15 * 60,
  }),
  loginFailed: (identifier: string) => ({
    key: `student_login_failed:${identifier}`,
    maxRequests: 5,
    windowSeconds: 15 * 60, // 5 failed attempts per 15 mins
  }),
  resendVerification: (email: string) => ({
    key: `student_resend_verify:${email.toLowerCase().trim()}`,
    maxRequests: 2,
    windowSeconds: 60, // 2 resend per 60 seconds
  }),
  passwordReset: (email: string) => ({
    key: `student_pw_reset:${email.toLowerCase().trim()}`,
    maxRequests: 3,
    windowSeconds: 15 * 60, // 3 requests per 15 mins
  }),
};
