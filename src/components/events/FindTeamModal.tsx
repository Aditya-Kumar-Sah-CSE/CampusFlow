'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Search, Users, Crown, Loader2, AlertCircle, CheckCircle,
  Send, ChevronRight, Clock, XCircle, RefreshCw, ArrowLeft,
} from 'lucide-react';
import {
  searchTeamsAction,
  requestToJoinTeamAction,
  getMyJoinRequestsAction,
  cancelJoinRequestAction,
  type TeamSearchResult,
  type MyJoinRequest,
} from '@/app/events/join-requests/actions';

interface FindTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  programId: string;
  programName: string;
  userRegistrationNumber: string;
  initialView?: 'search' | 'requests';
  onTeamJoined?: () => void;
}

export function FindTeamModal({
  isOpen, onClose, eventId, programId, programName, userRegistrationNumber: _userRegistrationNumber, initialView, onTeamJoined: _onTeamJoined,
}: FindTeamModalProps) {
  const [view, setView] = useState<'search' | 'requests'>(initialView || (programId ? 'search' : 'requests'));
  const [query, setQuery] = useState('');
  const [teams, setTeams] = useState<TeamSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Request state
  const [requestingTeamId, setRequestingTeamId] = useState<string | null>(null);
  const [requestSuccessTeamId, setRequestSuccessTeamId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // My Requests state
  const [myRequests, setMyRequests] = useState<MyJoinRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const doSearch = useCallback(async (q?: string) => {
    if (!programId) return;
    setSearchLoading(true);
    setSearchError(null);
    setRequestError(null);
    setRequestSuccessTeamId(null);
    try {
      const res = await searchTeamsAction({ eventId, programId, query: q ?? query });
      if (res.success && res.teams) {
        setTeams(res.teams);
      } else {
        setSearchError(res.error || 'Search failed.');
      }
      setHasSearched(true);
    } catch {
      setSearchError('An unexpected error occurred.');
    } finally {
      setSearchLoading(false);
    }
  }, [eventId, programId, query]);

  const loadMyRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await getMyJoinRequestsAction(eventId);
      if (res.success && res.requests) {
        setMyRequests(programName ? res.requests.filter(r => r.programName === programName) : res.requests);
      }
    } catch { /* ignore */ }
    finally { setRequestsLoading(false); }
  }, [eventId, programName]);

  useEffect(() => {
    if (isOpen) {
      if (initialView) {
        setView(initialView);
      } else if (!programId) {
        setView('requests');
      }
      if (programId) {
        doSearch('');
      }
      loadMyRequests();
    }
  }, [isOpen, initialView, programId, doSearch, loadMyRequests]);

  const handleRequest = async (teamId: string) => {
    setRequestingTeamId(teamId);
    setRequestError(null);
    setRequestSuccessTeamId(null);
    try {
      const res = await requestToJoinTeamAction({ eventId, programId, teamId });
      if (res.success) {
        setRequestSuccessTeamId(teamId);
        loadMyRequests();
      } else {
        setRequestError(res.error || 'Request failed.');
      }
    } catch {
      setRequestError('An unexpected error occurred.');
    } finally {
      setRequestingTeamId(null);
    }
  };

  const handleCancel = async (reqId: string) => {
    setCancellingId(reqId);
    try {
      const res = await cancelJoinRequestAction(eventId, reqId);
      if (res.success) {
        loadMyRequests();
        if (programId) doSearch(query);
      }
    } catch { /* ignore */ }
    finally { setCancellingId(null); }
  };

  if (!isOpen) return null;

  const pendingRequest = myRequests.find(r => r.status === 'PENDING');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[calc(100vw-16px)] sm:w-full sm:max-w-lg max-h-[calc(100vh-16px)] bg-white rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">{programName ? 'Find a Team' : 'My Team Requests'}</h2>
              {programName && <p className="text-[10px] text-slate-500 truncate">{programName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        {programId && (
          <div className="flex border-b border-slate-100 shrink-0">
          <button
            onClick={() => setView('search')}
            className={`flex-1 py-2.5 text-xs font-bold text-center transition-colors cursor-pointer ${
              view === 'search'
                ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50/30'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Search Teams
            </span>
          </button>
          <button
            onClick={() => { setView('requests'); loadMyRequests(); }}
            className={`flex-1 py-2.5 text-xs font-bold text-center transition-colors cursor-pointer relative ${
              view === 'requests'
                ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50/30'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              My Requests
              {myRequests.filter(r => r.unread).length > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {myRequests.filter(r => r.unread).length}
                </span>
              )}
            </span>
          </button>
        </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3.5 sm:px-5 py-3.5 sm:py-4 space-y-3.5 sm:space-y-4">
          {view === 'search' ? (
            <>
              {/* Pending warning */}
              {pendingRequest && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="break-words">You have a pending request for <strong>{pendingRequest.teamName}</strong>. Cancel it before requesting another team.</span>
                </div>
              )}

              {/* Search bar */}
              <form onSubmit={(e) => { e.preventDefault(); doSearch(); }} className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search team name or Team ID..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-xs transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                >
                  {searchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span className="sm:hidden">Search</span>
                </button>
              </form>

              {/* Error */}
              {searchError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{searchError}</span>
                </div>
              )}

              {requestError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{requestError}</span>
                </div>
              )}

              {requestSuccessTeamId && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Join request sent! The team leader will review your request.</span>
                </div>
              )}

              {/* Team results */}
              {searchLoading && !hasSearched ? (
                <div className="py-8 flex flex-col items-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs font-medium">Loading teams...</span>
                </div>
              ) : teams.length === 0 && hasSearched ? (
                <div className="py-8 flex flex-col items-center gap-2 text-slate-400">
                  <Users className="w-8 h-8" />
                  <span className="text-xs font-medium">
                    {query ? 'No teams match your search.' : 'No teams available for this program yet.'}
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {teams.length} team{teams.length !== 1 ? 's' : ''} found
                  </div>
                  {teams.map(team => {
                    const isRequested = requestSuccessTeamId === team.teamId || myRequests.some(r => r.teamId.toUpperCase() === team.teamId.toUpperCase() && r.status === 'PENDING');
                    const isApproved = myRequests.some(r => r.teamId.toUpperCase() === team.teamId.toUpperCase() && r.status === 'APPROVED');

                    return (
                      <div key={team.teamId} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3 hover:border-purple-200 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h3 className="text-sm font-bold text-slate-900">{team.teamName}</h3>
                            <p className="text-[10px] font-mono text-slate-500">{team.teamId}</p>
                          </div>
                          <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            team.hasCapacity
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-red-700 bg-red-50 border-red-200'
                          }`}>
                            {team.memberCount} / {team.maxTeamSize}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-500" />
                            <span className="font-medium">{team.leaderName}</span>
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          {isApproved ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>You&apos;re a member!</span>
                            </div>
                          ) : isRequested ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Request pending</span>
                            </div>
                          ) : !team.hasCapacity ? (
                            <div className="text-xs font-bold text-slate-400">Team is full</div>
                          ) : pendingRequest ? (
                            <div className="text-xs text-slate-400 font-medium">Cancel your current pending request first</div>
                          ) : (
                            <button
                              onClick={() => handleRequest(team.teamId)}
                              disabled={requestingTeamId === team.teamId}
                              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-purple-400 disabled:to-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                            >
                              {requestingTeamId === team.teamId ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Sending Request...</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Request to Join</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* My Requests View */
            <>
              {requestsLoading ? (
                <div className="py-8 flex flex-col items-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs font-medium">Loading your requests...</span>
                </div>
              ) : myRequests.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2 text-slate-400">
                  <Send className="w-8 h-8" />
                  <span className="text-xs font-medium">No join requests yet.</span>
                  <button onClick={() => setView('search')} className="text-xs text-purple-600 font-bold hover:underline cursor-pointer flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> Find a team
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myRequests.map(req => (
                    <div key={req.id} className={`rounded-2xl border p-4 space-y-2 ${
                      req.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-200' :
                      req.status === 'REJECTED' ? 'bg-red-50 border-red-200' :
                      req.status === 'CANCELLED' ? 'bg-slate-50 border-slate-200' :
                      'bg-white border-purple-200'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-900">{req.teamName}</h4>
                          <p className="text-[10px] text-slate-500">{req.programName} • Team ID: {req.teamId}</p>
                          <p className="text-[10px] text-slate-500">
                            Leader: {req.leaderName} • Requested {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          req.status === 'APPROVED' ? 'text-emerald-700 bg-emerald-100 border-emerald-300' :
                          req.status === 'REJECTED' ? 'text-red-700 bg-red-100 border-red-300' :
                          req.status === 'CANCELLED' ? 'text-slate-500 bg-slate-100 border-slate-300' :
                          req.status === 'EXPIRED' ? 'text-orange-600 bg-orange-100 border-orange-300' :
                          'text-purple-700 bg-purple-100 border-purple-300'
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      {req.status === 'APPROVED' && (
                        <div className="pt-1 border-t border-emerald-200 flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>You&apos;ve been added to the team!</span>
                        </div>
                      )}

                      {req.status === 'REJECTED' && (
                        <div className="pt-1 border-t border-red-200 flex items-center justify-between">
                          <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            Request declined
                          </span>
                          <button
                            onClick={() => setView('search')}
                            className="text-[10px] font-bold text-purple-600 hover:underline cursor-pointer flex items-center gap-1"
                          >
                            Find another team <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {req.status === 'PENDING' && (
                        <div className="pt-1 border-t border-purple-100 flex items-center justify-between">
                          <span className="text-[10px] text-purple-600 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Waiting for team leader
                          </span>
                          <button
                            onClick={() => handleCancel(req.id)}
                            disabled={cancellingId === req.id}
                            className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer flex items-center gap-1 disabled:text-red-300"
                          >
                            {cancellingId === req.id ? (
                              <><Loader2 className="w-3 h-3 animate-spin" /> Cancelling...</>
                            ) : (
                              <><XCircle className="w-3 h-3" /> Cancel</>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={() => loadMyRequests()}
                  disabled={requestsLoading}
                  className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${requestsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
