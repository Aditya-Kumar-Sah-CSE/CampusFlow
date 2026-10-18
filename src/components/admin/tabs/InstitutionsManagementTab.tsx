'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Power,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  School,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import {
  getInstitutionsAction,
  createInstitutionAction,
  updateInstitutionAction,
  toggleInstitutionStatusAction,
  updateLandingTogglesAction,
} from '@/app/admin/institutions/actions';
import { PaginationControl } from '@/components/ui/PaginationControl';
import { ExamPadCard, ExamPadClip } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';
import { InstitutionModal } from '@/components/admin/institutions/InstitutionModal';
import type { College } from '@/types/tenant';
import type { CreateCollegeInput, UpdateCollegeInput } from '@/lib/validation';

export function InstitutionsManagementTab() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCollege, setEditingCollege] = useState<College | null>(null);
  const [deactivatingCollege, setDeactivatingCollege] = useState<College | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [instStep, setInstStep] = useState<1 | 2>(1);

  // Form state
  const [formData, setFormData] = useState<CreateCollegeInput>({
    name: '',
    code: '',
    slug: '',
    logoUrl: '',
    address: '',
    contactEmail: '',
    contactPhone: '',
    websiteUrl: '',
    tagline: '',
    affiliatedUniversity: '',
    establishedYear: null,
    isActive: true,
    showFeedbacks: true,
    showEvents: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await getInstitutionsAction();
    if (res.success && res.colleges) {
      setColleges(res.colleges);
    } else {
      setMessage({ text: res.error || 'Failed to load institutions.', type: 'error' });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Helper to auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData((prev) => {
      const updated = { ...prev, name };
      if (!isSlugManuallyEdited && !editingCollege) {
        // Auto-generate clean slug: lowercase, replace spaces/symbols with hyphens
        const generatedSlug = name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
        updated.slug = generatedSlug;
      }
      return updated;
    });
  };

  // Open Add modal
  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      code: '',
      slug: '',
      logoUrl: '',
      address: '',
      contactEmail: '',
      contactPhone: '',
      websiteUrl: '',
      tagline: '',
      affiliatedUniversity: '',
      establishedYear: null,
      isActive: true,
      showFeedbacks: true,
      showEvents: true,
    });
    setFormError(null);
    setIsSlugManuallyEdited(false);
    setInstStep(1);
    setIsAddModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEditModal = (college: College) => {
    setEditingCollege(college);
    setFormData({
      name: college.name,
      code: college.code,
      slug: college.slug,
      logoUrl: college.logo_url || '',
      address: college.address || '',
      contactEmail: college.contact_email || '',
      contactPhone: college.contact_phone || '',
      websiteUrl: college.website_url || '',
      tagline: college.tagline || '',
      affiliatedUniversity: college.affiliated_university || '',
      establishedYear: college.established_year || null,
      isActive: college.is_active,
      showFeedbacks: college.show_feedbacks !== false,
      showEvents: college.show_events !== false,
    });
    setFormError(null);
    setIsSlugManuallyEdited(true);
    setInstStep(1);
  };

  const handleNextStep = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (!formData.name?.trim()) {
      setFormError('Please enter the College Name.');
      return;
    }
    if (!formData.code?.trim()) {
      setFormError('Please enter the College Code / Short Name.');
      return;
    }
    if (!formData.slug?.trim()) {
      setFormError('Please enter a valid Public Slug.');
      return;
    }
    setFormError(null);
    setInstStep(2);
  };

  // Handle direct toggle for Landing Page Feedbacks / Events
  const handleToggleLandingModule = async (college: College, module: 'feedbacks' | 'events') => {
    const key = `${college.id}-${module}`;
    setTogglingId(key);

    const isCurrentOn = module === 'feedbacks' ? college.show_feedbacks !== false : college.show_events !== false;
    const nextValue = !isCurrentOn;

    // Optimistic UI update
    setColleges((prev) =>
      prev.map((c) =>
        c.id === college.id
          ? {
              ...c,
              show_feedbacks: module === 'feedbacks' ? nextValue : c.show_feedbacks,
              show_events: module === 'events' ? nextValue : c.show_events,
            }
          : c
      )
    );

    const res = await updateLandingTogglesAction(college.id, {
      [module === 'feedbacks' ? 'showFeedbacks' : 'showEvents']: nextValue,
    });

    setTogglingId(null);

    if (res.success) {
      showToast(
        `Landing Page ${module === 'feedbacks' ? 'Feedbacks' : 'Events'} set to ${nextValue ? 'ON' : 'OFF'} for ${college.code || college.name}`,
        'success'
      );
    } else {
      // Revert on error
      setColleges((prev) =>
        prev.map((c) =>
          c.id === college.id
            ? {
                ...c,
                show_feedbacks: module === 'feedbacks' ? isCurrentOn : c.show_feedbacks,
                show_events: module === 'events' ? isCurrentOn : c.show_events,
              }
            : c
        )
      );
      showToast(res.error || 'Failed to update toggle.', 'error');
    }
  };

  // Submit Create form
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const res = await createInstitutionAction(formData);
    setSubmitting(false);

    if (res.success && res.college) {
      showToast(`Institution "${res.college.name}" created successfully!`, 'success');
      setIsAddModalOpen(false);
      loadData();
    } else {
      setFormError(res.error || 'Failed to create institution.');
    }
  };

  // Submit Edit form
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollege) return;
    setFormError(null);
    setSubmitting(true);

    const updatePayload: UpdateCollegeInput = {
      ...formData,
      id: editingCollege.id,
    };

    const res = await updateInstitutionAction(updatePayload);
    setSubmitting(false);

    if (res.success && res.college) {
      showToast(`Institution "${res.college.name}" updated successfully!`, 'success');
      setEditingCollege(null);
      loadData();
    } else {
      setFormError(res.error || 'Failed to update institution.');
    }
  };

  // Handle Activate / Deactivate
  const handleToggleStatus = async (college: College) => {
    const newStatus = !college.is_active;
    if (!newStatus) {
      // Prompt confirmation before deactivating
      setDeactivatingCollege(college);
      return;
    }

    // Direct activation
    setSubmitting(true);
    const res = await toggleInstitutionStatusAction(college.id, true);
    setSubmitting(false);

    if (res.success) {
      showToast(`Institution "${college.name}" activated!`, 'success');
      loadData();
    } else {
      showToast(res.error || 'Failed to activate institution.', 'error');
    }
  };

  // Confirm Deactivation
  const handleConfirmDeactivate = async () => {
    if (!deactivatingCollege) return;
    setSubmitting(true);
    const res = await toggleInstitutionStatusAction(deactivatingCollege.id, false);
    setSubmitting(false);

    if (res.success) {
      showToast(`Institution "${deactivatingCollege.name}" deactivated.`, 'success');
      setDeactivatingCollege(null);
      loadData();
    } else {
      showToast(res.error || 'Failed to deactivate institution.', 'error');
    }
  };

  // Filtered colleges list
  const filteredColleges = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const qClean = q.replace(/[^a-z0-9]/g, '');
    if (!q) return colleges;
    return colleges.filter((c) => {
      const name = c.name.toLowerCase();
      const code = (c.code || '').toLowerCase();
      const codeClean = code.replace(/[^a-z0-9]/g, '');
      const slug = (c.slug || '').toLowerCase();
      const slugClean = slug.replace(/[^a-z0-9]/g, '');
      const addr = (c.address || '').toLowerCase();
      return (
        name.includes(q) ||
        code.includes(q) ||
        slug.includes(q) ||
        addr.includes(q) ||
        (qClean && (codeClean.includes(qClean) || slugClean.includes(qClean)))
      );
    });
  }, [colleges, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredColleges.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);

  const paginatedColleges = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredColleges.slice(start, start + pageSize);
  }, [filteredColleges, validPage, pageSize]);

  const activeCount = colleges.filter((c) => c.is_active).length;
  const inactiveCount = colleges.length - activeCount;

  return (
    <div className="space-y-6 w-full">
      {/* Toast Notification Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-medium animate-in fade-in duration-200 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <ExamPadCard
            variant="dashboard"
            title="Institutions & Campus Registry"
            subtitle="Manage registered colleges, public feedback portals, and multi-tenant subdomains."
            badge={`${colleges.length} CAMPUSES`}
            clipLabel="CAMPUS REGISTRY"
            icon={<Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          />
        </div>
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-bce-navy hover:bg-slate-900 text-amber-300 dark:bg-amber-600/30 dark:text-amber-200 border border-bce-navy dark:border-amber-600/60 rounded-[3px] text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all active:scale-95 shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add College</span>
        </button>
      </div>

      {/* Metrics & Search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Chips */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-3 py-1 bg-white dark:bg-[#1a1309] rounded-[3px] border border-amber-200/80 dark:border-[#382710] text-slate-700 dark:text-[#faebd0] shadow-2xs">
            Total: <span className="text-slate-900 dark:text-amber-300 font-bold">{colleges.length}</span>
          </span>
          <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 rounded-[3px] border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 shadow-2xs">
            Active: <span className="text-emerald-900 dark:text-emerald-200 font-bold">{activeCount}</span>
          </span>
          {inactiveCount > 0 && (
            <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/60 rounded-[3px] border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 shadow-2xs">
              Inactive: <span className="text-amber-900 dark:text-amber-200 font-bold">{inactiveCount}</span>
            </span>
          )}
        </div>

        {/* Search Input */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#a08862] pointer-events-none" />
          <input
            type="text"
            placeholder="Search colleges, codes, slugs..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-[#140e07] border border-amber-200/80 dark:border-[#382710] rounded-[3px] text-slate-900 dark:text-[#faebd0] placeholder:text-slate-400 dark:placeholder:text-[#8f754c] focus:outline-hidden focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-[2px] transition cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Colleges List / Table */}
      <PinnedRosterBoard
        title="Institutional Campuses"
        subtitle="Authorized colleges and multi-tenant portal routing"
        badge={`${filteredColleges.length} REGISTERED`}
        icon={<School className="w-4 h-4 text-amber-500" />}
      >
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <span className="text-xs">Loading institutions...</span>
          </div>
        ) : filteredColleges.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs sm:text-sm">
            <School className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No institutions found.</p>
            <p className="text-slate-400 mt-0.5">
              {searchQuery ? 'Try adjusting your search criteria.' : 'Click "+ Add College" to register your first college.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[620px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#20150b] border-b border-slate-200 dark:border-[#382710] text-slate-600 dark:text-[#c4a97d] font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Institution</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Public Slug / Portal</th>
                  <th className="py-3 px-4">Location / Info</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Landing Modules</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2a1d0f]">
                {paginatedColleges.map((col) => {
                  return (
                    <tr
                      key={col.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#22170d]/70 transition-colors group"
                    >
                      {/* Logo & Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-[3px] bg-slate-100 dark:bg-[#20150b] border border-slate-200 dark:border-[#382710] flex items-center justify-center p-1 shrink-0 overflow-hidden text-slate-700 dark:text-[#faebd0] font-bold">
                            {col.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={col.logo_url}
                                alt={col.name}
                                className="max-w-full max-h-full object-contain"
                              />
                            ) : (
                              <span className="text-[10px] text-slate-600 font-mono font-bold">
                                {col.code.slice(0, 3)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate text-xs sm:text-sm">
                              {col.name}
                            </span>
                            {col.tagline && (
                              <span className="text-[10px] text-slate-400 block truncate">
                                {col.tagline}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px]">
                          {col.code}
                        </span>
                      </td>

                      {/* Slug / Public URL */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/${col.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 font-mono text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                        >
                          <span>/{col.slug}</span>
                          <ExternalLink className="w-3 h-3 text-blue-500" />
                        </Link>
                      </td>

                      {/* Location / Meta */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {col.address ? (
                          <div className="flex items-center gap-1 truncate max-w-[180px]">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{col.address}</span>
                          </div>
                        ) : col.affiliated_university ? (
                          <span className="truncate max-w-[180px] block text-slate-400">
                            {col.affiliated_university}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Not set</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[2px] text-[10px] font-bold uppercase tracking-wider font-mono ${
                            col.is_active
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60'
                              : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              col.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                            }`}
                          />
                          {col.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Landing Page Modules (Feedbacks & Events Independent Toggles) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-[#20150b] border border-slate-200/90 dark:border-[#382710] rounded-[3px] shadow-2xs">
                          {/* Feedbacks Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleLandingModule(col, 'feedbacks')}
                            disabled={togglingId === `${col.id}-feedbacks`}
                            title={`Click to turn Feedbacks ${col.show_feedbacks !== false ? 'OFF' : 'ON'} on the public landing page`}
                            className={`px-2 py-1 rounded-[2px] text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95 ${
                              col.show_feedbacks !== false
                                ? 'bg-blue-600 text-white shadow-2xs hover:bg-blue-700'
                                : 'bg-slate-200 dark:bg-[#2e1f10] text-slate-500 dark:text-[#a08862] hover:bg-slate-300 dark:hover:bg-[#382714]'
                            }`}
                          >
                            <span>Forms: {col.show_feedbacks !== false ? 'ON' : 'OFF'}</span>
                          </button>

                          {/* Events Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleLandingModule(col, 'events')}
                            disabled={togglingId === `${col.id}-events`}
                            title={`Click to turn Events ${col.show_events !== false ? 'OFF' : 'ON'} on the public landing page`}
                            className={`px-2 py-1 rounded-[2px] text-[10px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95 ${
                              col.show_events !== false
                                ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                                : 'bg-slate-200 dark:bg-[#2e1f10] text-slate-500 dark:text-[#a08862] hover:bg-slate-300 dark:hover:bg-[#382714]'
                            }`}
                          >
                            <span>Events: {col.show_events !== false ? 'ON' : 'OFF'}</span>
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(col)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 dark:text-[#faebd0] bg-slate-100 dark:bg-[#20150b] hover:bg-slate-200 dark:hover:bg-[#281b0f] border border-slate-200 dark:border-[#382710] rounded-[3px] transition-colors font-medium text-xs cursor-pointer"
                            title="Edit College Details"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-600 dark:text-[#c4a97d]" />
                            <span>Edit</span>
                          </button>

                          {/* Toggle Active Status */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(col)}
                            disabled={submitting}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] border transition-colors font-medium text-xs cursor-pointer ${
                              col.is_active
                                ? 'bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700/60'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/60'
                            }`}
                            title={col.is_active ? 'Deactivate Institution' : 'Activate Institution'}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{col.is_active ? 'Deactivate' : 'Activate'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

            <PaginationControl
              currentPage={validPage}
              totalPages={totalPages}
              totalItems={filteredColleges.length}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[10, 20, 50, 100]}
              isLoading={loading}
            />
          </>
        )}
      </PinnedRosterBoard>

      {/* ==================================================================== */}
      {/* 2-Step ExamPad Modal: Add College */}
      <InstitutionModal
        isOpen={isAddModalOpen}
        isEdit={false}
        editingCollege={null}
        formData={formData}
        setFormData={setFormData}
        formError={formError}
        setFormError={setFormError}
        submitting={submitting}
        handleNameChange={handleNameChange}
        setIsSlugManuallyEdited={setIsSlugManuallyEdited}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateSubmit}
      />

      {/* 2-Step ExamPad Modal: Edit College */}
      <InstitutionModal
        isOpen={Boolean(editingCollege)}
        isEdit={true}
        editingCollege={editingCollege}
        formData={formData}
        setFormData={setFormData}
        formError={formError}
        setFormError={setFormError}
        submitting={submitting}
        handleNameChange={handleNameChange}
        setIsSlugManuallyEdited={setIsSlugManuallyEdited}
        onClose={() => setEditingCollege(null)}
        onSubmit={handleEditSubmit}
      />

            {/* MODAL 3: DEACTIVATION CONFIRMATION                                    */}
      {/* ==================================================================== */}
      {deactivatingCollege && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Deactivate this institution?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  This will hide the public feedback portal for <strong>{deactivatingCollege.name}</strong> (/{deactivatingCollege.slug}) and prevent new tenant access. Existing data will remain intact.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeactivatingCollege(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-all"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Deactivate Institution</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
