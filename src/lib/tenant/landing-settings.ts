import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface LandingPageSettings {
  showFeedbacks: boolean;
  showEvents: boolean;
}

const DEFAULT_SETTINGS: LandingPageSettings = {
  showFeedbacks: true,
  showEvents: true,
};

/**
 * Direct lookup for landing page settings without cache wrapper.
 */
export async function fetchDirectLandingSettings(collegeId: string): Promise<LandingPageSettings> {
  try {
    const adminDb = createAdminClient();
    const db = adminDb || (await createClient());

    // 1. First attempt to check public.colleges
    const { data: college, error: collegeErr } = await db
      .from('colleges')
      .select('id, show_feedbacks, show_events')
      .eq('id', collegeId)
      .maybeSingle();

    if (!collegeErr && college && college.show_feedbacks !== undefined && college.show_events !== undefined && college.show_feedbacks !== null && college.show_events !== null) {
      return {
        showFeedbacks: college.show_feedbacks !== false,
        showEvents: college.show_events !== false,
      };
    }

    // 2. Fallback / supplement: check audit_logs for persisted settings
    const auditClient = adminDb || db;
    const { data: auditRecord } = await auditClient
      .from('audit_logs')
      .select('metadata')
      .eq('college_id', collegeId)
      .eq('action', 'LANDING_PAGE_SETTINGS_UPDATED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (auditRecord?.metadata) {
      const meta = auditRecord.metadata as Record<string, any>;
      return {
        showFeedbacks: meta.show_feedbacks !== undefined ? Boolean(meta.show_feedbacks) : true,
        showEvents: meta.show_events !== undefined ? Boolean(meta.show_events) : true,
      };
    }

    return DEFAULT_SETTINGS;
  } catch (err) {
    console.warn(`[GET_LANDING_SETTINGS_WARNING] Error reading landing settings for college ${collegeId}:`, err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Module-level cached lookup for landing page settings by collegeId.
 * Defining unstable_cache at module scope ensures stable callback reference in Next.js runtime.
 */
const getCachedLandingSettings = unstable_cache(
  async (collegeId: string): Promise<LandingPageSettings> => {
    return fetchDirectLandingSettings(collegeId);
  },
  ['college_landing_settings'],
  {
    revalidate: 60,
    tags: ['colleges'],
  }
);

/**
 * Public getter for landing page settings by collegeId with safe fallback.
 */
export async function getCollegeLandingSettings(collegeId: string): Promise<LandingPageSettings> {
  try {
    return await getCachedLandingSettings(collegeId);
  } catch {
    // If unstable_cache fails (e.g. running in script or test outside of Next request context)
    return fetchDirectLandingSettings(collegeId);
  }
}

/**
 * Persists landing page settings for a college and triggers revalidation.
 */
export async function saveCollegeLandingSettings(
  collegeId: string,
  toggles: { showFeedbacks?: boolean; showEvents?: boolean },
  actor?: { userId?: string; email?: string } | string,
  collegeSlug?: string
): Promise<{ success: boolean; settings?: LandingPageSettings; error?: string }> {
  try {
    const adminDb = createAdminClient() || await createClient();

    // 1. Get current settings to merge
    const current = await getCollegeLandingSettings(collegeId);
    const newSettings: LandingPageSettings = {
      showFeedbacks: toggles.showFeedbacks !== undefined ? toggles.showFeedbacks : current.showFeedbacks,
      showEvents: toggles.showEvents !== undefined ? toggles.showEvents : current.showEvents,
    };

    // 2. Attempt to update public.colleges table directly
    try {
      await adminDb
        .from('colleges')
        .update({
          show_feedbacks: newSettings.showFeedbacks,
          show_events: newSettings.showEvents,
          updated_at: new Date().toISOString(),
        })
        .eq('id', collegeId);
    } catch (colErr) {
      console.warn('[SAVE_LANDING_SETTINGS] colleges table direct update note:', colErr);
    }

    // 3. Persist in audit_logs for guaranteed persistent audit trail and resilient fallback
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let actorUserId: string | null = null;
    let actorEmail = 'system@fms.edu';
    if (actor) {
      if (typeof actor === 'object') {
        if (actor.userId && uuidRegex.test(actor.userId)) {
          actorUserId = actor.userId;
        }
        if (actor.email) {
          actorEmail = actor.email;
        }
      } else if (typeof actor === 'string') {
        actorEmail = actor;
      }
    }

    try {
      await adminDb.from('audit_logs').insert({
        college_id: collegeId,
        actor_user_id: actorUserId,
        actor_email: actorEmail,
        action: 'LANDING_PAGE_SETTINGS_UPDATED',
        entity_type: 'college',
        entity_id: collegeId,
        details: `Landing page toggles updated: Feedbacks=${newSettings.showFeedbacks ? 'ON' : 'OFF'}, Events=${newSettings.showEvents ? 'ON' : 'OFF'}`,
        metadata: {
          show_feedbacks: newSettings.showFeedbacks,
          show_events: newSettings.showEvents,
          updated_at: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      console.error('[SAVE_LANDING_SETTINGS_AUDIT_ERROR]', auditErr);
    }

    // 4. Invalidate caches immediately
    try {
      revalidatePath('/');
      revalidatePath('/admin/institutions');
      revalidatePath('/admin/dashboard');
      revalidateTag('colleges');
      revalidateTag('all_active_colleges_cache');
      revalidateTag(`landing_settings_${collegeId}`);

      if (collegeSlug) {
        revalidatePath(`/${collegeSlug}`);
        revalidatePath(`/${collegeSlug}/feedback`);
        revalidatePath(`/${collegeSlug}/events`);
        revalidateTag(`tenant_${collegeSlug}`);
      }
    } catch {
      // Revalidation is context-dependent and will be skipped cleanly in offline/testing scripts
    }

    return { success: true, settings: newSettings };
  } catch (err: any) {
    console.error('[SAVE_LANDING_SETTINGS_EXCEPTION]', err);
    return { success: false, error: err.message || 'Failed to save landing settings.' };
  }
}
