import Link from 'next/link';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase/env';
import { getStudentAvailableExams } from '@/lib/exams/exam-attempt-service';
import { PublicExamDiscovery } from '@/components/exams/PublicExamDiscovery';
import { ArrowLeft } from 'lucide-react';

export const revalidate = 300;

const publicClient = createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function PublicExamsPage() {
  const supabase = publicClient;
  const collegeQuery = supabase
    .from('colleges')
    .select('id, name, code, slug, logo_url')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1);

  const { data: collegeData } = await collegeQuery.maybeSingle();
  const activeCollege = collegeData || {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Bhagalpur College of Engineering',
    code: 'BCE_BGP',
    slug: 'bce-bhagalpur',
    logo_url: null,
  };

  const exams = await getStudentAvailableExams({ collegeId: activeCollege.id }).catch(() => []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <div className="bg-slate-900 text-white text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">{activeCollege.name} Examination Portal</span>
          </div>
          <Link
            href="/"
            className="text-slate-300 hover:text-white flex items-center gap-1 text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Campus Home
          </Link>
        </div>
      </div>

      <main className="flex-1">
        <PublicExamDiscovery
          exams={exams}
          collegeName={activeCollege.name}
          collegeLogo={activeCollege.logo_url}
        />
      </main>
    </div>
  );
}
