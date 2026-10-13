'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { appUrl } from '@/lib/config/app';
import { checkRateLimit, StudentRateLimits } from '@/lib/security/rate-limit';
import { sendStudentVerificationEmail, sendStudentPasswordResetEmail } from '@/lib/email/service';
import { getStudentSession, checkStudentFormEligibility } from '@/lib/auth/student-auth';
import type { StudentSignupInput, StudentLoginInput, StudentFormEligibility, StudentSession } from '@/types/student';

/**
 * Zod validation schemas
 */
const signupSchema = z
  .object({
    collegeId: z.string().uuid({ message: 'Please select a valid institution.' }),
    fullName: z
      .string()
      .trim()
      .min(2, { message: 'Name must be at least 2 characters.' })
      .max(100, { message: 'Name cannot exceed 100 characters.' }),
    registrationNumber: z
      .string()
      .trim()
      .max(50, { message: 'Registration number cannot exceed 50 characters.' })
      .optional()
      .nullable(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email({ message: 'Please enter a valid email address.' }),
    password: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters long.' })
      .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
      .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
      .regex(/[0-9]/, { message: 'Password must contain at least one number.' }),
    confirmPassword: z.string(),
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: 'You must agree to the Terms of Service & Privacy Policy.' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get('x-forwarded-for')?.split(',')[0].trim() ||
      h.get('x-real-ip') ||
      '127.0.0.1'
    );
  } catch {
    return '127.0.0.1';
  }
}

/**
 * Fetches all active colleges for student signup selection
 */
export async function getActiveCollegesForSignupAction(): Promise<{
  success: boolean;
  colleges: Array<{ id: string; name: string; slug: string; code: string; logoUrl: string | null }>;
  error?: string;
}> {
  try {
    const db = createAdminClient() || (await createClient());
    const { data, error } = await db
      .from('colleges')
      .select('id, name, slug, code, logo_url, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('[signup-action] Error fetching colleges:', error);
      return { success: false, colleges: [], error: 'Failed to load colleges list.' };
    }

    return {
      success: true,
      colleges: (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        code: c.code,
        logoUrl: c.logo_url || null,
      })),
    };
  } catch (err: any) {
    return { success: false, colleges: [], error: err.message || 'Error loading institutions.' };
  }
}

/**
 * Handles Student Signup:
 * - Validates inputs (Zod)
 * - Rate limiting check
 * - Validates college_id exists and active in DB
 * - Creates user in Supabase Auth (unconfirmed)
 * - Associates student profile with college in students table
 * - Dispatches Brevo verification email
 */
export async function studentSignupAction(input: StudentSignupInput): Promise<{
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  verificationPending?: boolean;
  email?: string;
  collegeSlug?: string;
  retryAfterSeconds?: number;
}> {
  try {
    const ip = await getClientIp();
    const rateCheck = checkRateLimit(StudentRateLimits.signup(ip));
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Too many registration attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      };
    }

    // 1. Validate form fields
    const parsed = signupSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0]?.toString() || 'form';
        if (!fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      }
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Please fix the errors below.',
        fieldErrors,
      };
    }

    const { collegeId, fullName, registrationNumber, email, password } = parsed.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanReg = (registrationNumber || '').trim() || null;

    const adminDb = createAdminClient();
    if (!adminDb) {
      return { success: false, error: 'Server authentication service is temporarily unavailable.' };
    }

    // 2. Validate college exists and is active
    const { data: college, error: collegeError } = await adminDb
      .from('colleges')
      .select('id, name, slug, code, is_active')
      .eq('id', collegeId)
      .eq('is_active', true)
      .maybeSingle();

    if (collegeError || !college) {
      return {
        success: false,
        error: 'The selected institution is invalid or currently inactive. Please choose a valid institution.',
        fieldErrors: { collegeId: 'Selected institution is invalid or inactive.' },
      };
    }

    // 2.1 Validate optional registration number uniqueness within college
    if (cleanReg) {
      const { data: duplicateStudent } = await adminDb
        .from('students')
        .select('id, user_id, registration_number')
        .ilike('registration_number', cleanReg)
        .eq('college_id', college.id)
        .limit(1)
        .maybeSingle();

      if (duplicateStudent) {
        return {
          success: false,
          error: `Registration number "${cleanReg}" already exists. This registration number is already registered with another student account.`,
          fieldErrors: {
            registrationNumber: `Registration number "${cleanReg}" already exists.`,
          },
        };
      }
    }

    // 3. Check if user already exists
    let existingUserId: string | null = null;
    let isAlreadyConfirmed = false;

    try {
      const { data: usersData } = await adminDb.auth.admin.listUsers({ page: 1, perPage: 100 });
      const foundUser = usersData?.users?.find(
        (u) => (u.email || '').toLowerCase().trim() === cleanEmail
      );
      if (foundUser) {
        existingUserId = foundUser.id;
        isAlreadyConfirmed = Boolean(foundUser.email_confirmed_at);
      }
    } catch (err) {
      console.warn('[signup-action] listUsers check warning:', err);
    }

    // If already confirmed account exists
    if (existingUserId && isAlreadyConfirmed) {
      return {
        success: false,
        error: 'An account with this email address already exists. Please log in or reset your password.',
        fieldErrors: { email: 'An account with this email already exists.' },
      };
    }

    let targetUserId = existingUserId;

    // 4. Create user if not already present
    if (!targetUserId) {
      const { data: createData, error: createError } = await adminDb.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: false,
        user_metadata: {
          role: 'STUDENT',
          name: fullName,
          registration_number: cleanReg,
          college_id: college.id,
          college_name: college.name,
          college_slug: college.slug,
          college_code: college.code,
        },
      });

      if (createError) {
        console.error('[signup-action] createUser error:', createError);
        return {
          success: false,
          error: createError.message || 'Unable to register account. Please check your information.',
        };
      }

      targetUserId = createData.user.id;
    } else {
      // Update password & metadata for unverified existing user
      await adminDb.auth.admin.updateUserById(targetUserId, {
        password,
        user_metadata: {
          role: 'STUDENT',
          name: fullName,
          registration_number: cleanReg,
          college_id: college.id,
          college_name: college.name,
          college_slug: college.slug,
          college_code: college.code,
        },
      });
    }

    // 5. Store / update student profile record in students table
    try {
      await adminDb.from('students').upsert(
        {
          user_id: targetUserId,
          college_id: college.id,
          email: cleanEmail,
          full_name: fullName,
          registration_number: cleanReg,
          is_active: true,
          email_verified: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch (dbErr) {
      console.warn('[signup-action] students table upsert warning (table may be pending migration):', dbErr);
    }

    // 6. Generate secure email verification link
    const redirectDestination = appUrl(
      `/auth/callback?type=signup&next=${encodeURIComponent(`/auth/student/login?verified=true&email=${encodeURIComponent(cleanEmail)}`)}`
    );

    const { data: linkData, error: linkError } = await adminDb.auth.admin.generateLink({
      type: 'signup',
      email: cleanEmail,
      password,
      options: {
        redirectTo: redirectDestination,
      },
    });

    if (linkError) {
      console.error('[signup-action] generateLink error:', linkError);
    }

    const hashedToken = linkData?.properties?.hashed_token;
    const verificationUrl = hashedToken
      ? appUrl(
          `/auth/callback?token_hash=${hashedToken}&type=signup&email=${encodeURIComponent(cleanEmail)}&next=${encodeURIComponent(
            `/auth/student/login?verified=true&email=${encodeURIComponent(cleanEmail)}`
          )}`
        )
      : (linkData?.properties?.action_link || redirectDestination);

    // 7. Dispatch verification email via Brevo
    await sendStudentVerificationEmail({
      studentEmail: cleanEmail,
      studentName: fullName,
      collegeName: college.name,
      verificationUrl,
    });

    return {
      success: true,
      verificationPending: true,
      email: cleanEmail,
      collegeSlug: college.slug,
    };
  } catch (err: any) {
    console.error('[signup-action] Unexpected error:', err);
    return {
      success: false,
      error: err.message || 'An unexpected error occurred during signup. Please try again.',
    };
  }
}

/**
 * Handles Student Login
 * - Uses Supabase Auth signInWithPassword
 * - Validates email verification status
 * - Validates student role
 * - Enforces safe destination redirect
 */
export async function studentLoginAction(
  input: StudentLoginInput,
  requestedRedirect?: string | null
): Promise<{
  success: boolean;
  error?: string;
  redirectTo?: string;
  requiresVerification?: boolean;
  email?: string;
}> {
  try {
    const ip = await getClientIp();
    const cleanEmail = (input.email || '').toLowerCase().trim();

    // Check failed attempt rate limits
    const rateCheck = checkRateLimit(StudentRateLimits.loginFailed(`${ip}:${cleanEmail}`));
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Too many login attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
      };
    }

    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid credentials.' };
    }

    const supabase = await createClient();

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: input.password,
    });

    if (authError || !authData.user) {
      const rawMsg = (authError?.message || '').toLowerCase();
      if (rawMsg.includes('invalid login credentials') || rawMsg.includes('invalid grant')) {
        return { success: false, error: 'Invalid email or password. Please verify your credentials.' };
      }
      if (rawMsg.includes('email not confirmed')) {
        return {
          success: false,
          error: 'Your email address is not yet verified. Please verify your email before logging in.',
          requiresVerification: true,
          email: cleanEmail,
        };
      }
      return {
        success: false,
        error: authError?.message || 'Authentication failed. Please verify your credentials.',
      };
    }

    const user = authData.user;

    // 2. Enforce email verification
    const isConfirmed = Boolean(user.email_confirmed_at || user.user_metadata?.email_verified === true);
    if (!isConfirmed) {
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'Your email address is not yet verified. Please click the verification link sent to your inbox.',
        requiresVerification: true,
        email: cleanEmail,
      };
    }

    // Auto-sync students table email_verified flag
    try {
      const adminDb = createAdminClient();
      if (adminDb && user.id) {
        await adminDb
          .from('students')
          .update({ email_verified: true, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
      }
    } catch {
      // non-fatal
    }

    // 3. Resolve destination URL safely
    let targetDestination = '/feedback';

    const collegeSlug = user.user_metadata?.college_slug;
    if (collegeSlug) {
      targetDestination = `/${collegeSlug}/feedback`;
    }

    if (requestedRedirect) {
      const trimmed = requestedRedirect.trim();
      // Prevent open redirect: must start with single '/', not '//' or 'http'
      if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
        // Prevent redirecting into admin portal if student has no admin role
        if (!trimmed.startsWith('/admin') || user.user_metadata?.role !== 'STUDENT') {
          targetDestination = trimmed;
        }
      }
    }

    return {
      success: true,
      redirectTo: targetDestination,
    };
  } catch (err: any) {
    console.error('[login-action] Login error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred during login. Please try again.',
    };
  }
}

/**
 * Resends email verification link
 * Rate limited to 1 per 60 seconds per email
 */
export async function resendStudentVerificationAction(email: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  retryAfterSeconds?: number;
}> {
  try {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please provide a valid email address.' };
    }

    // Rate limit
    const rateCheck = checkRateLimit(StudentRateLimits.resendVerification(cleanEmail));
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Please wait ${rateCheck.retryAfterSeconds} seconds before requesting another verification email.`,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      };
    }

    const adminDb = createAdminClient();
    if (!adminDb) {
      return { success: false, error: 'Email service is temporarily unavailable.' };
    }

    // Lookup user
    const { data: usersData } = await adminDb.auth.admin.listUsers({ page: 1, perPage: 100 });
    const user = usersData?.users?.find(
      (u) => (u.email || '').toLowerCase().trim() === cleanEmail
    );

    // If user already confirmed or doesn't exist, safely report success to prevent enumeration
    if (!user || user.email_confirmed_at) {
      return {
        success: true,
        message: 'If an unverified account exists with this email, a verification link has been sent.',
      };
    }

    const redirectDestination = appUrl(
      `/auth/callback?type=signup&next=${encodeURIComponent(`/auth/student/login?verified=true&email=${encodeURIComponent(cleanEmail)}`)}`
    );

    const { data: linkData, error: linkError } = await adminDb.auth.admin.generateLink({
      type: 'magiclink',
      email: cleanEmail,
      options: {
        redirectTo: redirectDestination,
      },
    });

    if (linkError) {
      console.error('[resend-action] generateLink error:', linkError);
      return { success: false, error: 'Failed to generate verification link. Please try again.' };
    }

    const hashedToken = linkData?.properties?.hashed_token;
    const verificationType = linkData?.properties?.verification_type || 'magiclink';
    const verificationUrl = hashedToken
      ? appUrl(
          `/auth/callback?token_hash=${hashedToken}&type=${verificationType}&email=${encodeURIComponent(cleanEmail)}&next=${encodeURIComponent(
            `/auth/student/login?verified=true&email=${encodeURIComponent(cleanEmail)}`
          )}`
        )
      : (linkData?.properties?.action_link || redirectDestination);

    const collegeName = user.user_metadata?.college_name || 'CampusFlow';
    const fullName = user.user_metadata?.name || 'Student';

    await sendStudentVerificationEmail({
      studentEmail: cleanEmail,
      studentName: fullName,
      collegeName,
      verificationUrl,
    });

    return {
      success: true,
      message: 'A fresh verification link has been sent to your email address. Please check your inbox and spam folder.',
    };
  } catch (err: any) {
    console.error('[resend-action] Resend error:', err);
    return { success: false, error: 'Failed to resend verification email. Please try again.' };
  }
}

/**
 * Initiates student password reset
 */
export async function studentForgotPasswordAction(email: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const rateCheck = checkRateLimit(StudentRateLimits.passwordReset(cleanEmail));
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Too many requests. Please wait ${rateCheck.retryAfterSeconds} seconds before requesting another reset.`,
      };
    }

    const adminDb = createAdminClient();
    if (!adminDb) {
      return { success: false, error: 'Service temporarily unavailable.' };
    }

    const resetDestination = appUrl(
      `/auth/callback?type=recovery&next=${encodeURIComponent('/auth/student/reset-password')}`
    );

    const { data: linkData } = await adminDb.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo: resetDestination,
      },
    });

    if (linkData?.properties?.action_link) {
      await sendStudentPasswordResetEmail({
        studentEmail: cleanEmail,
        resetUrl: linkData.properties.action_link,
      });
    }

    return {
      success: true,
      message: 'If an account exists with that email address, password reset instructions have been sent.',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error processing password reset request.' };
  }
}

/**
 * Resets student password with active session from recovery link
 */
export async function studentResetPasswordAction(password: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update password.' };
  }
}

/**
 * Student sign out
 */
export async function studentSignOutAction(): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { success: true };
  } catch (err) {
    console.error('[signout-action] Signout error:', err);
    return { success: true };
  }
}

/**
 * Retrieves the current authenticated student session
 */
export async function getStudentSessionAction(): Promise<StudentSession> {
  return getStudentSession();
}

/**
 * Checks feedback form eligibility for currently logged in student
 */
export async function checkStudentFormEligibilityAction(
  formId: string
): Promise<StudentFormEligibility> {
  return checkStudentFormEligibility(formId);
}

/**
 * Checks which forms among a list have already been submitted by the currently logged-in student.
 * Returns a map of formId -> boolean (alreadySubmitted) and confirmationUrl.
 */
export async function checkBatchStudentFormSubmissionsAction(
  formIds: string[]
): Promise<{
  isAuthenticated: boolean;
  userEmail: string | null;
  submittedFormIds: string[];
}> {
  const session = await getStudentSession();
  if (!session.isAuthenticated || !session.user?.email || !formIds.length) {
    return {
      isAuthenticated: Boolean(session.isAuthenticated),
      userEmail: session.user?.email || null,
      submittedFormIds: [],
    };
  }

  const db = createAdminClient() || (await createClient());
  try {
    const { data: records } = await db
      .from('feedback_response_records')
      .select('form_id')
      .in('form_id', formIds)
      .ilike('student_email', session.user.email);

    const submitted = (records || []).map((r: any) => r.form_id).filter(Boolean);
    return {
      isAuthenticated: true,
      userEmail: session.user.email,
      submittedFormIds: submitted,
    };
  } catch (err) {
    console.warn('[checkBatchStudentFormSubmissionsAction] Query warning:', err);
    return {
      isAuthenticated: true,
      userEmail: session.user.email,
      submittedFormIds: [],
    };
  }
}

/**
 * Updates the profile (Full Name and/or Registration Number) for the currently authenticated student.
 * Validates session and synchronizes both public.students and auth.users user_metadata.
 */
export async function updateStudentProfileAction(input: {
  fullName?: string;
  registrationNumber?: string | null;
}): Promise<{
  success: boolean;
  fullName?: string;
  registrationNumber?: string | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Unauthorized: Please log in to update your profile.' };
    }

    // 1. Validate full name if provided
    let cleanFullName: string | undefined = undefined;
    if (input.fullName !== undefined) {
      cleanFullName = input.fullName.trim();
      if (!cleanFullName) {
        return { success: false, error: 'Full name cannot be empty.' };
      }
      if (cleanFullName.length < 2) {
        return { success: false, error: 'Full name must be at least 2 characters long.' };
      }
      if (cleanFullName.length > 100) {
        return { success: false, error: 'Full name cannot exceed 100 characters.' };
      }
    }

    // 2. Validate registration number if provided
    let cleanReg: string | null | undefined = undefined;
    if (input.registrationNumber !== undefined) {
      const trimmed = (input.registrationNumber || '').trim();
      if (trimmed.length > 50) {
        return { success: false, error: 'Registration number cannot exceed 50 characters.' };
      }
      cleanReg = trimmed || null;
    }

    const adminDb = createAdminClient() || supabase;

    // Check existing student profile to get college context
    const { data: existingStudent } = await adminDb
      .from('students')
      .select('id, college_id, registration_number')
      .eq('user_id', user.id)
      .maybeSingle();

    // Prevent duplicate registration number in the college
    if (cleanReg) {
      const currentCollegeId =
        existingStudent?.college_id ||
        user.user_metadata?.college_id;

      let dupQuery = adminDb
        .from('students')
        .select('id, user_id, full_name, email, registration_number, college_id')
        .ilike('registration_number', cleanReg)
        .neq('user_id', user.id);

      if (currentCollegeId) {
        dupQuery = dupQuery.eq('college_id', currentCollegeId);
      }

      const { data: duplicateStudent } = await dupQuery.limit(1).maybeSingle();

      let isDuplicate = Boolean(duplicateStudent);

      if (!isDuplicate && adminDb.auth?.admin?.listUsers) {
        try {
          const { data: userList } = await adminDb.auth.admin.listUsers({ perPage: 1000 });
          const match = userList?.users?.find(
            (u) =>
              u.id !== user.id &&
              u.user_metadata?.registration_number &&
              u.user_metadata.registration_number.toString().trim().toUpperCase() === cleanReg.toUpperCase() &&
              (!currentCollegeId || !u.user_metadata.college_id || u.user_metadata.college_id === currentCollegeId)
          );
          if (match) {
            isDuplicate = true;
          }
        } catch (listErr) {
          console.warn('[updateStudentProfileAction] listUsers duplicate check warning:', listErr);
        }
      }

      if (isDuplicate) {
        return {
          success: false,
          error: `Registration number "${cleanReg}" already exists. This registration number is already registered with another student account.`,
        };
      }
    }

    // 3. Prepare payload for public.students table
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (cleanFullName !== undefined) {
      updatePayload.full_name = cleanFullName;
    }
    if (cleanReg !== undefined) {
      updatePayload.registration_number = cleanReg;
    }

    if (existingStudent) {
      const { error: studentUpdateError } = await adminDb
        .from('students')
        .update(updatePayload)
        .eq('user_id', user.id);

      if (studentUpdateError) {
        console.error('[updateStudentProfileAction] DB update error:', studentUpdateError);
        return { success: false, error: 'Failed to update student profile in database.' };
      }
    } else if (user.user_metadata?.college_id) {
      try {
        await adminDb.from('students').insert({
          user_id: user.id,
          college_id: user.user_metadata.college_id,
          email: user.email?.toLowerCase().trim() || '',
          full_name: cleanFullName || user.user_metadata?.name || 'Student',
          registration_number: cleanReg !== undefined ? cleanReg : (user.user_metadata?.registration_number || null),
          is_active: true,
          email_verified: Boolean(user.email_confirmed_at || user.user_metadata?.email_verified),
          updated_at: new Date().toISOString(),
        });
      } catch (insertErr) {
        console.warn('[updateStudentProfileAction] Insert fallback warning:', insertErr);
      }
    }

    // 4. Update user_metadata in auth.users so metadata stays in sync
    const updatedMetadata = {
      ...(user.user_metadata || {}),
      ...(cleanFullName !== undefined ? { name: cleanFullName } : {}),
      ...(cleanReg !== undefined ? { registration_number: cleanReg } : {}),
    };

    try {
      if (adminDb.auth?.admin?.updateUserById) {
        await adminDb.auth.admin.updateUserById(user.id, {
          user_metadata: updatedMetadata,
        });
      }
    } catch (metaErr) {
      console.warn('[updateStudentProfileAction] Admin metadata sync warning:', metaErr);
    }

    // Also update current active session user so client-side session immediately reflects the new metadata
    try {
      await supabase.auth.updateUser({
        data: updatedMetadata,
      });
    } catch (userErr) {
      console.warn('[updateStudentProfileAction] supabase.auth.updateUser warning:', userErr);
    }

    return {
      success: true,
      fullName: cleanFullName !== undefined ? cleanFullName : (user.user_metadata?.name || 'Student'),
      registrationNumber: cleanReg !== undefined ? cleanReg : (user.user_metadata?.registration_number || null),
    };
  } catch (err: any) {
    console.error('[updateStudentProfileAction] Error:', err);
    return { success: false, error: err?.message || 'An unexpected error occurred.' };
  }
}

/**
 * Updates the registration number for the currently authenticated student.
 * Maintained for backwards compatibility.
 */
export async function updateStudentRegistrationNumberAction(
  registrationNumber: string
): Promise<{
  success: boolean;
  registrationNumber?: string | null;
  error?: string;
}> {
  const res = await updateStudentProfileAction({ registrationNumber });
  return {
    success: res.success,
    registrationNumber: res.registrationNumber,
    error: res.error,
  };
}

/**
 * Real-time check to verify if a registration number is already registered with another student account.
 */
export async function checkStudentRegistrationNumberAction(
  registrationNumber: string
): Promise<{
  available: boolean;
  error?: string;
}> {
  try {
    const trimmed = (registrationNumber || '').trim();
    if (!trimmed) {
      return { available: true };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminDb = createAdminClient() || supabase;

    let currentCollegeId: string | undefined = user?.user_metadata?.college_id;
    if (user) {
      const { data: myStudent } = await adminDb
        .from('students')
        .select('college_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (myStudent?.college_id) {
        currentCollegeId = myStudent.college_id;
      }
    }

    let dupQuery = adminDb
      .from('students')
      .select('id, user_id, registration_number, college_id')
      .ilike('registration_number', trimmed);

    if (user) {
      dupQuery = dupQuery.neq('user_id', user.id);
    }
    if (currentCollegeId) {
      dupQuery = dupQuery.eq('college_id', currentCollegeId);
    }

    const { data: duplicate } = await dupQuery.limit(1).maybeSingle();
    if (duplicate) {
      return {
        available: false,
        error: `Registration number "${trimmed}" already exists. This registration number is already registered with another student account.`,
      };
    }

    if (adminDb.auth?.admin?.listUsers) {
      try {
        const { data: userList } = await adminDb.auth.admin.listUsers({ perPage: 1000 });
        const match = userList?.users?.find(
          (u) =>
            (!user || u.id !== user.id) &&
            u.user_metadata?.registration_number &&
            u.user_metadata.registration_number.toString().trim().toUpperCase() === trimmed.toUpperCase() &&
            (!currentCollegeId || !u.user_metadata.college_id || u.user_metadata.college_id === currentCollegeId)
        );
        if (match) {
          return {
            available: false,
            error: `Registration number "${trimmed}" already exists. This registration number is already registered with another student account.`,
          };
        }
      } catch (listErr) {
        console.warn('[checkStudentRegistrationNumberAction] listUsers check warning:', listErr);
      }
    }

    return { available: true };
  } catch {
    return { available: true };
  }
}


