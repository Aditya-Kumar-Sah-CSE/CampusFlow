'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStudentSessionAction } from '@/app/auth/student/actions';
import type { StudentSession } from '@/types/student';

const DEFAULT_SESSION: StudentSession = {
  isAuthenticated: false,
  isStudent: false,
  emailVerified: false,
  student: null,
  user: null,
};

export function useStudentSession() {
  const [session, setSession] = useState<StudentSession>(DEFAULT_SESSION);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getStudentSessionAction();
      setSession(res);
      return res;
    } catch (err) {
      console.warn('[useStudentSession] Failed to fetch session:', err);
      setSession(DEFAULT_SESSION);
      return DEFAULT_SESSION;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getStudentSessionAction()
      .then((res) => {
        if (isMounted) {
          setSession(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    session,
    loading,
    refreshSession,
    isAuthenticated: session.isAuthenticated,
    isStudent: session.isStudent,
    emailVerified: session.emailVerified,
    student: session.student,
    user: session.user,
  };
}
