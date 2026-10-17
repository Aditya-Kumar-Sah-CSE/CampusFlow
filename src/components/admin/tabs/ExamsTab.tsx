'use client';

import { useState, useEffect } from 'react';
import { ExamsManagementTab } from './ExamsManagementTab';
import { getCollegeExamsAction } from '@/app/admin/exams/actions';
import type { Exam } from '@/types/exams';
import { Loader2 } from 'lucide-react';

interface ExamsTabProps {
  activeCollegeId?: string;
  initialSubTab?: string;
}

export function ExamsTab({ activeCollegeId, initialSubTab }: ExamsTabProps) {
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
          const msg = err?.message || '';
          // Auto-reload if stale dev compilation action hash
          if (msg.includes('was not found on the server') || msg.includes('Failed to find Server Action')) {
            window.location.reload();
            return;
          }
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
      <div className="bg-white dark:bg-[#1f150c] p-12 rounded-[3px] border border-slate-200 dark:border-[#4d3817] shadow-xs flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-amber-600 dark:text-amber-400 animate-spin" />
        <p className="text-xs font-semibold text-slate-500 dark:text-[#c4a97d]">Loading examinations and test rosters...</p>
      </div>
    );
  }

  if (error) {
    const isStaleAction = error.includes('was not found on the server') || error.includes('Failed to find Server Action');
    return (
      <div className="bg-amber-50 dark:bg-amber-950/40 p-6 rounded-[3px] border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-3">
        <p className="font-bold">Error loading exams</p>
        <p className="mt-1">{isStaleAction ? 'Server updated with new changes. Please refresh to load latest version.' : error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-3.5 py-1.5 rounded-[3px] bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors cursor-pointer"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  return (
    <ExamsManagementTab
      initialExams={exams}
      collegeId={activeCollegeId || ''}
      initialSubTab={initialSubTab}
    />
  );
}
