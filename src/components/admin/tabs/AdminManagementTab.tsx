'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveAdminRequestAction,
  rejectAdminRequestAction,
  revokeAdminAccessAction,
  reactivateAdminAccessAction,
  promoteAdminToSuperAdminAction,
  demoteSuperAdminToAdminAction,
  updateAdminRoleAction,
} from '@/app/admin/actions';
import {
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Check,
  X,
  Clock,
  AlertCircle,
  Loader2,
  Building2,
  ShieldPlus,
  Sparkles,
  GraduationCap,
  FolderSync,
  Calendar,
  BookOpen,
  ClipboardCheck,
  Crown,
  Shield,
  ShieldQuestion,
  UserCog,
  Phone,
  FileText,
  Hash,
  Eye,
} from 'lucide-react';
import type { Admin, AdminRequest } from '@/types/database';
import { useHydrated, formatDateShort, formatTime } from '@/lib/hooks/use-hydrated';
import { isPrimarySuperAdmin } from '@/lib/auth/admin-auth-shared';
import { AdminSessionsCard } from '../AdminSessionsCard';
import { SignedUpStudentsSection } from './SignedUpStudentsSection';
import { GoogleFormEditorsManagementSection } from './GoogleFormEditorsManagementSection';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';
import type { AdminStudentItem } from '@/app/admin/actions';

interface Props {
  adminRequests: AdminRequest[];
  adminsList: Admin[];
  isSuperAdmin: boolean;
  isPrimaryAdmin?: boolean;
  currentUserRole?: string;
  currentUserEmail: string;
  initialSubTab?: string;
  initialStudents?: AdminStudentItem[];
  allColleges?: Array<{ id: string; name: string; code: string; slug: string }>;
  activeCollegeId?: string;
  activeCollegeName?: string;
}

export const ADMIN_ROLE_CONFIGS: Record<
  string,
  { label: string; badge: string; color: string; desc: string; icon: any }
> = {
  SUPER_ADMIN: {
    label: 'Platform Super Admin',
    badge: 'Universal Access',
    color: 'bg-amber-100 text-amber-900 border-amber-300',
    desc: 'Full universal access across all colleges and tenant institutions.',
    icon: ShieldCheck,
  },
  PRIMARY_ADMIN: {
    label: 'Primary College Admin',
    badge: 'Lead Admin (Controls Roles)',
    color: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    desc: 'Institutional lead. Full college control and controls other admin roles.',
    icon: Crown,
  },
  EVENT_COORDINATOR: {
    label: 'Event Coordinator',
    badge: 'Events Only',
    color: 'bg-purple-100 text-purple-900 border-purple-300',
    desc: 'Restricted access: Events, Competitions & Entry Passes tab only.',
    icon: Calendar,
  },
  LIBRARIAN: {
    label: 'Librarian',
    badge: 'Library Only',
    color: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    desc: 'Restricted access: Library books, borrow requests, timings & fines only.',
    icon: BookOpen,
  },
  FEEDBACK_EXAM_COORDINATOR: {
    label: 'Feedback & Exam Coordinator',
    badge: 'Feedback + Exams',
    color: 'bg-sky-100 text-sky-900 border-sky-300',
    desc: 'Restricted access: Student feedback forms, academic surveys & exams.',
    icon: ClipboardCheck,
  },
  COLLEGE_ADMIN: {
    label: 'College Admin',
    badge: 'College Admin',
    color: 'bg-blue-100 text-blue-900 border-blue-300',
    desc: 'Standard administrator with full institutional dashboard access.',
    icon: Building2,
  },
};

export function AdminManagementTab({
  adminRequests,
  adminsList,
  isSuperAdmin,
  isPrimaryAdmin = false,
  currentUserRole = 'COLLEGE_ADMIN',
  currentUserEmail,
  initialSubTab,
  initialStudents = [],
  allColleges = [],
  activeCollegeId,
  activeCollegeName,
}: Props) {
  const hydrated = useHydrated();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [admins, setAdmins] = useState<Admin[]>(adminsList);
  const [requests, setRequests] = useState<AdminRequest[]>(adminRequests);
  const [selectedSubTab, setSelectedSubTab] = useState<'admins' | 'students' | 'editors'>(
    initialSubTab === 'students' ? 'students' : initialSubTab === 'editors' ? 'editors' : 'admins'
  );
  const [subTab, setSubTab] = useState<'admins' | 'students' | 'editors'>(
    initialSubTab === 'students' ? 'students' : initialSubTab === 'editors' ? 'editors' : 'admins'
  );
  const [isSubTabPending, startSubTabTransition] = useTransition();

  const canControlRoles = isSuperAdmin || isPrimaryAdmin;

  useEffect(() => {
    if (initialSubTab === 'students' || initialSubTab === 'admins' || initialSubTab === 'editors') {
      setSelectedSubTab(initialSubTab);
      startSubTabTransition(() => {
        setSubTab(initialSubTab);
      });
    }
  }, [initialSubTab]);

  const handleSubTabChange = (tab: 'admins' | 'students' | 'editors') => {
    setSelectedSubTab(tab);
    startSubTabTransition(() => {
      setSubTab(tab);
    });
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'admins');
      url.searchParams.set('subtab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  };

  useEffect(() => {
    setAdmins(adminsList);
  }, [adminsList]);

  useEffect(() => {
    setRequests(adminRequests);
  }, [adminRequests]);

  const [activeAction, setActiveAction] = useState<{
    id: string;
    type: 'APPROVE' | 'REJECT' | 'REVOKE' | 'REACTIVATE' | 'PROMOTE' | 'DEMOTE' | 'UPDATE_ROLE';
  } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals for deliberate Admin confirmation
  const [revokingAdmin, setRevokingAdmin] = useState<Admin | null>(null);
  const [reactivatingAdmin, setReactivatingAdmin] = useState<Admin | null>(null);
  const [promotingAdmin, setPromotingAdmin] = useState<Admin | null>(null);
  const [demotingAdmin, setDemotingAdmin] = useState<Admin | null>(null);
  const [changingRoleAdmin, setChangingRoleAdmin] = useState<Admin | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<string>('COLLEGE_ADMIN');
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [viewingRequestDetails, setViewingRequestDetails] = useState<AdminRequest | null>(null);

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const pastRequests = requests.filter((r) => r.status !== 'PENDING');

  const confirmPromoteAdmin = () => {
    if (!promotingAdmin) return;
    const targetId = promotingAdmin.user_id || promotingAdmin.id;
    const email = promotingAdmin.email;
    const name = promotingAdmin.name;
    setActiveAction({ id: promotingAdmin.id, type: 'PROMOTE' });
    setMessage(null);

    startTransition(async () => {
      try {
        const res = await promoteAdminToSuperAdminAction(targetId);
        if (res.success) {
          // Immediately update local state without requiring manual refresh
          setAdmins((prev) =>
            prev.map((a) =>
              a.id === promotingAdmin.id || a.user_id === targetId
                ? { ...a, role: 'SUPER_ADMIN' }
                : a
            )
          );
          setMessage({
            type: 'success',
            text: `Successfully promoted ${name} (${email}) to Platform Super Admin.`,
          });
          router.refresh();
        } else {
          setMessage({
            type: 'error',
            text: res.error || 'Failed to promote administrator to Super Admin.',
          });
        }
      } catch (err: any) {
        setMessage({
          type: 'error',
          text: err.message || 'An unexpected error occurred during promotion.',
        });
      } finally {
        setActiveAction(null);
        setPromotingAdmin(null);
      }
    });
  };

  const confirmDemoteAdmin = () => {
    if (!demotingAdmin) return;
    const targetId = demotingAdmin.user_id || demotingAdmin.id;
    const email = demotingAdmin.email;
    const name = demotingAdmin.name;
    setActiveAction({ id: demotingAdmin.id, type: 'DEMOTE' });
    setMessage(null);

    startTransition(async () => {
      try {
        const res = await demoteSuperAdminToAdminAction(targetId);
        if (res.success) {
          // Immediately update local state without requiring manual refresh
          setAdmins((prev) =>
            prev.map((a) =>
              a.id === demotingAdmin.id || a.user_id === targetId
                ? { ...a, role: 'ADMIN' }
                : a
            )
          );
          setMessage({
            type: 'success',
            text: `Super Admin privileges removed for ${name} (${email}). Reverted to Admin.`,
          });
          router.refresh();
        } else {
          setMessage({
            type: 'error',
            text: res.error || 'Failed to demote administrator.',
          });
        }
      } catch (err: any) {
        setMessage({
          type: 'error',
          text: err.message || 'An unexpected error occurred during demotion.',
        });
      } finally {
        setActiveAction(null);
        setDemotingAdmin(null);
      }
    });
  };

  const handleApprove = (requestId: string, assignedRole?: string) => {
    setActiveAction({ id: requestId, type: 'APPROVE' });
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await approveAdminRequestAction(requestId, assignedRole);
        if (res.success) {
          const approvedReq = requests.find((r) => r.id === requestId);
          setRequests((prev) =>
            prev.map((r) => (r.id === requestId ? { ...r, status: 'APPROVED' } : r))
          );
          if (approvedReq) {
            const finalRole = assignedRole || approvedReq.requested_role || 'COLLEGE_ADMIN';
            setAdmins((prev) => {
              const exists = prev.some((a) => a.email.toLowerCase() === approvedReq.email.toLowerCase());
              if (exists) return prev;
              return [
                ...prev,
                {
                  id: approvedReq.id,
                  user_id: approvedReq.user_id || approvedReq.id,
                  email: approvedReq.email,
                  name: approvedReq.name,
                  role: finalRole as any,
                  status: 'ACTIVE',
                  created_at: new Date().toISOString(),
                  college_id: approvedReq.college_id,
                  college: approvedReq.college,
                } as Admin,
              ];
            });
          }
          setMessage({
            type: 'success',
            text: `Admin request approved successfully with role: ${
              ADMIN_ROLE_CONFIGS[assignedRole || '']?.label || assignedRole || 'College Admin'
            }.`,
          });
          router.refresh();
        } else {
          setMessage({ type: 'error', text: res.error || 'Failed to approve request.' });
        }
      } catch (err: any) {
        setMessage({
          type: 'error',
          text: err.message || 'An unexpected error occurred during approval.',
        });
      } finally {
        setActiveAction(null);
      }
    });
  };

  const confirmChangeRole = () => {
    if (!changingRoleAdmin) return;
    const targetId = changingRoleAdmin.id;
    const targetName = changingRoleAdmin.name;
    const newRole = selectedNewRole;
    setActiveAction({ id: targetId, type: 'UPDATE_ROLE' });
    setMessage(null);

    startTransition(async () => {
      try {
        const res = await updateAdminRoleAction(targetId, newRole);
        if (res.success) {
          setAdmins((prev) =>
            prev.map((a) =>
              a.id === targetId || a.user_id === targetId ? { ...a, role: newRole as any } : a
            )
          );
          setMessage({
            type: 'success',
            text: `Successfully updated ${targetName}'s role to ${
              ADMIN_ROLE_CONFIGS[newRole]?.label || newRole
            }.`,
          });
          router.refresh();
        } else {
          setMessage({
            type: 'error',
            text: res.error || 'Failed to update administrator role.',
          });
        }
      } catch (err: any) {
        setMessage({
          type: 'error',
          text: err.message || 'An unexpected error occurred during role update.',
        });
      } finally {
        setActiveAction(null);
        setChangingRoleAdmin(null);
      }
    });
  };

  const handleReject = (requestId: string) => {
    if (!confirm('Are you sure you want to reject this admin request?')) return;
    setActiveAction({ id: requestId, type: 'REJECT' });
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await rejectAdminRequestAction(requestId);
        if (res.success) {
          setRequests((prev) =>
            prev.map((r) => (r.id === requestId ? { ...r, status: 'REJECTED' } : r))
          );
          setMessage({ type: 'success', text: 'Admin request rejected.' });
          router.refresh();
        } else {
          setMessage({ type: 'error', text: res.error || 'Failed to reject request.' });
        }
      } catch (err: any) {
        setMessage({
          type: 'error',
          text: err.message || 'An unexpected error occurred during rejection.',
        });
      } finally {
        setActiveAction(null);
      }
    });
  };

  const confirmRevokeAccess = () => {
    if (!revokingAdmin) return;
    const targetId = revokingAdmin.id;
    const email = revokingAdmin.email;
    setActiveAction({ id: targetId, type: 'REVOKE' });
    setMessage(null);

    startTransition(async () => {
      try {
        const res = await revokeAdminAccessAction(targetId, revokeReason.trim() || undefined);
        if (res.success) {
          setMessage({
            type: 'success',
            text: `Administrator access for ${email} has been revoked. The account is now INACTIVE.`,
          });
        } else {
          setMessage({ type: 'error', text: res.error || 'Failed to revoke administrator access.' });
        }
      } finally {
        setActiveAction(null);
        setRevokingAdmin(null);
        setRevokeReason('');
      }
    });
  };

  const confirmReactivateAccess = () => {
    if (!reactivatingAdmin) return;
    const targetId = reactivatingAdmin.id;
    const email = reactivatingAdmin.email;
    setActiveAction({ id: targetId, type: 'REACTIVATE' });
    setMessage(null);

    startTransition(async () => {
      try {
        const res = await reactivateAdminAccessAction(targetId);
        if (res.success) {
          setMessage({
            type: 'success',
            text: `Administrator access for ${email} has been restored. The account is now ACTIVE.`,
          });
        } else {
          setMessage({ type: 'error', text: res.error || 'Failed to reactivate administrator access.' });
        }
      } finally {
        setActiveAction(null);
        setReactivatingAdmin(null);
      }
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Subtab Navigation (Admin Privileges vs Signed-Up Students) */}
      <div className="flex items-center gap-2 border-b border-amber-200/80 dark:border-[#382710] pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => handleSubTabChange('admins')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[3px] text-xs sm:text-sm font-semibold transition-all cursor-pointer border ${
            selectedSubTab === 'admins'
              ? 'bg-bce-navy text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border-bce-navy dark:border-amber-600/60 shadow-xs font-bold'
              : 'bg-white dark:bg-[#1a1309] text-slate-700 dark:text-[#faebd0] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#281b0f] border-amber-200/80 dark:border-[#382710]'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <span>Administrators & Requests</span>
          {pendingRequests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-[2px] text-[10px] font-bold bg-amber-500 text-slate-950 font-mono">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSubTabChange('students')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[3px] text-xs sm:text-sm font-semibold transition-all cursor-pointer border ${
            selectedSubTab === 'students'
              ? 'bg-bce-navy text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border-bce-navy dark:border-amber-600/60 shadow-xs font-bold'
              : 'bg-white dark:bg-[#1a1309] text-slate-700 dark:text-[#faebd0] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#281b0f] border-amber-200/80 dark:border-[#382710]'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-amber-500" />
          <span>Signed-Up Students</span>
          <span
            className={`px-2 py-0.5 rounded-[2px] text-[10px] font-mono font-bold ${
              selectedSubTab === 'students' ? 'bg-amber-400 text-slate-950' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
            }`}
          >
            {initialStudents?.length ?? 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSubTabChange('editors')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-[3px] text-xs sm:text-sm font-semibold transition-all cursor-pointer border ${
            selectedSubTab === 'editors'
              ? 'bg-bce-navy text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border-bce-navy dark:border-amber-600/60 shadow-xs font-bold'
              : 'bg-white dark:bg-[#1a1309] text-slate-700 dark:text-[#faebd0] hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#281b0f] border-amber-200/80 dark:border-[#382710]'
          }`}
        >
          <FolderSync className="w-4 h-4 text-amber-500" />
          <span>Google Form Editors</span>
        </button>
      </div>

      <div className={`transition-opacity duration-150 ${isSubTabPending ? 'opacity-75 pointer-events-none' : 'opacity-100'}`}>
      {subTab === 'students' ? (
        <SignedUpStudentsSection
          initialStudents={initialStudents}
          allColleges={allColleges}
          isSuperAdmin={isSuperAdmin}
          activeCollegeId={activeCollegeId}
          activeCollegeName={activeCollegeName}
        />
      ) : subTab === 'editors' ? (
        <GoogleFormEditorsManagementSection
          activeCollegeId={activeCollegeId}
          activeCollegeName={activeCollegeName}
          isSuperAdmin={isSuperAdmin}
        />
      ) : (
        <>
          {/* Header Banner */}
          <ExamPadCard
            variant="dashboard"
            title="Administrator Access & Authorization"
            subtitle="Manage admin registration requests, role privileges, and account activation states across your institution."
            badge={isSuperAdmin ? "SUPER ADMIN ACCESS" : "CAMPUS ADMIN"}
            clipLabel={isSuperAdmin ? "SUPER ADMIN ACCESS" : "CAMPUS ADMIN"}
            icon={<ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          />

      {message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Active Device & Platform Sessions */}
      <AdminSessionsCard />

      {/* 1. PENDING REQUESTS TABLE */}
      <PinnedRosterBoard
        title="Pending Admin Requests"
        subtitle="Awaiting administrative review & role authorization"
        badge={`${pendingRequests.length} PENDING`}
        icon={<Clock className="w-4 h-4 text-amber-500" />}
      >
        {pendingRequests.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 dark:text-[#a08862]">
            No pending admin registration requests at this time.
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-[#2a1d0f] min-w-0">
              {pendingRequests.map((req) => {
                const isApproving = isPending && activeAction?.id === req.id && activeAction.type === 'APPROVE';
                const isRejecting = isPending && activeAction?.id === req.id && activeAction.type === 'REJECT';
                const roleKey = req.requested_role || 'COLLEGE_ADMIN';
                const roleCfg = ADMIN_ROLE_CONFIGS[roleKey] || ADMIN_ROLE_CONFIGS.COLLEGE_ADMIN;
                const RoleIcon = roleCfg.icon;

                return (
                  <div key={req.id} className="p-4 space-y-2.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-slate-800 truncate">{req.name}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                        PENDING
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${roleCfg.color}`}>
                        <RoleIcon className="w-3 h-3" />
                        Role: {roleCfg.label}
                      </span>
                    </div>

                    {req.college && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50/80 px-2.5 py-1 rounded-md border border-amber-200/60">
                        <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-medium truncate">{req.college.name}</span>
                        <span className="text-[10px] text-amber-700 font-mono">({req.college.code})</span>
                      </div>
                    )}

                    {/* Coordinator Details Card on Mobile */}
                    {(req.branch || req.semester || req.phone || req.roll_number || req.event_description) && (
                      <div className="p-2.5 bg-purple-50/60 rounded-xl border border-purple-200/60 text-xs space-y-1">
                        {req.phone && (
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-purple-600" /> Mobile:
                            </span>
                            <a href={`tel:${req.phone}`} className="font-mono font-bold text-purple-900 hover:underline">
                              {req.phone}
                            </a>
                          </div>
                        )}
                        {(req.branch || req.semester) && (
                          <div className="flex justify-between items-center text-slate-600">
                            <span className="flex items-center gap-1">
                              <GraduationCap className="w-3 h-3 text-purple-600" /> Branch &amp; Sem:
                            </span>
                            <span className="font-semibold text-purple-950 truncate max-w-[170px]" title={req.branch || ''}>
                              {req.branch} {req.semester ? `(${req.semester})` : ''}
                            </span>
                          </div>
                        )}
                        {(req.roll_number || req.registration_number) && (
                          <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono">
                            <span>Roll / Reg:</span>
                            <span>{req.roll_number || '—'} / {req.registration_number || '—'}</span>
                          </div>
                        )}
                        {req.academic_session && (
                          <div className="flex justify-between items-center text-[11px] text-slate-500">
                            <span>Session:</span>
                            <span className="font-semibold text-slate-700">{req.academic_session}</span>
                          </div>
                        )}
                        {req.event_description && (
                          <div className="pt-1 border-t border-purple-200/50 text-[11px] text-slate-700">
                            <span className="font-bold text-purple-900">Event Statement: </span>
                            <span className="line-clamp-2">{req.event_description}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-xs font-mono text-slate-600 break-all">
                      {req.email}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Requested: {formatDateShort(req.created_at, hydrated)} at {formatTime(req.created_at, hydrated)}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setViewingRequestDetails(req)}
                        className="px-3 py-2 rounded-[3px] bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-800 dark:text-purple-300 font-semibold text-xs transition-colors border border-purple-200 dark:border-purple-800 cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>
                      <button
                        onClick={() => handleApprove(req.id, req.requested_role || 'COLLEGE_ADMIN')}
                        disabled={isPending}
                        aria-busy={isApproving}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-[3px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 min-h-[40px] cursor-pointer"
                      >
                        {isApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>{isApproving ? 'Approving...' : `Approve`}</span>
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={isPending}
                        aria-busy={isRejecting}
                        className="px-3 py-2 rounded-[3px] bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 min-h-[40px] cursor-pointer"
                      >
                        {isRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#20150b] text-slate-600 dark:text-[#c4a97d] font-semibold border-b border-slate-100 dark:border-[#382710] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Applicant Name</th>
                    <th className="px-5 py-3">Institution</th>
                    <th className="px-5 py-3">Requested Role</th>
                    <th className="px-5 py-3">Contact &amp; Email</th>
                    <th className="px-5 py-3">Request Date</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2a1d0f]">
                  {pendingRequests.map((req) => {
                    const isApproving = isPending && activeAction?.id === req.id && activeAction.type === 'APPROVE';
                    const isRejecting = isPending && activeAction?.id === req.id && activeAction.type === 'REJECT';
                    const roleKey = req.requested_role || 'COLLEGE_ADMIN';
                    const roleCfg = ADMIN_ROLE_CONFIGS[roleKey] || ADMIN_ROLE_CONFIGS.COLLEGE_ADMIN;
                    const RoleIcon = roleCfg.icon;

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/80 dark:hover:bg-[#22170d]/80 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-[#faebd0]">
                          <div className="flex flex-col min-w-0">
                            <span className="truncate">{req.name}</span>
                            {(req.branch || req.semester) && (
                              <div className="flex items-center gap-1 flex-wrap mt-1">
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-[2px] border border-purple-200/60 dark:border-purple-800/60 max-w-[200px] truncate"
                                  title={`${req.branch} • ${req.semester}`}
                                >
                                  <GraduationCap className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                                  {req.branch} {req.semester ? `• ${req.semester}` : ''}
                                </span>
                              </div>
                            )}
                            {(req.roll_number || req.registration_number) && (
                              <span className="text-[10px] text-slate-500 dark:text-[#a08862] font-mono mt-0.5">
                                {req.roll_number ? `Roll: ${req.roll_number}` : ''}
                                {req.roll_number && req.registration_number ? ' | ' : ''}
                                {req.registration_number ? `Reg: ${req.registration_number}` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {req.college ? (
                            <div className="flex items-center gap-1.5 max-w-[220px]">
                              <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-slate-800 dark:text-[#faebd0] truncate" title={req.college.name}>
                                  {req.college.name}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-[#a08862] font-mono">
                                  {req.college.code}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-[#8f754c] italic text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[2px] text-[11px] font-bold border ${roleCfg.color}`}>
                            <RoleIcon className="w-3.5 h-3.5" />
                            {roleCfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-mono text-slate-600 dark:text-[#c4a97d]">{req.email}</div>
                          {req.phone && (
                            <div className="text-[11px] font-mono text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                              <a href={`tel:${req.phone}`} className="hover:underline">
                                {req.phone}
                              </a>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 dark:text-[#a08862]">
                          {formatDateShort(req.created_at, hydrated)} at{' '}
                          {formatTime(req.created_at, hydrated)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[2px] text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60 font-mono">
                            PENDING
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {/* View Application Details Button */}
                          <button
                            type="button"
                            onClick={() => setViewingRequestDetails(req)}
                            title="View Coordinator Details & Statement"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-semibold transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                          <button
                            onClick={() => handleApprove(req.id, req.requested_role || 'COLLEGE_ADMIN')}
                            disabled={isPending}
                            aria-busy={isApproving}
                            title={`Approve as ${roleCfg.label}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {isApproving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>{isApproving ? 'Approving...' : 'Approve'}</span>
                          </button>

                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={isPending}
                            aria-busy={isRejecting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {isRejecting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <X className="w-3.5 h-3.5" />
                            )}
                            <span>{isRejecting ? 'Rejecting...' : 'Reject'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PinnedRosterBoard>

      {/* 2. REGISTERED ADMINISTRATORS DIRECTORY */}
      <PinnedRosterBoard
        title="Authorized Administrators"
        subtitle="Active & inactive administrative credentials across colleges"
        badge={`${admins.length} ACCOUNTS`}
        icon={<UserCheck className="w-4 h-4 text-amber-500" />}
      >
        {admins.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 dark:text-[#a08862]">
            No administrator accounts configured yet.
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-[#2a1d0f] min-w-0">
              {admins.map((admin) => {
                const isOperating = isPending && activeAction?.id === admin.id;
                const isPrimary = isPrimarySuperAdmin({ email: admin.email, user_id: admin.user_id, id: admin.id });
                const isSelf = admin.email.toLowerCase() === currentUserEmail.toLowerCase();

                return (
                  <div key={admin.id} className="p-4 space-y-2.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-sm text-slate-800 truncate block">
                          {admin.name}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] text-bce-cobalt font-semibold bg-blue-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                            (Your Current Session)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {admin.role === 'SUPER_ADMIN' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <ShieldCheck className="w-3 h-3" /> SUPER ADMIN
                          </span>
                        ) : (
                          (() => {
                            const roleKey = admin.role || 'COLLEGE_ADMIN';
                            const roleCfg = ADMIN_ROLE_CONFIGS[roleKey] || ADMIN_ROLE_CONFIGS.COLLEGE_ADMIN;
                            const RoleIcon = roleCfg.icon;
                            return (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleCfg.color}`}>
                                <RoleIcon className="w-3 h-3" />
                                {roleCfg.badge}
                              </span>
                            );
                          })()
                        )}
                        {admin.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                            REVOKED
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs font-mono text-slate-600 break-all">
                      {admin.email}
                    </div>

                    {admin.role === 'SUPER_ADMIN' ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50/80 px-2 py-1 rounded-md border border-amber-200/50">
                        <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-semibold text-amber-900">All Institutions (Platform Super Admin)</span>
                      </div>
                    ) : admin.college ? (
                      <div className="flex items-center gap-1.5 text-xs text-blue-900 bg-blue-50/80 px-2 py-1 rounded-md border border-blue-200/50">
                        <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">{admin.college.name}</span>
                        <span className="text-[10px] text-blue-700 font-mono">({admin.college.code})</span>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <span className="text-[11px] text-slate-400">
                        Added: {formatDateShort(admin.created_at, hydrated)}
                      </span>

                      {isPrimary ? (
                        <span className="text-[10px] text-amber-800 font-semibold bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded italic">
                          Primary Super Admin
                        </span>
                      ) : isSelf ? (
                        <span className="text-[10px] text-slate-400 italic">Current Session</span>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {canControlRoles && admin.role !== 'SUPER_ADMIN' && admin.status === 'ACTIVE' && (
                            <button
                              onClick={() => {
                                setChangingRoleAdmin(admin);
                                setSelectedNewRole(admin.role || 'COLLEGE_ADMIN');
                              }}
                              disabled={isOperating}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-2xs min-h-[36px] cursor-pointer"
                            >
                              <UserCog className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Role Access</span>
                            </button>
                          )}

                          {isSuperAdmin && admin.role !== 'SUPER_ADMIN' && admin.status === 'ACTIVE' && (
                            <button
                              onClick={() => setPromotingAdmin(admin)}
                              disabled={isOperating}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 shadow-2xs min-h-[36px] cursor-pointer"
                            >
                              {isOperating && activeAction?.type === 'PROMOTE' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ShieldPlus className="w-3.5 h-3.5 text-amber-600" />
                              )}
                              <span>↑ Make Super Admin</span>
                            </button>
                          )}

                          {canControlRoles && admin.role !== 'SUPER_ADMIN' && (
                            admin.status === 'ACTIVE' ? (
                              <button
                                onClick={() => {
                                  setRevokingAdmin(admin);
                                  setRevokeReason('');
                                }}
                                disabled={isOperating}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 min-h-[36px] cursor-pointer"
                              >
                                {isOperating && activeAction?.type === 'REVOKE' ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5 text-rose-600" />
                                )}
                                <span>Revoke Access</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setReactivatingAdmin(admin)}
                                disabled={isOperating}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 min-h-[36px] cursor-pointer"
                              >
                                {isOperating && activeAction?.type === 'REACTIVATE' ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                                <span>Reactivate</span>
                              </button>
                            )
                          )}

                          {isSuperAdmin && admin.role === 'SUPER_ADMIN' && (
                            <button
                              onClick={() => setDemotingAdmin(admin)}
                              disabled={isOperating}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50/80 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 min-h-[36px] cursor-pointer"
                            >
                              {isOperating && activeAction?.type === 'DEMOTE' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 hover:text-rose-600" />
                              )}
                              <span>↓ Demote to Admin</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#20150b] text-slate-600 dark:text-[#c4a97d] font-semibold border-b border-slate-100 dark:border-[#382710] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Admin Name</th>
                    <th className="px-5 py-3">Institution</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role &amp; Permissions</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Added Date</th>
                    <th className="px-5 py-3 text-right">Access Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2a1d0f]">
                  {admins.map((admin) => {
                    const isOperating = isPending && activeAction?.id === admin.id;
                    const isPrimary = isPrimarySuperAdmin({ email: admin.email, user_id: admin.user_id, id: admin.id });
                    const isSelf = admin.email.toLowerCase() === currentUserEmail.toLowerCase();
                    const roleKey = admin.role || 'COLLEGE_ADMIN';
                    const roleCfg = ADMIN_ROLE_CONFIGS[roleKey] || ADMIN_ROLE_CONFIGS.COLLEGE_ADMIN;
                    const RoleIcon = roleCfg.icon;

                    return (
                      <tr key={admin.id} className="hover:bg-slate-50/80 dark:hover:bg-[#22170d]/80 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-[#faebd0]">
                          {admin.name}
                          {isSelf && (
                            <span className="ml-2 text-[10px] text-bce-cobalt dark:text-amber-400 font-semibold bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded-[2px]">
                              (You)
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {admin.role === 'SUPER_ADMIN' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 font-semibold bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
                              <Building2 className="w-3 h-3 text-amber-500" /> All Institutions
                            </span>
                          ) : admin.college ? (
                            <div className="flex items-center gap-1.5 max-w-[220px]">
                              <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-slate-800 truncate" title={admin.college.name}>
                                  {admin.college.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {admin.college.code}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-600">
                          {admin.email}
                        </td>
                        <td className="px-5 py-3.5">
                          {admin.role === 'SUPER_ADMIN' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                              <ShieldCheck className="w-3 h-3" /> SUPER ADMIN
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleCfg.color}`}>
                              <RoleIcon className="w-3 h-3" />
                              {roleCfg.label}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {admin.status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                              REVOKED / INACTIVE
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {formatDateShort(admin.created_at, hydrated)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isPrimary ? (
                            <span className="inline-flex items-center text-[11px] text-amber-800 font-semibold bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md italic">
                              Primary Super Admin
                            </span>
                          ) : isSelf ? (
                            <span className="text-[11px] text-slate-400 italic">Current Session</span>
                          ) : (
                            <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Primary Admin & Super Admin role controller */}
                              {canControlRoles && admin.role !== 'SUPER_ADMIN' && admin.status === 'ACTIVE' && (
                                <button
                                  onClick={() => {
                                    setChangingRoleAdmin(admin);
                                    setSelectedNewRole(admin.role || 'COLLEGE_ADMIN');
                                  }}
                                  disabled={isOperating}
                                  title="Change Administrator Role & Tab Permissions"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 shadow-2xs hover:shadow-xs disabled:opacity-50 cursor-pointer"
                                >
                                  <UserCog className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Role Access</span>
                                </button>
                              )}

                              {isSuperAdmin && admin.role !== 'SUPER_ADMIN' && admin.status === 'ACTIVE' && (
                                <button
                                  onClick={() => setPromotingAdmin(admin)}
                                  disabled={isOperating}
                                  title="Promote to Super Admin"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 shadow-2xs hover:shadow-xs disabled:opacity-50 cursor-pointer"
                                >
                                  {isOperating && activeAction?.type === 'PROMOTE' ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <ShieldPlus className="w-3.5 h-3.5 text-amber-600" />
                                  )}
                                  <span>↑ Super Admin</span>
                                </button>
                              )}

                              {isSuperAdmin && admin.role === 'SUPER_ADMIN' && (
                                <button
                                  onClick={() => setDemotingAdmin(admin)}
                                  disabled={isOperating}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-50/80 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 min-h-[36px] cursor-pointer"
                                >
                                  {isOperating && activeAction?.type === 'DEMOTE' ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 hover:text-rose-600" />
                                  )}
                                  <span>↓ Demote to Admin</span>
                                </button>
                              )}

                              {canControlRoles && admin.role !== 'SUPER_ADMIN' && (
                                admin.status === 'ACTIVE' ? (
                                  <button
                                    onClick={() => {
                                      setRevokingAdmin(admin);
                                      setRevokeReason('');
                                    }}
                                    disabled={isOperating}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs hover:shadow-xs disabled:opacity-50 cursor-pointer"
                                  >
                                    {isOperating && activeAction?.type === 'REVOKE' ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <UserX className="w-3.5 h-3.5 text-rose-600" />
                                    )}
                                    <span>Revoke</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setReactivatingAdmin(admin)}
                                    disabled={isOperating}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-2xs hover:shadow-xs disabled:opacity-50 cursor-pointer"
                                  >
                                    {isOperating && activeAction?.type === 'REACTIVATE' ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    )}
                                    <span>Reactivate</span>
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PinnedRosterBoard>

      {/* Role Access Management Modal */}
      {changingRoleAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a1309] rounded-[3px] max-w-lg w-full p-6 shadow-2xl border border-amber-300/80 dark:border-[#4d3817] space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-[3px] bg-indigo-100 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900 dark:text-[#faebd0]">
                  Control Administrator Role &amp; Permissions
                </h4>
                <p className="text-xs text-slate-500 dark:text-[#c4a97d] leading-relaxed">
                  Assign the designated role for this college administrator. Dashboard tabs will be restricted according to this role.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-[#20150b] rounded-[3px] border border-amber-200/80 dark:border-[#382710] text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#a08862]">Administrator:</span>
                <span className="font-semibold text-slate-800 dark:text-[#faebd0]">{changingRoleAdmin.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#a08862]">Email:</span>
                <span className="font-mono text-slate-700 dark:text-[#faebd0]">{changingRoleAdmin.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#a08862]">Current Role:</span>
                <span className="font-bold text-indigo-700 dark:text-indigo-400">
                  {ADMIN_ROLE_CONFIGS[changingRoleAdmin.role]?.label || changingRoleAdmin.role}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-[#c4a97d] uppercase tracking-wider">
                Select Designated Role:
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {[
                  'PRIMARY_ADMIN',
                  'COLLEGE_ADMIN',
                  'EVENT_COORDINATOR',
                  'LIBRARIAN',
                  'FEEDBACK_EXAM_COORDINATOR',
                ].map((roleKey) => {
                  const cfg = ADMIN_ROLE_CONFIGS[roleKey];
                  const Icon = cfg.icon;
                  const isSelected = selectedNewRole === roleKey;
                  return (
                    <button
                      key={roleKey}
                      type="button"
                      onClick={() => setSelectedNewRole(roleKey)}
                      className={`w-full text-left p-3 rounded-[3px] border transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-slate-200 dark:border-[#382710] hover:border-slate-300 dark:hover:border-amber-700 hover:bg-slate-50 dark:hover:bg-[#20150b]'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-[3px] flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-[#281b0f] text-slate-500 dark:text-[#a08862]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-[#faebd0]">{cfg.label}</span>
                          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-[2px] bg-slate-100 dark:bg-[#281b0f] text-slate-600 dark:text-[#c4a97d]">
                            {cfg.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#a08862] mt-0.5">{cfg.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setChangingRoleAdmin(null)}
                disabled={isPending}
                className="px-4 py-2 rounded-[3px] text-xs font-semibold text-slate-600 dark:text-[#c4a97d] hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#281b0f] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmChangeRole}
                disabled={isPending}
                aria-busy={isPending && activeAction?.type === 'UPDATE_ROLE'}
                className="px-4 py-2 rounded-[3px] text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending && activeAction?.type === 'UPDATE_ROLE' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Role...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Role &amp; Permissions</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Revoke Admin Access */}
      {revokingAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">
                  Revoke administrator access?
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This administrator will be set to INACTIVE and immediately lose access to all admin portal features.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Administrator:</span>
                <span className="font-semibold text-slate-800">{revokingAdmin.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-slate-700">{revokingAdmin.email}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Reason for revocation (optional):
              </label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g., Role reassignment, suspension"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRevokingAdmin(null)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRevokeAccess}
                disabled={isPending}
                aria-busy={isPending && activeAction?.type === 'REVOKE'}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending && activeAction?.type === 'REVOKE' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Revoking Access...</span>
                  </>
                ) : (
                  <span>Revoke Access</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Reactivate Admin Access */}
      {reactivatingAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">
                  Reactivate admin access?
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Administrator access will be restored immediately for this account.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Administrator:</span>
                <span className="font-semibold text-slate-800">{reactivatingAdmin.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-slate-700">{reactivatingAdmin.email}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setReactivatingAdmin(null)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReactivateAccess}
                disabled={isPending}
                aria-busy={isPending && activeAction?.type === 'REACTIVATE'}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending && activeAction?.type === 'REACTIVATE' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reactivating Access...</span>
                  </>
                ) : (
                  <span>Reactivate Access</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PAST REVIEWED REQUESTS HISTORY */}
      {pastRequests.length > 0 && (
        <PinnedRosterBoard
          title="Reviewed Requests History"
          subtitle="Audit log of approved and rejected administrator applications"
          badge={`${pastRequests.length} LOGS`}
          icon={<FileText className="w-4 h-4 text-amber-500" />}
        >
          {/* Mobile Cards View */}
          <div className="md:hidden divide-y divide-slate-100 min-w-0">
            {pastRequests.map((req) => (
              <div key={req.id} className="p-3.5 space-y-1.5 text-xs min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800 truncate">{req.name}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
                {req.college && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <Building2 className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="truncate font-medium">{req.college.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({req.college.code})</span>
                  </div>
                )}
                <div className="font-mono text-slate-500 break-all text-[11px]">
                  {req.email}
                </div>
                <div className="text-[10px] text-slate-400">
                  Reviewed: {req.reviewed_at ? formatDateShort(req.reviewed_at, hydrated) : '—'}
                </div>
              </div>
            ))}
          </div>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto min-w-0">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-5 py-2.5">Name</th>
                  <th className="px-5 py-2.5">Institution</th>
                  <th className="px-5 py-2.5">Email</th>
                  <th className="px-5 py-2.5">Decision</th>
                  <th className="px-5 py-2.5">Reviewed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {pastRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="px-5 py-2.5">{req.name}</td>
                    <td className="px-5 py-2.5">
                      {req.college ? (
                        <div className="flex items-center gap-1.5 max-w-[200px]">
                          <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-medium text-slate-800 truncate" title={req.college.name}>
                            {req.college.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            ({req.college.code})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 font-mono">{req.email}</td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-slate-400">
                      {req.reviewed_at ? formatDateShort(req.reviewed_at, hydrated) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PinnedRosterBoard>
      )}

      {/* Confirmation Dialog: Promote to Super Admin */}
      {promotingAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">
                  Promote to Super Admin?
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This will grant full platform-wide administrative privileges across all institutions, Google Workspace integrations, billing, and administrator management.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Administrator:</span>
                <span className="font-semibold text-slate-800">{promotingAdmin.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-slate-700">{promotingAdmin.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Canonical Auth ID:</span>
                <span className="font-mono text-[10px] text-slate-600 truncate max-w-[200px]" title={promotingAdmin.user_id || promotingAdmin.id}>
                  {promotingAdmin.user_id || promotingAdmin.id}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">New Role:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  <ShieldCheck className="w-3 h-3" /> SUPER ADMIN
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/60 text-[11px] text-amber-800 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Promotions are cryptographically validated against the administrator&apos;s authentication record and immutably recorded in the platform audit log.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPromotingAdmin(null)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPromoteAdmin}
                disabled={isPending}
                aria-busy={isPending && activeAction?.type === 'PROMOTE'}
                className="px-4 py-2 rounded-xl text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 border border-amber-500/30 transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending && activeAction?.type === 'PROMOTE' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Promoting...</span>
                  </>
                ) : (
                  <>
                    <ShieldPlus className="w-3.5 h-3.5 text-amber-800" />
                    <span>Confirm Promotion</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Demote Super Admin to Standard Admin */}
      {demotingAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">
                  Demote Super Admin to Admin?
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  This will revoke Platform Super Administrator privileges from this account. They will revert to standard institution-level administrator permissions.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Administrator:</span>
                <span className="font-semibold text-slate-800">{demotingAdmin.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-slate-700">{demotingAdmin.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Canonical Auth ID:</span>
                <span className="font-mono text-[10px] text-slate-600 truncate max-w-[200px]" title={demotingAdmin.user_id || demotingAdmin.id}>
                  {demotingAdmin.user_id || demotingAdmin.id}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">Resulting Role:</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800">
                  ADMIN
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-rose-50/70 rounded-xl border border-rose-200/60 text-[11px] text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                Safety safeguards strictly prevent demoting the Primary Super Admin, self-demoting your current session, or removing the last active Super Admin.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDemotingAdmin(null)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDemoteAdmin}
                disabled={isPending}
                aria-busy={isPending && activeAction?.type === 'DEMOTE'}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending && activeAction?.type === 'DEMOTE' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Demoting...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Confirm Demotion</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Application Details Review Modal (Event Coordinator / Student Requests) */}
      {viewingRequestDetails && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isPending) setViewingRequestDetails(null);
          }}
        >
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)]">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-bce-navy p-4 sm:p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-purple-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-bold truncate">
                      Coordinator Application Details
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950 uppercase tracking-wider">
                      PENDING
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-200 truncate">
                    Submitted on {formatDateShort(viewingRequestDetails.created_at, hydrated)} at {formatTime(viewingRequestDetails.created_at, hydrated)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingRequestDetails(null)}
                aria-label="Close dialog"
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Applicant Overview Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Applicant Name:</span>
                  <span className="font-bold text-slate-900 text-sm">{viewingRequestDetails.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Email Address:</span>
                  <a href={`mailto:${viewingRequestDetails.email}`} className="font-mono text-purple-700 hover:underline">
                    {viewingRequestDetails.email}
                  </a>
                </div>
                {viewingRequestDetails.phone && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-purple-600" /> Mobile Number:
                    </span>
                    <a href={`tel:${viewingRequestDetails.phone}`} className="font-mono font-bold text-purple-900 hover:underline">
                      {viewingRequestDetails.phone}
                    </a>
                  </div>
                )}
                {viewingRequestDetails.college && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" /> College:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {viewingRequestDetails.college.name} ({viewingRequestDetails.college.code})
                    </span>
                  </div>
                )}
              </div>

              {/* Academic Identifiers Grid */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                  Academic Credentials
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/60">
                    <span className="text-[10px] uppercase font-bold text-purple-700 block mb-0.5">
                      Branch / Stream
                    </span>
                    <span className="font-bold text-slate-900 block truncate" title={viewingRequestDetails.branch || '—'}>
                      {viewingRequestDetails.branch || 'Not specified'}
                    </span>
                  </div>

                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/60">
                    <span className="text-[10px] uppercase font-bold text-purple-700 block mb-0.5">
                      Semester
                    </span>
                    <span className="font-bold text-slate-900 block">
                      {viewingRequestDetails.semester || '—'}
                    </span>
                  </div>

                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/60">
                    <span className="text-[10px] uppercase font-bold text-purple-700 block mb-0.5">
                      Registration Number
                    </span>
                    <span className="font-mono font-bold text-slate-900 block truncate" title={viewingRequestDetails.registration_number || '—'}>
                      {viewingRequestDetails.registration_number || '—'}
                    </span>
                  </div>

                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/60">
                    <span className="text-[10px] uppercase font-bold text-purple-700 block mb-0.5">
                      Class Roll Number
                    </span>
                    <span className="font-mono font-bold text-slate-900 block truncate" title={viewingRequestDetails.roll_number || '—'}>
                      {viewingRequestDetails.roll_number || '—'}
                    </span>
                  </div>

                  <div className="col-span-2 p-3 bg-purple-50/60 rounded-xl border border-purple-200/60">
                    <span className="text-[10px] uppercase font-bold text-purple-700 block mb-0.5">
                      Academic Session
                    </span>
                    <span className="font-semibold text-slate-800 block">
                      {viewingRequestDetails.academic_session || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Event Coordinator Vision / Statement */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Event Coordinator Description &amp; Vision
                </span>
                <div className="p-3.5 bg-amber-50/40 rounded-xl border border-amber-200/70 text-slate-700 leading-relaxed text-xs whitespace-pre-wrap">
                  {viewingRequestDetails.event_description || 'No description provided by applicant.'}
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setViewingRequestDetails(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const reqId = viewingRequestDetails.id;
                    setViewingRequestDetails(null);
                    handleReject(reqId);
                  }}
                  disabled={isPending}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const reqId = viewingRequestDetails.id;
                    const role = viewingRequestDetails.requested_role || 'EVENT_COORDINATOR';
                    setViewingRequestDetails(null);
                    handleApprove(reqId, role);
                  }}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Application</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
      </div>
    </div>
  );
}
