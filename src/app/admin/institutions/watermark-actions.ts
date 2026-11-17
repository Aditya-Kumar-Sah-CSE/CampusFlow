'use server';

import { getAdminSession } from '@/lib/auth/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  type CollegeWatermarkConfig,
  getCollegeWatermarkConfig,
  saveCollegeWatermarkConfig,
  resetCollegeWatermarkConfig,
  isCollegePaidSubscriptionActive,
  isWatermarkRequiredForCollege,
} from '@/lib/pdf/watermark';

async function getAdminDb() {
  return createAdminClient() || (await createClient());
}

/**
 * Loads the current watermark configuration and subscription state for a college.
 * Super Admin only.
 */
export async function getCollegeWatermarkAction(collegeId: string): Promise<{
  success: boolean;
  config?: CollegeWatermarkConfig;
  college?: {
    id: string;
    name: string;
    code: string;
    slug: string;
    logoUrl?: string;
  };
  isPaid?: boolean;
  error?: string;
}> {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isPlatformSuperAdmin) {
      return { success: false, error: 'Forbidden: Super Admin access required.' };
    }

    if (!collegeId) {
      return { success: false, error: 'College ID is required.' };
    }

    const supabase = await getAdminDb();
    const { data: college, error: collegeErr } = await supabase
      .from('colleges')
      .select('id, name, code, slug, logo_url')
      .eq('id', collegeId)
      .maybeSingle();

    if (collegeErr || !college) {
      return { success: false, error: 'College not found.' };
    }

    const [isPaid, config] = await Promise.all([
      isCollegePaidSubscriptionActive(collegeId),
      getCollegeWatermarkConfig(collegeId, college.name, college.code),
    ]);

    return {
      success: true,
      config,
      college: {
        id: college.id,
        name: college.name,
        code: college.code,
        slug: college.slug,
        logoUrl: college.logo_url || '',
      },
      isPaid,
    };
  } catch (err: any) {
    console.error('[getCollegeWatermarkAction_ERR]', err);
    return { success: false, error: err?.message || 'Failed to fetch watermark settings.' };
  }
}

/**
 * Saves updated watermark configuration for a college.
 * Super Admin only.
 */
export async function saveCollegeWatermarkAction(
  config: CollegeWatermarkConfig
): Promise<{
  success: boolean;
  config?: CollegeWatermarkConfig;
  error?: string;
}> {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isPlatformSuperAdmin) {
      return { success: false, error: 'Forbidden: Super Admin access required.' };
    }

    if (!config?.collegeId) {
      return { success: false, error: 'Invalid configuration: collegeId is required.' };
    }

    const res = await saveCollegeWatermarkConfig(config, {
      userId: session.userId,
      email: session.email || 'superadmin@campusflow.in',
    });

    return res;
  } catch (err: any) {
    console.error('[saveCollegeWatermarkAction_ERR]', err);
    return { success: false, error: err?.message || 'Failed to save watermark settings.' };
  }
}

/**
 * Resets watermark settings back to defaults for a college.
 * Super Admin only.
 */
export async function resetCollegeWatermarkAction(collegeId: string): Promise<{
  success: boolean;
  config?: CollegeWatermarkConfig;
  error?: string;
}> {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated || !session.isPlatformSuperAdmin) {
      return { success: false, error: 'Forbidden: Super Admin access required.' };
    }

    const supabase = await getAdminDb();
    const { data: college } = await supabase
      .from('colleges')
      .select('name')
      .eq('id', collegeId)
      .maybeSingle();

    const res = await resetCollegeWatermarkConfig(
      collegeId,
      {
        userId: session.userId,
        email: session.email || 'superadmin@campusflow.in',
      },
      college?.name
    );

    return res;
  } catch (err: any) {
    console.error('[resetCollegeWatermarkAction_ERR]', err);
    return { success: false, error: err?.message || 'Failed to reset watermark settings.' };
  }
}

/**
 * Checks whether watermarks are active/required for an institution.
 * Usable by any authenticated admin for instant client verification.
 */
export async function checkWatermarkRequiredAction(collegeId?: string): Promise<{
  required: boolean;
}> {
  try {
    const session = await getAdminSession();
    if (!session.isAuthenticated) {
      return { required: false };
    }
    const targetId = collegeId || session.activeCollegeId;
    if (!targetId) {
      return { required: false };
    }
    const required = await isWatermarkRequiredForCollege(targetId);
    return { required };
  } catch {
    return { required: false };
  }
}

