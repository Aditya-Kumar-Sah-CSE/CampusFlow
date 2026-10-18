'use client';

import { useState } from 'react';
import { Activity, Search } from 'lucide-react';
import type { AuditLog } from '@/types/database';
import { useHydrated, formatDateShort, formatTime } from '@/lib/hooks/use-hydrated';
import { ExamPadCard } from '@/components/ui/ExamPadCard';
import { PinnedRosterBoard } from '@/components/ui/PinnedRosterBoard';

interface Props {
  auditLogs: AuditLog[];
}

export function AuditLogsTab({ auditLogs }: Props) {
  const hydrated = useHydrated();
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('ALL');

  const actionTypes = Array.from(new Set(auditLogs.map((l) => l.action)));

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      (log.action?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.details?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.actor_email?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.entity_type?.toLowerCase() || '').includes(search.toLowerCase());

    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;

    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
      {/* Header & Filters on Authentic Exam Pad Card */}
      <ExamPadCard
        variant="dashboard"
        title="Administrative Audit Trail"
        subtitle="Tamper-evident chronological log of all administrative modifications and approvals."
        icon={<Activity className="w-5 h-5 text-bce-cobalt dark:text-amber-400" />}
        badge="AUDIT LOGS"
        clipLabel="AUDIT TRAIL"
        action={
          <div className="text-xs font-mono text-slate-500 dark:text-[#c4a97d] bg-slate-100 dark:bg-[#140e07] px-3 py-1.5 rounded-[3px] border border-slate-200 dark:border-[#382710]">
            {filteredLogs.length} of {auditLogs.length} entries shown
          </div>
        }
      >
        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="sm:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-[#8c7453]">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by admin email, action name, or details..."
              className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-[#140e07] border border-slate-200 dark:border-[#382710] rounded-[3px] text-base sm:text-xs min-h-[42px] sm:min-h-[38px] text-slate-900 dark:text-[#faebd0] placeholder:text-slate-400 dark:placeholder:text-[#8c7453] focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20 dark:focus:ring-amber-500/20"
            />
          </div>

          <div className="relative">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#140e07] border border-slate-200 dark:border-[#382710] rounded-[3px] text-base sm:text-xs min-h-[42px] sm:min-h-[38px] text-slate-900 dark:text-[#faebd0] focus:outline-none focus:ring-2 focus:ring-bce-cobalt/20 dark:focus:ring-amber-500/20"
            >
              <option value="ALL">All Event Types</option>
              {actionTypes.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
        </div>
      </ExamPadCard>

      {/* Logs Table (Desktop) & Cards (Mobile) Wrapped in PinnedRosterBoard */}
      <PinnedRosterBoard
        title="System Audit Records"
        subtitle="Security and operational activities across college entities"
        badge={`${filteredLogs.length} RECORDS`}
        icon={<Activity className="w-4 h-4 text-amber-500" />}
      >
        {filteredLogs.length === 0 ? (
          <div className="p-8 sm:p-12 text-center text-xs text-slate-400 dark:text-[#8c7453]">
            No audit records match the current filter criteria.
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="divide-y divide-slate-100 dark:divide-[#2d1f11] md:hidden min-w-0">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-3.5 sm:p-4 space-y-2 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] bg-slate-100 dark:bg-[#140e07] text-slate-800 dark:text-[#faebd0] font-mono text-[11px] font-bold border border-slate-200 dark:border-[#382710] break-all">
                      {log.action}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-[#8c7453] font-mono shrink-0 ml-auto sm:ml-0">
                      {formatDateShort(log.created_at, hydrated)}{' '}
                      {formatTime(log.created_at, hydrated)}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-700 dark:text-[#faebd0] font-medium truncate">
                    👤 {log.actor_email || 'System'}
                  </div>
                  {log.entity_type && (
                    <div className="text-[11px] text-slate-500 dark:text-[#c4a97d] font-mono">
                      Entity: <span className="font-semibold text-slate-700 dark:text-[#faebd0]">{log.entity_type}</span>
                    </div>
                  )}
                  {log.details && (
                    <p className="text-xs text-slate-600 dark:text-[#c4a97d] bg-slate-50 dark:bg-[#140e07] p-2.5 rounded-[3px] border border-slate-100 dark:border-[#382710] leading-relaxed break-words [overflow-wrap:anywhere]">
                      {log.details}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#1f150c] text-slate-600 dark:text-[#c4a97d] font-semibold border-b border-slate-200 dark:border-[#382710] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Actor / Admin</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Entity Type</th>
                    <th className="px-5 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d1f11]">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-[#1f150c]/80 transition-colors">
                      <td className="px-5 py-3.5 text-slate-500 dark:text-[#8c7453] whitespace-nowrap">
                        {formatDateShort(log.created_at, hydrated)}{' '}
                        <span className="text-slate-400 dark:text-[#8c7453] font-mono">
                          {formatTime(log.created_at, hydrated)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-700 dark:text-[#faebd0] font-medium">
                        {log.actor_email || 'System'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] bg-slate-100 dark:bg-[#140e07] text-slate-800 dark:text-[#faebd0] font-mono text-[11px] font-bold border border-slate-200 dark:border-[#382710]">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-[#c4a97d] font-mono text-[11px]">
                        {log.entity_type || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-[#faebd0] max-w-md break-words [overflow-wrap:anywhere]">
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PinnedRosterBoard>
    </div>
  );
}
