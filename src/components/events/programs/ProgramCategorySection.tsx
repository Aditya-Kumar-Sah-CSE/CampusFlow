'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Users,
  User,
  IndianRupee,
  Clock,
  Ticket,
  ChevronDown,
  ChevronUp,
  Lock,
  AlertCircle,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { EventCategory, EventProgram } from '@/types/programs';
import type { TenantContext } from '@/types/tenant';

interface Props {
  event: CollegeEvent;
  tenant: TenantContext;
  categories: (EventCategory & { programs: EventProgram[] })[];
}

export function ProgramCategorySection({ event, tenant, categories }: Props) {
  const [expandedCat, setExpandedCat] = useState<string | null>(categories[0]?.id || null);

  if (categories.length === 0) {
    return null;
  }

  const now = new Date();

  const getProgramStatus = (prog: EventProgram) => {
    if (!prog.is_active) return { canRegister: false, label: 'Inactive', color: 'text-slate-400' };
    if (prog.registration_open_at && now < new Date(prog.registration_open_at)) {
      return { canRegister: false, label: 'Opens Soon', color: 'text-blue-600' };
    }
    if (prog.registration_close_at && now > new Date(prog.registration_close_at)) {
      return { canRegister: false, label: 'Closed', color: 'text-red-600' };
    }
    return { canRegister: true, label: 'Open', color: 'text-emerald-600' };
  };

  const getParticipationIcon = (type: string) => {
    switch (type) {
      case 'TEAM': return <Users className="w-3.5 h-3.5 text-purple-500" />;
      case 'BOTH': return <Users className="w-3.5 h-3.5 text-amber-500" />;
      default: return <User className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  const getParticipationLabel = (type: string) => {
    switch (type) {
      case 'INDIVIDUAL': return 'Individual';
      case 'TEAM': return 'Team';
      case 'BOTH': return 'Individual / Team';
      default: return type;
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-500" />
        <h2 className="text-base sm:text-lg font-bold text-slate-900">Programs & Events</h2>
      </div>

      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Category Header */}
            <button
              onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
              className="w-full p-4 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{cat.name}</h3>
                  {cat.description && <p className="text-[10px] text-slate-500">{cat.description}</p>}
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                  {cat.programs.length} program{cat.programs.length !== 1 ? 's' : ''}
                </span>
              </div>
              {expandedCat === cat.id ? (
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {/* Programs */}
            {expandedCat === cat.id && (
              <div className="border-t border-slate-100">
                {cat.programs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No programs in this category.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {cat.programs.map((prog) => {
                      const status = getProgramStatus(prog);
                      return (
                        <div key={prog.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-slate-900">{prog.name}</h4>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  status.canRegister ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  'bg-slate-50 text-slate-500 border-slate-200'
                                }`}>
                                  {status.label}
                                </span>
                              </div>
                              {prog.description && (
                                <p className="text-xs text-slate-600 line-clamp-2">{prog.description}</p>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {/* Participation type */}
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                                  {getParticipationIcon(prog.participation_type)}
                                  {getParticipationLabel(prog.participation_type)}
                                </span>
                                {/* Fee */}
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-700">
                                  <IndianRupee className="w-3 h-3" />
                                  {prog.registration_fee > 0 ? prog.registration_fee : 'Free'}
                                </span>
                                {/* Team size */}
                                {(prog.participation_type === 'TEAM' || prog.participation_type === 'BOTH') && prog.min_team_size && prog.max_team_size && (
                                  <span className="text-[10px] font-medium text-slate-500">
                                    {prog.min_team_size}–{prog.max_team_size} members
                                  </span>
                                )}
                                {/* Registrations count */}
                                {(prog.registrations_count || 0) > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500">
                                    <Ticket className="w-3 h-3" />
                                    {prog.registrations_count} registered
                                  </span>
                                )}
                                {/* Deadline */}
                                {prog.registration_close_at && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500">
                                    <Clock className="w-3 h-3" />
                                    Deadline: {new Date(prog.registration_close_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Register Button */}
                            <div className="shrink-0">
                              {status.canRegister && event.status === 'PUBLISHED' ? (
                                <Link
                                  href={`/${tenant.slug}/events/${event.slug}/${prog.slug}`}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all active:scale-95 shadow-sm"
                                >
                                  <Ticket className="w-3.5 h-3.5" />
                                  Register
                                </Link>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-400 text-xs font-semibold rounded-xl cursor-not-allowed">
                                  <Lock className="w-3.5 h-3.5" />
                                  {status.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
