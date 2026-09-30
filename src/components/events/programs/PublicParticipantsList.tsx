'use client';

import React, { useState } from 'react';
import { Users, User, Search, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import type { PublicParticipant, PublicTeamParticipant } from '@/types/programs';

interface Props {
  programGroups: {
    programName: string;
    categoryName: string;
    participants: (PublicParticipant | PublicTeamParticipant)[];
  }[];
}

function isTeamParticipant(p: PublicParticipant | PublicTeamParticipant): p is PublicTeamParticipant {
  return p.registration_type === 'TEAM' && 'members' in p;
}

export function PublicParticipantsList({ programGroups }: Props) {
  const [search, setSearch] = useState('');
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [filterProgram, setFilterProgram] = useState('ALL');

  if (programGroups.length === 0) return null;

  const allPrograms = programGroups.map((g) => g.programName);
  const filtered = programGroups
    .filter((g) => filterProgram === 'ALL' || g.programName === filterProgram)
    .map((g) => ({
      ...g,
      participants: g.participants.filter((p) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
          p.participant_name.toLowerCase().includes(q) ||
          p.registration_number.toLowerCase().includes(q) ||
          (p.team_name && p.team_name.toLowerCase().includes(q))
        );
      }),
    }))
    .filter((g) => g.participants.length > 0);

  const totalParticipants = filtered.reduce((sum, g) => sum + g.participants.length, 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-500" />
        <h2 className="text-base sm:text-lg font-bold text-slate-900">Registered Participants</h2>
        <span className="text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
          {totalParticipants}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {allPrograms.length > 1 && (
          <select
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2 py-2"
          >
            <option value="ALL">All Programs</option>
            {allPrograms.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
      </div>

      {/* Groups */}
      <div className="space-y-3">
        {filtered.map((group, gi) => (
          <div key={gi} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-slate-900">{group.programName}</span>
              <span className="text-[10px] text-slate-500">{group.categoryName}</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full ml-auto">
                {group.participants.length}
              </span>
            </div>

            <div className="divide-y divide-slate-50">
              {group.participants.map((p, pi) => (
                <div key={pi} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        p.registration_type === 'TEAM' ? 'bg-purple-100' : 'bg-blue-100'
                      }`}>
                        {p.registration_type === 'TEAM' ? (
                          <Users className="w-3.5 h-3.5 text-purple-600" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{p.participant_name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="font-mono">{p.registration_number}</span>
                          {p.team_name && <span className="text-purple-600 font-medium">Team: {p.team_name}</span>}
                        </div>
                      </div>
                    </div>
                    {isTeamParticipant(p) && p.members.length > 0 && (
                      <button
                        onClick={() => setExpandedTeam(expandedTeam === p.registration_number ? null : p.registration_number)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                      >
                        {expandedTeam === p.registration_number ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                  {/* Team Members */}
                  {isTeamParticipant(p) && expandedTeam === p.registration_number && p.members.length > 0 && (
                    <div className="mt-2 pl-9 space-y-1">
                      {p.members.map((m, mi) => (
                        <div key={mi} className="flex items-center gap-2 text-xs text-slate-700">
                          <span className="w-4 h-4 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-[9px] font-bold shrink-0">
                            {mi + 1}
                          </span>
                          <span>{m.member_name}</span>
                          {m.is_leader && <span className="text-[9px] font-bold px-1 py-0.5 bg-amber-100 text-amber-700 rounded">Leader</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-xs text-slate-400">No participants found.</div>
      )}
    </section>
  );
}
