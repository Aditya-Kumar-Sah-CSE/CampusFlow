/**
 * Multi-Tenant Authentication & Authorization Types
 */

export type PlatformRole = 'PLATFORM_SUPER_ADMIN';
export type CollegeRole = 'COLLEGE_ADMIN';
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED';
export type CollegeAdminRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AdminCollegeMembership {
  collegeId: string;
  slug: string;
  name: string;
  code: string;
  logoUrl: string | null;
  role: CollegeRole;
  status: MembershipStatus;
}

export interface AdminSession {
  userId: string;
  email: string;
  name: string;
  isPlatformSuperAdmin: boolean;
  colleges: AdminCollegeMembership[];
  activeCollegeId: string | null;
  activeCollege: AdminCollegeMembership | null;
  isAuthenticated: boolean;
  isActive: boolean;
  isPending: boolean;
  isRejected: boolean;
  /** Compatibility alias for isPlatformSuperAdmin */
  isSuperAdmin: boolean;
  /** Compatibility alias for isActive */
  isApproved: boolean;
  /** Compatibility object for legacy single-tenant admin references */
  admin: {
    id: string;
    user_id: string;
    email: string;
    name: string;
    role: string;
    status: string;
  } | null;
  /** Compatibility object for legacy user reference */
  user?: {
    id: string;
    email: string;
    user_metadata?: Record<string, any>;
  } | null;
  /** Server-side single-concurrent-session identifier */
  sessionId?: string | null;
  /** Active session platform (WEB or ANDROID) */
  platform?: AdminPlatform | null;
  /** Set to true if a previous session was superseded or revoked */
  sessionRevoked?: boolean;
  /** Machine-readable revocation code */
  sessionRevokedCode?: 'SESSION_REVOKED';
  /** Revocation reason (e.g. SUPERSEDED_BY_NEW_LOGIN, USER_LOGOUT) */
  sessionRevokedReason?: string | null;
  /** The platform that experienced revocation */
  sessionRevokedPlatform?: AdminPlatform | null;
}

export type AdminPlatform = 'WEB' | 'ANDROID';

export interface AdminSessionRecord {
  id: string;
  userId: string;
  platform: AdminPlatform;
  sessionId: string;
  deviceId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
}

export interface CollegeAdminRequest {
  id: string;
  userId: string | null;
  collegeId: string;
  email: string;
  name: string;
  designation?: string | null;
  department?: string | null;
  contactNumber?: string | null;
  status: CollegeAdminRequestStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}
