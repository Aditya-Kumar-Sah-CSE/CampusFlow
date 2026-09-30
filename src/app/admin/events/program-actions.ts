'use server';

import { revalidatePath } from 'next/cache';
import { getAdminSession } from '@/lib/auth/admin-auth';
import type { CategoryFormData, ProgramFormData, ProgramRegistrationStatus, ProgramPaymentStatus } from '@/types/programs';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '@/lib/events/categories-service';
import {
  createProgram,
  updateProgram,
  deleteProgram,
} from '@/lib/events/programs-service';
import {
  verifyProgramPayment,
  rejectProgramPayment,
  updateProgramRegistrationStatus,
  registerForProgram,
} from '@/lib/events/program-registrations-service';
import type { ProgramRegistrationInput } from '@/types/programs';

// ============================================================
// AUTH HELPER
// ============================================================

async function assertAdminCollegeAuth(targetCollegeId?: string) {
  const session = await getAdminSession();
  if (!session.isAuthenticated || !session.isActive) {
    throw new Error('Authentication required.');
  }

  const collegeId = targetCollegeId || session.activeCollegeId;
  if (!collegeId) {
    throw new Error('Active institution context is required.');
  }

  if (!session.isPlatformSuperAdmin) {
    const isMember = session.colleges.some(
      (c) => c.collegeId === collegeId && c.status === 'ACTIVE'
    );
    if (!isMember) {
      throw new Error('Forbidden: You do not have admin permissions for this institution.');
    }
  }

  return { session, collegeId };
}

// ============================================================
// CATEGORY ACTIONS
// ============================================================

export async function createCategoryAction(
  eventId: string,
  data: CategoryFormData,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const result = await createCategory(eventId, collegeId, data);
    if (result.success) {
      revalidatePath(`/admin/dashboard/events/${eventId}`);
    }
    return result;
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to create category.' };
  }
}

export async function updateCategoryAction(
  categoryId: string,
  data: Partial<CategoryFormData>,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const result = await updateCategory(categoryId, collegeId, data);
    if (result.success) {
      revalidatePath('/admin/dashboard');
    }
    return result;
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to update category.' };
  }
}

export async function deleteCategoryAction(
  categoryId: string,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const result = await deleteCategory(categoryId, collegeId);
    if (result.success) {
      revalidatePath('/admin/dashboard');
    }
    return result;
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to delete category.' };
  }
}

export async function reorderCategoriesAction(
  eventId: string,
  orderedIds: string[],
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const result = await reorderCategories(eventId, collegeId, orderedIds);
    return result;
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to reorder categories.' };
  }
}

// ============================================================
// PROGRAM ACTIONS
// ============================================================

export async function createProgramAction(
  eventId: string,
  data: ProgramFormData,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string; programId?: string }> {
  try {
    const { collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const result = await createProgram(eventId, collegeId, data);
    if (result.success) {
      revalidatePath(`/admin/dashboard/events/${eventId}`);
      return { success: true, programId: result.program?.id };
    }
    return result;
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to create program.' };
  }
}

export async function updateProgramAction(
  programId: string,
  data: Partial<ProgramFormData>,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const result = await updateProgram(programId, collegeId, data);
    if (result.success) {
      revalidatePath('/admin/dashboard');
    }
    return result;
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to update program.' };
  }
}

export async function deleteProgramAction(
  programId: string,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const result = await deleteProgram(programId, collegeId);
    if (result.success) {
      revalidatePath('/admin/dashboard');
    }
    return result;
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to delete program.' };
  }
}

// ============================================================
// REGISTRATION ACTIONS
// ============================================================

export async function verifyProgramPaymentAction(
  registrationId: string,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { session, collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const result = await verifyProgramPayment(registrationId, collegeId, session.userId);
    if (result.success) {
      revalidatePath('/admin/dashboard');
    }
    return result;
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to verify payment.' };
  }
}

export async function rejectProgramPaymentAction(
  registrationId: string,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const result = await rejectProgramPayment(registrationId, collegeId);
    if (result.success) {
      revalidatePath('/admin/dashboard');
    }
    return result;
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to reject payment.' };
  }
}

export async function updateProgramRegistrationStatusAction(
  registrationId: string,
  newStatus: ProgramRegistrationStatus,
  targetCollegeId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { collegeId } = await assertAdminCollegeAuth(targetCollegeId);
    const result = await updateProgramRegistrationStatus(registrationId, collegeId, newStatus);
    if (result.success) {
      revalidatePath('/admin/dashboard');
    }
    return result;
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Failed to update status.' };
  }
}

/**
 * Public-facing registration action (no admin auth required)
 */
export async function registerForProgramAction(
  input: ProgramRegistrationInput
): Promise<{ success: boolean; error?: string; registration_id?: string; registration_number?: string; payment_status?: string }> {
  try {
    return await registerForProgram(input);
  } catch (err: unknown) {
    return { success: false, error: (err as Error).message || 'Registration failed.' };
  }
}
