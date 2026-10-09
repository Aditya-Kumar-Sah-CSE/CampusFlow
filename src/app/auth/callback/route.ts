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

  const isStudentContext =
    nextParam?.includes('/auth/student') ||
    nextParam?.includes('/feedback') ||
    !nextParam?.startsWith('/admin');

  // Determine fallback destination
  let defaultNext = '/feedback';
  if (type === 'recovery') {
    defaultNext = isStudentContext ? '/auth/student/reset-password' : '/admin/reset-password';
  } else if (type === 'signup' || type === 'email') {
    defaultNext = isStudentContext ? '/auth/student/login?verified=true' : '/admin/dashboard';
  } else if (!isStudentContext) {
    defaultNext = '/admin/dashboard';
  }

  const next = getSafeRedirectUrl(nextParam, defaultNext);

  if (authError) {
    console.error('Supabase auth callback error param:', authError);
    const failureUrl = new URL(
      isStudentContext ? '/auth/student/login' : '/admin/login',
      origin
    );
    failureUrl.searchParams.set('error', 'The verification link is invalid or has expired. Please request a new one.');
    return NextResponse.redirect(failureUrl);
  }

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

  // If code or token_hash failed or was not provided
  const failureUrl = new URL(
    isStudentContext ? '/auth/student/login' : '/admin/login',
    origin
  );
  failureUrl.searchParams.set('error', 'Invalid or expired verification link. Please try again or request a new link.');
  return NextResponse.redirect(failureUrl);
}
