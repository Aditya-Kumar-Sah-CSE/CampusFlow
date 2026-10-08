'use client';

import { useState, useEffect } from 'react';
import { ExamsManagementTab } from './ExamsManagementTab';
import { getCollegeExamsAction } from '@/app/admin/exams/actions';
import type { Exam } from '@/types/exams';
import { Loader2 } from 'lucide-react';

interface ExamsTabProps {
  activeCollegeId?: string;
}

export function ExamsTab({ activeCollegeId }: ExamsTabProps) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadExams() {
      setLoading(true);
      setError(null);
      try {
        const res = await getCollegeExamsAction(activeCollegeId);
        if (isMounted) {
          if (res.success && res.data) {
            setExams(res.data);
          } else {
            setError(res.error || 'Failed to load exams.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Error fetching exams.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadExams();

    return () => {
      isMounted = false;
    };
  }, [activeCollegeId]);

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-bce-navy animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Loading examinations and test rosters...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-2xl border border-red-200 text-red-800 text-xs">
        <p className="font-bold">Error loading exams</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  return (
    <ExamsManagementTab
      initialExams={exams}
      collegeId={activeCollegeId || ''}
    />
  );
}
