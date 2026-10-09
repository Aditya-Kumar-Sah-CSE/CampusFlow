import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { EmailOtpType } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSafeRedirectUrl(nextParam: string | null, defaultFallback: string): string {
  if (!nextParam) return defaultFallback;
  const trimmed = nextParam.trim();
  // Ensure relative path starting with / and no protocol injection
  if (
    trimmed.startsWith('/') &&
    !trimmed.startsWith('//') &&
    !trimmed.startsWith('/\\') &&
    !trimmed.includes(':')
  ) {
    return trimmed;
  }
  return defaultFallback;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const nextParam = searchParams.get('next');
  const authError = searchParams.get('error_description') || searchParams.get('error');

  // Extract email if passed in next query or direct query
  let emailParam = searchParams.get('email');
  if (!emailParam && nextParam) {
    try {
      const qIdx = nextParam.indexOf('?');
      if (qIdx !== -1) {
        emailParam = new URLSearchParams(nextParam.substring(qIdx + 1)).get('email');
      }
    } catch {
      // non-fatal
    }
  }

  const isStudentContext =
    nextParam?.includes('/auth/student') ||
    nextParam?.includes('/feedback') ||
    !nextParam?.startsWith('/admin');

  // Determine fallback destination
  let defaultNext = '/feedback';
  if (type === 'recovery') {
    defaultNext = isStudentContext ? '/auth/student/reset-password' : '/admin/reset-password';
  } else if (type === 'signup' || type === 'email') {
    defaultNext = isStudentContext
      ? `/auth/student/login?verified=true${emailParam ? `&email=${encodeURIComponent(emailParam)}` : ''}`
      : '/admin/dashboard';
  } else if (!isStudentContext) {
    defaultNext = '/admin/dashboard';
  }

  const next = getSafeRedirectUrl(nextParam, defaultNext);
  const supabase = await createClient();

  // Helper to sync student verified flag in students table
  const syncStudentVerification = async (userId: string, email?: string) => {
    try {
      const adminDb = createAdminClient();
      if (adminDb && userId) {
        await adminDb
          .from('students')
          .update({ email_verified: true, updated_at: new Date().toISOString() })
          .eq('user_id', userId);

        await adminDb.auth.admin.updateUserById(userId, {
          user_metadata: { email_verified: true },
        });
      }
    } catch (e) {
      console.warn('[auth-callback] Failed syncing student verification state:', e);
    }
  };

  // Helper: check if student is already verified in DB/Auth (prevent false 'expired link' errors)
  const checkIsAlreadyVerified = async (emailToCheck?: string | null): Promise<boolean> => {
    try {
      const adminDb = createAdminClient();
      if (!adminDb) return false;

      // 1. Check current supabase session
      const { data: { user } } = await supabase.auth.getUser();
      if (user && (user.email_confirmed_at || user.user_metadata?.email_verified)) {
        await syncStudentVerification(user.id, user.email);
        return true;
      }

      // 2. Check by email if available
      if (emailToCheck) {
        const { data: usersData } = await adminDb.auth.admin.listUsers({ page: 1, perPage: 100 });
        const target = (usersData?.users || []).find(
          (u) => (u.email || '').toLowerCase().trim() === emailToCheck.toLowerCase().trim()
        );
        if (target && (target.email_confirmed_at || target.user_metadata?.email_verified)) {
          await syncStudentVerification(target.id, target.email);
          return true;
        }
      }
    } catch (e) {
      console.warn('[auth-callback] checkIsAlreadyVerified error:', e);
    }
    return false;
  };

  if (authError) {
    console.error('Supabase auth callback error param:', authError);
    // If the account was already confirmed (e.g. link clicked a second time), send to login with verified=true
    const alreadyVerified = await checkIsAlreadyVerified(emailParam);
    if (alreadyVerified && isStudentContext) {
      return NextResponse.redirect(`${origin}/auth/student/login?verified=true${emailParam ? `&email=${encodeURIComponent(emailParam)}` : ''}`);
    }

    const failureUrl = new URL(
      isStudentContext ? '/auth/student/login' : '/admin/login',
      origin
    );
    failureUrl.searchParams.set('error', 'The verification link is invalid or has expired. Please request a new one.');
    return NextResponse.redirect(failureUrl);
  }

  // 1. Handle PKCE code exchange
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data?.user?.id && (type === 'signup' || type === 'email')) {
        await syncStudentVerification(data.user.id, data.user.email);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('exchangeCodeForSession error:', error.message);
  }

  // 2. Handle token_hash verification (OTP / recovery / signup flow)
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });
    if (!error) {
      if (data?.user?.id && (type === 'signup' || type === 'email')) {
        await syncStudentVerification(data.user.id, data.user.email);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('verifyOtp error:', error.message);
  }

  // 3. Fallback: check if the student is already verified (avoid false expired errors on reload/double click)
  const isConfirmed = await checkIsAlreadyVerified(emailParam);
  if (isConfirmed) {
    if (isStudentContext) {
      return NextResponse.redirect(
        `${origin}/auth/student/login?verified=true${emailParam ? `&email=${encodeURIComponent(emailParam)}` : ''}`
      );
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  // If code or token_hash failed or was not provided, and account is not confirmed
  const failureUrl = new URL(
    isStudentContext ? '/auth/student/login' : '/admin/login',
    origin
  );
  failureUrl.searchParams.set('error', 'Invalid or expired verification link. Please try again or request a new link.');
  return NextResponse.redirect(failureUrl);
}
