import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { EventCategory, CategoryFormData } from '@/types/programs';

async function getDb() {
  return createAdminClient() || await createClient();
}

/**
 * Fetch all categories for an event (admin — includes inactive)
 */
export async function getAdminEventCategories(
  eventId: string,
  collegeId: string
): Promise<EventCategory[]> {
  const db = await getDb();

  const { data, error } = await db
    .from('event_categories')
    .select('*')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      console.warn('[GET_ADMIN_EVENT_CATEGORIES_INFO] Migration pending: Table "public.event_categories" does not exist in Supabase yet. Please execute migration 20260930000003_event_programs_and_categories.sql in the Supabase SQL Editor.');
    } else {
      console.error('[GET_ADMIN_EVENT_CATEGORIES_ERROR]', error.message);
    }
    return [];
  }

  return data || [];
}

/**
 * Fetch active categories for public view
 */
export async function getPublicEventCategories(
  eventId: string,
  collegeId: string
): Promise<EventCategory[]> {
  const db = await getDb();

  const { data, error } = await db
    .from('event_categories')
    .select('*')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('[GET_PUBLIC_EVENT_CATEGORIES_ERROR]', error.message);
    return [];
  }

  return data || [];
}

/**
 * Get a single category by ID (admin)
 */
export async function getAdminCategoryById(
  categoryId: string,
  collegeId: string
): Promise<EventCategory | null> {
  const db = await getDb();

  const { data, error } = await db
    .from('event_categories')
    .select('*')
    .eq('id', categoryId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Create a new category
 */
export async function createCategory(
  eventId: string,
  collegeId: string,
  formData: CategoryFormData
): Promise<{ success: boolean; error?: string; category?: EventCategory }> {
  const db = await getDb();

  const cleanName = formData.name.trim();
  if (!cleanName) {
    return { success: false, error: 'Category name is required.' };
  }

  // Get next display order
  const { data: existing } = await db
    .from('event_categories')
    .select('display_order')
    .eq('event_id', eventId)
    .eq('college_id', collegeId)
    .order('display_order', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

  const { data, error } = await db
    .from('event_categories')
    .insert({
      event_id: eventId,
      college_id: collegeId,
      name: cleanName,
      description: formData.description?.trim() || null,
      display_order: formData.display_order ?? nextOrder,
      is_active: formData.is_active ?? true,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A category with this name already exists for this event.' };
    }
    if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
      return {
        success: false,
        error: 'Database table "event_categories" is not created yet. Please execute migration 20260930000003_event_programs_and_categories.sql in your Supabase SQL Editor.',
      };
    }
    console.error('[CREATE_CATEGORY_ERROR]', error);
    return { success: false, error: error.message };
  }

  return { success: true, category: data };
}

/**
 * Update a category
 */
export async function updateCategory(
  categoryId: string,
  collegeId: string,
  formData: Partial<CategoryFormData>
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (formData.name !== undefined) updates.name = formData.name.trim();
  if (formData.description !== undefined) updates.description = formData.description?.trim() || null;
  if (formData.display_order !== undefined) updates.display_order = formData.display_order;
  if (formData.is_active !== undefined) updates.is_active = formData.is_active;

  const { error } = await db
    .from('event_categories')
    .update(updates)
    .eq('id', categoryId)
    .eq('college_id', collegeId);

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A category with this name already exists.' };
    }
    console.error('[UPDATE_CATEGORY_ERROR]', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Delete a category (safe: checks for existing programs/registrations)
 */
export async function deleteCategory(
  categoryId: string,
  collegeId: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  // Check for existing programs
  const { count: programCount } = await db
    .from('event_programs')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('college_id', collegeId);

  if ((programCount || 0) > 0) {
    return {
      success: false,
      error: `Cannot delete category: it has ${programCount} program(s). Remove or reassign programs first.`,
    };
  }

  const { error } = await db
    .from('event_categories')
    .delete()
    .eq('id', categoryId)
    .eq('college_id', collegeId);

  if (error) {
    console.error('[DELETE_CATEGORY_ERROR]', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Reorder categories
 */
export async function reorderCategories(
  eventId: string,
  collegeId: string,
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await db
      .from('event_categories')
      .update({ display_order: i, updated_at: new Date().toISOString() })
      .eq('id', orderedIds[i])
      .eq('event_id', eventId)
      .eq('college_id', collegeId);

    if (error) {
      console.error('[REORDER_CATEGORY_ERROR]', error);
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}
