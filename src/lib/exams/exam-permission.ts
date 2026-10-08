import { getAdminSession } from '@/lib/auth/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { AdminSession } from '@/types/auth';

export async function getExamDbClient() {
  const adminClient = createAdminClient();
  if (adminClient) return adminClient;
  return await createClient();
}

/**
 * Ensures user has authenticated admin/faculty session for the target college.
 * Returns authorized college ID and session.
 */
export async function assertExamFacultyAccess(targetCollegeId?: string): Promise<{
  session: AdminSession;
  authorizedCollegeId: string;
}> {
  const session = await getAdminSession();

  if (!session.isAuthenticated || !session.isActive) {
    throw new Error('Unauthorized. Active administrator or faculty session required.');
  }

  const effectiveCollegeId = targetCollegeId || session.activeCollegeId;

  if (!effectiveCollegeId) {
    throw new Error('Unauthorized. No target institution selected.');
  }

  // Super admins have platform-wide authority
  if (session.isPlatformSuperAdmin) {
    return { session, authorizedCollegeId: effectiveCollegeId };
  }

  // Verify membership in target college
  const isAuthorized = session.colleges.some(
    c => c.collegeId === effectiveCollegeId && c.status === 'ACTIVE'
  );

  if (!isAuthorized) {
    throw new Error('Forbidden. You do not have permissions for this institution.');
  }

  return { session, authorizedCollegeId: effectiveCollegeId };
}

/**
 * Standardized audit logger for exam actions.
 */
export async function logExamAudit(params: {
  collegeId: string;
  adminId?: string | null;
  actorEmail?: string | null;
  action: string;
  examId: string;
  details: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const db = await getExamDbClient();
    await db.from('audit_logs').insert({
      college_id: params.collegeId,
      actor_user_id: params.adminId || null,
      actor_email: params.actorEmail || 'system@campusflow.in',
      action: params.action,
      entity_type: 'exam',
      entity_id: params.examId,
      details: params.details,
      metadata: params.metadata || {},
    });
  } catch (err) {
    console.warn('[EXAM_AUDIT_LOG_ERROR]', err);
  }
}
