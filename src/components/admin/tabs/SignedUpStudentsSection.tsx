'use client';

import { useState, useTransition, useMemo, useCallback } from 'react';
import {
  GraduationCap,
  Search,
  Building2,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  UserX,
  Loader2,
  RefreshCw,
  Download,
  Copy,
  Check,
  Mail,
  Calendar,
  Hash,
  School,
  X,
  Filter,
  Pencil,
} from 'lucide-react';
import { useHydrated, formatDateShort, formatTime } from '@/lib/hooks/use-hydrated';
import {
  getSignedUpStudentsAction,
  toggleStudentStatusAction,
  updateAdminStudentRegistrationNumberAction,
  type AdminStudentItem,
} from '@/app/admin/actions';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

interface Props {
  initialStudents?: AdminStudentItem[];
  allColleges?: Array<{ id: string; name: string; code: string; slug: string }>;
  isSuperAdmin: boolean;
  activeCollegeId?: string;
  activeCollegeName?: string;
}

export function SignedUpStudentsSection({
  initialStudents = [],
  allColleges = [],
  isSuperAdmin,
  activeCollegeId,
  activeCollegeName,
}: Props) {
  const hydrated = useHydrated();
  const [students, setStudents] = useState<AdminStudentItem[]>(initialStudents);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Filters state
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVerification, setFilterVerification] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Interactive feedback
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [togglingStudent, setTogglingStudent] = useState<AdminStudentItem | null>(null);

  // Admin edit registration number modal state
  const [editingRegStudent, setEditingRegStudent] = useState<AdminStudentItem | null>(null);
  const [regInput, setRegInput] = useState('');
  const [isUpdatingReg, setIsUpdatingReg] = useState(false);

  const handleSaveRegNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegStudent) return;
    setIsUpdatingReg(true);
    try {
      const res = await updateAdminStudentRegistrationNumberAction(
        editingRegStudent.id,
        regInput
      );
      if (res.success) {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === editingRegStudent.id
              ? { ...s, registration_number: res.registrationNumber || null }
              : s
          )
        );
        setMessage({
          type: 'success',
          text: `Registration number updated for ${editingRegStudent.full_name || editingRegStudent.email}.`,
        });
        setEditingRegStudent(null);
      } else {
        setMessage({
          type: 'error',
          text: res.error || 'Failed to update registration number.',
        });
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'Error updating registration number.',
      });
    } finally {
      setIsUpdatingReg(false);
    }
  };

  // Group counts per college for quick filter pills
  const collegeCountMap = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach((s) => {
      if (s.college_id) {
        map.set(s.college_id, (map.get(s.college_id) || 0) + 1);
      }
    });
    return map;
  }, [students]);

  // Colleges with at least 1 student
  const activeCollegesWithStudents = useMemo(() => {
    return allColleges.filter((c) => (collegeCountMap.get(c.id) || 0) > 0);
  }, [allColleges, collegeCountMap]);

  // Refresh students list from server
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setMessage(null);
    try {
      const res = await getSignedUpStudentsAction(
        isSuperAdmin ? (selectedCollegeId === 'ALL' ? undefined : selectedCollegeId) : activeCollegeId
      );
      if (res.success && res.students) {
        setStudents(res.students);
        setMessage({
          type: 'success',
          text: `Student list refreshed. Total ${res.students.length} student account(s) loaded.`,
        });
      } else {
        setMessage({
          type: 'error',
          text: res.error || 'Failed to refresh student list.',
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error connecting to database.' });
    } finally {
      setIsRefreshing(false);
    }
  }, [isSuperAdmin, selectedCollegeId, activeCollegeId]);

  // Toggle student activation status
  const handleToggleStatus = (student: AdminStudentItem) => {
    setTogglingStudent(student);
    const newStatus = !student.is_active;

    startTransition(async () => {
      try {
        const res = await toggleStudentStatusAction(student.id, newStatus);
        if (res.success) {
          setStudents((prev) =>
            prev.map((s) => (s.id === student.id ? { ...s, is_active: newStatus } : s))
          );
          setMessage({
            type: 'success',
            text: `Student account for ${student.email} has been ${newStatus ? 'activated' : 'deactivated'}.`,
          });
        } else {
          setMessage({
            type: 'error',
            text: res.error || 'Failed to update student account status.',
          });
        }
      } catch {
        setMessage({ type: 'error', text: 'Error executing account update.' });
      } finally {
        setTogglingStudent(null);
      }
    });
  };

  // Copy email or reg number to clipboard
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export filtered students list as CSV
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) return;

    const headers = [
      'Full Name',
      'Email',
      'Registration Number',
      'Institution Name',
      'Institution Code',
      'Email Verified',
      'Account Status',
      'Registered At',
    ];

    const rows = filteredStudents.map((s) => [
      `"${(s.full_name || 'N/A').replace(/"/g, '""')}"`,
      `"${s.email}"`,
      `"${s.registration_number || 'N/A'}"`,
      `"${(s.college?.name || 'N/A').replace(/"/g, '""')}"`,
      `"${s.college?.code || 'N/A'}"`,
      s.email_verified ? 'VERIFIED' : 'PENDING',
      s.is_active ? 'ACTIVE' : 'INACTIVE',
      `"${new Date(s.created_at).toLocaleString('en-IN')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `Registered_Students_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setMessage({
      type: 'success',
      text: `Exported ${filteredStudents.length} student record(s) to CSV.`,
    });
  };

  // Filtered students list
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // 1. College filter (for super admin)
      if (isSuperAdmin && selectedCollegeId !== 'ALL') {
        if (s.college_id !== selectedCollegeId) return false;
      }

      // 2. Verification filter
      if (filterVerification === 'VERIFIED' && !s.email_verified) return false;
      if (filterVerification === 'UNVERIFIED' && s.email_verified) return false;

      // 3. Status filter
      if (filterStatus === 'ACTIVE' && !s.is_active) return false;
      if (filterStatus === 'INACTIVE' && s.is_active) return false;

      // 4. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = s.full_name?.toLowerCase().includes(query) ?? false;
        const matchesEmail = s.email?.toLowerCase().includes(query) ?? false;
        const matchesReg = s.registration_number?.toLowerCase().includes(query) ?? false;
        const matchesCollegeName = s.college?.name?.toLowerCase().includes(query) ?? false;
        const matchesCollegeCode = s.college?.code?.toLowerCase().includes(query) ?? false;
        return matchesName || matchesEmail || matchesReg || matchesCollegeName || matchesCollegeCode;
      }

      return true;
    });
  }, [students, isSuperAdmin, selectedCollegeId, filterVerification, filterStatus, searchQuery]);

  // Overall Statistics for current scope
  const stats = useMemo(() => {
    const total = students.length;
    const verified = students.filter((s) => s.email_verified).length;
    const active = students.filter((s) => s.is_active).length;
    const uniqueColleges = new Set(students.map((s) => s.college_id).filter(Boolean)).size;
    const verifiedPct = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { total, verified, verifiedPct, active, uniqueColleges };
  }, [students]);

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#1a1309] p-4 sm:p-5 rounded-[3px] border border-amber-200/80 dark:border-[#382710] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[3px] bg-bce-navy text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border border-bce-navy dark:border-amber-600/50 flex items-center justify-center shrink-0 shadow-2xs font-bold">
              <GraduationCap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#faebd0] truncate">
                Signed-Up Student Directory
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#c4a97d] mt-0.5">
                {isSuperAdmin
                  ? 'All registered student accounts across Bihar Engineering colleges with verified auth status.'
                  : `Registered students enrolled under ${activeCollegeName || 'your institution'}.`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-semibold bg-white dark:bg-[#1f150c] hover:bg-slate-50 dark:hover:bg-[#281b0f] text-slate-700 dark:text-[#faebd0] border border-slate-200 dark:border-[#382710] transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh student list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredStudents.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[3px] text-xs font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV ({filteredStudents.length})</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-3.5 rounded-[3px] border text-xs flex items-center justify-between gap-2 animate-in fade-in ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Key Metric KPI Cards (4 Stat Blocks) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#1a1309] p-4 rounded-[3px] border border-amber-200/80 dark:border-[#382710] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#c4a97d] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Total Students
            </span>
            <div className="w-7 h-7 rounded-[2px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-[#faebd0] tracking-tight">
            {stats.total}
          </div>
          <span className="text-[10px] text-slate-400 dark:text-[#8f7553]">Signed-up in system</span>
        </div>

        <div className="bg-white dark:bg-[#1a1309] p-4 rounded-[3px] border border-amber-200/80 dark:border-[#382710] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#c4a97d] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Email Verified
            </span>
            <div className="w-7 h-7 rounded-[2px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight">
            {stats.verified}
          </div>
          <span className="text-[10px] text-slate-400 dark:text-[#8f7553]">
            {stats.verifiedPct}% verification rate
          </span>
        </div>

        <div className="bg-white dark:bg-[#1a1309] p-4 rounded-[3px] border border-amber-200/80 dark:border-[#382710] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#c4a97d] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Active Logins
            </span>
            <div className="w-7 h-7 rounded-[2px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-400 tracking-tight">
            {stats.active}
          </div>
          <span className="text-[10px] text-slate-400 dark:text-[#8f7553]">Permitted student accounts</span>
        </div>

        <div className="bg-white dark:bg-[#1a1309] p-4 rounded-[3px] border border-amber-200/80 dark:border-[#382710] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-[#c4a97d] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Institutions
            </span>
            <div className="w-7 h-7 rounded-[2px] bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-700 dark:text-purple-400 tracking-tight">
            {stats.uniqueColleges}
          </div>
          <span className="text-[10px] text-slate-400 dark:text-[#8f7553]">Colleges with active signups</span>
        </div>
      </div>

      {/* College Filtering Tabs (Super Admin Multi-College Switcher) */}
      {isSuperAdmin && (
        <div className="bg-white dark:bg-[#1a1309] p-4 rounded-[3px] border border-amber-200/80 dark:border-[#382710] shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-amber-500 shrink-0" />
              <label className="text-xs font-bold text-slate-800 dark:text-[#faebd0]">
                Filter by College / Institution:
              </label>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-[#c4a97d]">
              Showing students for:{' '}
              <strong className="text-slate-800 dark:text-[#faebd0]">
                {selectedCollegeId === 'ALL'
                  ? 'All Bihar Engineering Colleges'
                  : allColleges.find((c) => c.id === selectedCollegeId)?.name || 'Selected College'}
              </strong>
            </span>
          </div>

          {/* Quick College Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
            <button
              onClick={() => setSelectedCollegeId('ALL')}
              className={`px-3 py-1.5 rounded-[3px] text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCollegeId === 'ALL'
                  ? 'bg-bce-navy text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border border-bce-navy dark:border-amber-600/60 shadow-2xs font-bold'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1f150c] dark:hover:bg-[#281b0f] text-slate-700 dark:text-[#faebd0] border border-slate-200 dark:border-[#382710]'
              }`}
            >
              All Colleges ({students.length})
            </button>

            {activeCollegesWithStudents.map((col) => {
              const count = collegeCountMap.get(col.id) || 0;
              const isSelected = selectedCollegeId === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => setSelectedCollegeId(col.id)}
                  className={`px-3 py-1.5 rounded-[3px] text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-bce-navy text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border border-bce-navy dark:border-amber-600/60 shadow-2xs font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#1f150c] dark:hover:bg-[#281b0f] text-slate-700 dark:text-[#faebd0] border border-slate-200 dark:border-[#382710]'
                  }`}
                >
                  <span className="truncate max-w-[200px]">{col.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-[2px] text-[10px] font-mono ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 font-bold'
                        : 'bg-blue-100 dark:bg-[#2e1f10] text-blue-800 dark:text-amber-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Full College Selector Dropdown if admin wants any college */}
          <div className="pt-1 flex items-center gap-2">
            <select
              value={selectedCollegeId}
              onChange={(e) => setSelectedCollegeId(e.target.value)}
              className="w-full sm:max-w-md px-3 py-2 rounded-[3px] border border-slate-300 dark:border-[#382710] text-xs text-slate-800 dark:text-[#faebd0] bg-white dark:bg-[#1f150c] focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
            >
              <option value="ALL">All Colleges ({students.length} total students)</option>
              {allColleges.map((c) => {
                const count = collegeCountMap.get(c.id) || 0;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code}) — {count} student{count === 1 ? '' : 's'}
                  </option>
                );
              })}
            </select>
            {selectedCollegeId !== 'ALL' && (
              <button
                onClick={() => setSelectedCollegeId('ALL')}
                className="text-xs text-amber-600 dark:text-amber-400 hover:underline px-2 py-1 shrink-0 cursor-pointer"
              >
                Reset to All
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#1a1309] p-3.5 sm:p-4 rounded-[3px] border border-amber-200/80 dark:border-[#382710] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name, email, reg. number, or college..."
            className="w-full pl-9 pr-8 py-2 rounded-[3px] border border-slate-300 dark:border-[#382710] text-xs text-slate-800 dark:text-[#faebd0] focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-slate-50/50 dark:bg-[#1f150c]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Secondary Filter Dropdowns */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#1f150c] border border-slate-200 dark:border-[#382710] rounded-[3px] px-2 py-1">
            <Filter className="w-3 h-3 text-slate-400 shrink-0" />
            <select
              value={filterVerification}
              onChange={(e) => setFilterVerification(e.target.value as any)}
              className="text-xs text-slate-700 dark:text-[#faebd0] bg-transparent border-none focus:outline-hidden font-medium py-1"
            >
              <option value="ALL">All Verification</option>
              <option value="VERIFIED">Verified Only</option>
              <option value="UNVERIFIED">Unverified Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#1f150c] border border-slate-200 dark:border-[#382710] rounded-[3px] px-2 py-1">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="text-xs text-slate-700 dark:text-[#faebd0] bg-transparent border-none focus:outline-hidden font-medium py-1"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Accounts</option>
              <option value="INACTIVE">Inactive Accounts</option>
            </select>
          </div>
        </div>
      </div>      {/* Main Students List Container - Exam Pad Pinned Roster Board */}
      <PinnedRosterBoard
        title={`Signed-Up Students (${filteredStudents.length})`}
        subtitle={`${filteredStudents.length} of ${students.length} student accounts registered`}
        badge="Official Roster"
        icon={<GraduationCap className="w-4 h-4 text-amber-500" />}
      >
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-white dark:bg-[#1a1309]">
            <div className="w-12 h-12 rounded-[3px] bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-800 dark:text-[#faebd0]">No student accounts found</div>
            <p className="text-xs text-slate-500 dark:text-[#c4a97d] max-w-sm mx-auto">
              {searchQuery || filterVerification !== 'ALL' || filterStatus !== 'ALL' || selectedCollegeId !== 'ALL'
                ? 'No student accounts match the selected filters. Try clearing your search or filters.'
                : 'No student accounts have signed up yet.'}
            </p>
            {(searchQuery || filterVerification !== 'ALL' || filterStatus !== 'ALL' || selectedCollegeId !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterVerification('ALL');
                  setFilterStatus('ALL');
                  setSelectedCollegeId('ALL');
                }}
                className="px-3.5 py-1.5 rounded-[3px] text-xs font-semibold text-amber-900 dark:text-amber-300 bg-amber-100 hover:bg-amber-200 dark:bg-[#2e1f10] dark:hover:bg-[#3d2915] transition-colors inline-block cursor-pointer border border-amber-200 dark:border-amber-700/50"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto min-w-0 bg-white dark:bg-[#1a1309]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/90 dark:bg-[#1f150c] text-slate-700 dark:text-[#c4a97d] font-semibold border-b border-slate-200/80 dark:border-[#382713] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Email & Verification</th>
                    <th className="px-4 py-3">Enrolled College</th>
                    <th className="px-4 py-3">Reg. Number</th>
                    <th className="px-4 py-3">Joined On</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#382713] text-slate-700 dark:text-[#faebd0]">
                  {filteredStudents.map((student) => {
                    const isToggling = isPending && togglingStudent?.id === student.id;
                    const initialChar = (student.full_name || student.email || 'S')
                      .trim()
                      .charAt(0)
                      .toUpperCase();

                    return (
                      <tr key={student.id} className="hover:bg-amber-50/30 dark:hover:bg-[#281b0f]/50 transition-colors">
                        {/* Student Name & Avatar */}
                        <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-[#faebd0]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-[3px] bg-bce-navy text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border border-bce-navy dark:border-amber-600/50 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                              {initialChar}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900 dark:text-[#faebd0] block truncate max-w-[160px]">
                                {student.full_name || 'Registered Student'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Email & Verified Badge */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-slate-800 dark:text-[#faebd0]">
                              {student.email}
                            </span>
                            <button
                              onClick={() => handleCopy(student.email, `email-${student.id}`)}
                              className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 p-0.5 rounded-[2px] cursor-pointer transition-colors"
                              title="Copy email"
                            >
                              {copiedId === `email-${student.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="mt-1">
                            {student.email_verified ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900">
                                Pending Verification
                              </span>
                            )}
                          </div>
                        </td>

                        {/* College / Institution */}
                        <td className="px-4 py-3.5">
                          {student.college ? (
                            <div className="space-y-0.5 max-w-[220px]">
                              <span className="font-semibold text-slate-800 dark:text-[#faebd0] text-xs block truncate" title={student.college.name}>
                                {student.college.name}
                              </span>
                              <span className="inline-block px-1.5 py-0.2 rounded-[2px] text-[10px] font-mono bg-blue-50 dark:bg-[#281b0f] text-blue-700 dark:text-amber-300 border border-blue-200/50 dark:border-amber-700/50">
                                Code: {student.college.code}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-[#8f7553] italic">Not Assigned</span>
                          )}
                        </td>

                        {/* Registration Number */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {student.registration_number ? (
                              <span className="font-mono font-semibold text-xs text-slate-800 dark:text-[#faebd0] bg-slate-100 dark:bg-[#281b0f] px-2 py-0.5 rounded-[2px] border border-slate-200 dark:border-[#382710]">
                                {student.registration_number}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-[#8f7553] text-[11px] italic">Not Set</span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRegStudent(student);
                                setRegInput(student.registration_number || '');
                              }}
                              className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 p-1 rounded-[2px] transition-colors cursor-pointer"
                              title="Edit registration number"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Joined On */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-[#c4a97d]">
                          <div>{formatDateShort(student.created_at, hydrated)}</div>
                          <div className="text-[10px] text-slate-400 dark:text-[#8f7553]">
                            {formatTime(student.created_at, hydrated)}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {student.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                              INACTIVE
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(student)}
                            disabled={isToggling}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                              student.is_active
                                ? 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                            }`}
                          >
                            {isToggling ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : student.is_active ? (
                              <UserX className="w-3.5 h-3.5 text-rose-600" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            <span>{student.is_active ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-[#382713] min-w-0 bg-white dark:bg-[#1a1309]">
              {filteredStudents.map((student) => {
                const isToggling = isPending && togglingStudent?.id === student.id;
                const initialChar = (student.full_name || student.email || 'S')
                  .trim()
                  .charAt(0)
                  .toUpperCase();

                return (
                  <div key={student.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-[3px] bg-bce-navy text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border border-bce-navy dark:border-amber-600/50 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {initialChar}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-[#faebd0] text-sm block">
                            {student.full_name || 'Registered Student'}
                          </span>
                          <span className="font-mono text-xs text-slate-600 dark:text-[#c4a97d] block">
                            {student.email}
                          </span>
                        </div>
                      </div>

                      <div>
                        {student.is_active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                            INACTIVE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* College & Reg info */}
                    <div className="p-2.5 bg-slate-50 dark:bg-[#1f150c] rounded-[3px] border border-slate-200/80 dark:border-[#382710] text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-600 dark:text-[#c4a97d]">
                        <span className="text-[11px] text-slate-500 dark:text-[#8f7553]">Institution:</span>
                        <span className="font-semibold text-slate-800 dark:text-[#faebd0] text-right truncate max-w-[200px]">
                          {student.college ? `${student.college.name} (${student.college.code})` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-[#c4a97d]">
                        <span className="text-[11px] text-slate-500 dark:text-[#8f7553]">Registration:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-slate-800 dark:text-[#faebd0]">
                            {student.registration_number || 'Not Set'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRegStudent(student);
                              setRegInput(student.registration_number || '');
                            }}
                            className="text-amber-600 dark:text-amber-400 p-0.5 cursor-pointer"
                            title="Edit registration number"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-[#c4a97d]">
                        <span className="text-[11px] text-slate-500 dark:text-[#8f7553]">Email Status:</span>
                        <span>
                          {student.email_verified ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">✓ Verified</span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400 font-semibold">Pending Verification</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-400 dark:text-[#8f7553]">
                        Joined: {formatDateShort(student.created_at, hydrated)}
                      </span>

                      <button
                        onClick={() => handleToggleStatus(student)}
                        disabled={isToggling}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-[3px] text-xs font-semibold cursor-pointer ${
                          student.is_active
                            ? 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                        }`}
                      >
                        {isToggling ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : student.is_active ? (
                          <UserX className="w-3.5 h-3.5 text-rose-600" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>{student.is_active ? 'Deactivate' : 'Activate'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </PinnedRosterBoard>

      {/* Admin Edit Student Registration Number Modal */}
      {editingRegStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUpdatingReg) setEditingRegStudent(null);
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-[#1a1309] rounded-[3px] shadow-2xl border border-amber-200/80 dark:border-[#382710] overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#382713] flex items-center justify-between bg-slate-50 dark:bg-[#1f150c]">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-[#faebd0] text-sm">
                  Update Registration Number
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRegStudent(null)}
                disabled={isUpdatingReg}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-[2px]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRegNumber} className="p-5 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-[#faebd0]">
                  {editingRegStudent.full_name || 'Student'}
                </p>
                <p className="text-[11px] font-mono text-slate-500 dark:text-[#c4a97d]">
                  {editingRegStudent.email}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-[#faebd0] block">
                  Registration Number
                </label>
                <input
                  type="text"
                  value={regInput}
                  onChange={(e) => setRegInput(e.target.value)}
                  placeholder="e.g. 20108108001"
                  maxLength={50}
                  autoFocus
                  disabled={isUpdatingReg}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-[#382710] focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-[3px] text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-[#faebd0] bg-white dark:bg-[#1f150c] outline-hidden"
                />
                <p className="text-[10px] text-slate-400 dark:text-[#8f7553]">
                  Leave blank to reset to &ldquo;Not Set&rdquo;.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-[#382713]">
                <button
                  type="button"
                  onClick={() => setEditingRegStudent(null)}
                  disabled={isUpdatingReg}
                  className="px-3.5 py-2 rounded-[3px] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#281b0f] border border-slate-200 dark:border-[#382710]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingReg}
                  className="px-4 py-2 rounded-[3px] text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs"
                >
                  {isUpdatingReg ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Number</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
