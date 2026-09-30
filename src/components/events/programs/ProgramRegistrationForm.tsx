'use client';

import React, { useState } from 'react';
import {
  User,
  Users,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Upload,
  QrCode,
} from 'lucide-react';
import type { CollegeEvent } from '@/types/events';
import type { EventProgram, TeamMemberInput } from '@/types/programs';
import type { TenantContext } from '@/types/tenant';
import { registerForProgramAction } from '@/app/admin/events/program-actions';

interface Props {
  event: CollegeEvent;
  program: EventProgram;
  tenant: TenantContext;
}

export function ProgramRegistrationForm({ event, program, tenant }: Props) {
  const [regType, setRegType] = useState<'INDIVIDUAL' | 'TEAM'>(
    program.participation_type === 'TEAM' ? 'TEAM' : 'INDIVIDUAL'
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ registration_number: string; payment_status: string } | null>(null);
  const [error, setError] = useState('');

  // Participant / leader fields
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');

  // Team fields
  const [teamName, setTeamName] = useState('');
  const [members, setMembers] = useState<TeamMemberInput[]>([
    { member_name: '', student_id: '', email: '', mobile: '', branch: '', semester: '' },
  ]);

  // Payment fields
  const [paymentRef, setPaymentRef] = useState('');

  const isPaid = event.payment_required && program.registration_fee > 0;
  const minTeam = program.min_team_size || 1;
  const maxTeam = program.max_team_size || 20;

  const addMember = () => {
    if (members.length >= maxTeam) return;
    setMembers([...members, { member_name: '', student_id: '', email: '', mobile: '', branch: '', semester: '' }]);
  };

  const removeMember = (idx: number) => {
    if (members.length <= 1) return;
    setMembers(members.filter((_, i) => i !== idx));
  };

  const updateMember = (idx: number, field: keyof TeamMemberInput, value: string) => {
    const updated = [...members];
    updated[idx] = { ...updated[idx], [field]: value };
    setMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      setLoading(false);
      return;
    }

    if (regType === 'TEAM') {
      if (!teamName.trim()) {
        setError('Team name is required.');
        setLoading(false);
        return;
      }
      const validMembers = members.filter((m) => m.member_name.trim());
      if (validMembers.length < minTeam) {
        setError(`Team must have at least ${minTeam} members.`);
        setLoading(false);
        return;
      }
      if (validMembers.length > maxTeam) {
        setError(`Team can have at most ${maxTeam} members.`);
        setLoading(false);
        return;
      }
    }

    const result = await registerForProgramAction({
      event_id: event.id,
      program_id: program.id,
      college_id: tenant.collegeId,
      registration_type: regType,
      participant_name: name.trim(),
      student_id: studentId.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      branch: branch.trim(),
      semester: semester.trim(),
      team_name: regType === 'TEAM' ? teamName.trim() : undefined,
      members: regType === 'TEAM' ? members.filter((m) => m.member_name.trim()) : undefined,
      payment_reference: paymentRef.trim() || undefined,
    });

    if (result.success) {
      setSuccess({
        registration_number: result.registration_number || '',
        payment_status: result.payment_status || 'NOT_REQUIRED',
      });
    } else {
      setError(result.error || 'Registration failed.');
    }
    setLoading(false);
  };

  // Success State
  if (success) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 p-6 sm:p-8 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-emerald-800">Registration Successful!</h2>
        <div className="bg-emerald-50 rounded-xl p-4 space-y-2 max-w-sm mx-auto">
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 uppercase">Registration ID</p>
            <p className="text-lg font-bold font-mono text-emerald-900">{success.registration_number}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 uppercase">Program</p>
            <p className="text-sm font-semibold text-emerald-900">{program.name}</p>
          </div>
          {regType === 'TEAM' && teamName && (
            <div>
              <p className="text-[10px] font-semibold text-emerald-600 uppercase">Team</p>
              <p className="text-sm font-semibold text-emerald-900">{teamName}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold text-emerald-600 uppercase">Payment</p>
            <p className="text-sm font-semibold text-emerald-900">{success.payment_status}</p>
          </div>
        </div>
        <p className="text-xs text-slate-500">Please save your registration ID for future reference.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200">
        <h2 className="text-base font-bold text-slate-900">Register for {program.name}</h2>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600">
          {isPaid && (
            <span className="inline-flex items-center gap-0.5 font-semibold text-green-700">
              <IndianRupee className="w-3 h-3" /> {program.registration_fee}
            </span>
          )}
          {!isPaid && <span className="font-semibold text-slate-500">Free</span>}
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Registration Type Selector */}
        {program.participation_type === 'BOTH' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Registration Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRegType('INDIVIDUAL')}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  regType === 'INDIVIDUAL' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <User className={`w-5 h-5 mx-auto mb-1 ${regType === 'INDIVIDUAL' ? 'text-blue-600' : 'text-slate-400'}`} />
                <p className="text-xs font-semibold text-slate-900">Individual</p>
              </button>
              <button
                type="button"
                onClick={() => setRegType('TEAM')}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  regType === 'TEAM' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Users className={`w-5 h-5 mx-auto mb-1 ${regType === 'TEAM' ? 'text-purple-600' : 'text-slate-400'}`} />
                <p className="text-xs font-semibold text-slate-900">Team</p>
              </button>
            </div>
          </div>
        )}

        {/* Participant / Leader Info */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {regType === 'TEAM' ? 'Team Leader / Contact' : 'Participant Details'}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Full Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Enter full name"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Student ID / Roll No</label>
              <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="e.g. 2024CSE001"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@example.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mobile Number</label>
              <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="10-digit mobile"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Branch / Department</label>
              <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="e.g. CSE, ECE"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Semester</label>
              <input type="text" value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="e.g. 4th Sem"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </fieldset>

        {/* Team Section */}
        {regType === 'TEAM' && (
          <fieldset className="space-y-3">
            <legend className="text-xs font-bold text-slate-700 uppercase tracking-wider">Team Details</legend>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Team Name *</label>
              <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Enter team name"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">
                Team Members ({members.length})
                <span className="text-slate-400 font-normal ml-1">
                  (Min: {minTeam}, Max: {maxTeam})
                </span>
              </p>
              <button
                type="button"
                onClick={addMember}
                disabled={members.length >= maxTeam}
                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200 disabled:opacity-50"
              >
                <Plus className="w-3 h-3" /> Add Member
              </button>
            </div>

            <div className="space-y-2">
              {members.map((m, idx) => (
                <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-500">Member {idx + 1}</span>
                    {members.length > 1 && (
                      <button type="button" onClick={() => removeMember(idx)} className="p-1 hover:bg-red-100 text-red-400 rounded-lg">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input type="text" value={m.member_name} onChange={(e) => updateMember(idx, 'member_name', e.target.value)} placeholder="Full Name *"
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <input type="text" value={m.student_id || ''} onChange={(e) => updateMember(idx, 'student_id', e.target.value)} placeholder="Student ID"
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <input type="email" value={m.email || ''} onChange={(e) => updateMember(idx, 'email', e.target.value)} placeholder="Email"
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <input type="tel" value={m.mobile || ''} onChange={(e) => updateMember(idx, 'mobile', e.target.value)} placeholder="Mobile"
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <input type="text" value={m.branch || ''} onChange={(e) => updateMember(idx, 'branch', e.target.value)} placeholder="Branch"
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <input type="text" value={m.semester || ''} onChange={(e) => updateMember(idx, 'semester', e.target.value)} placeholder="Semester"
                      className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        )}

        {/* Payment */}
        {isPaid && (
          <fieldset className="space-y-3">
            <legend className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment</legend>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-2">
              <p className="text-xs font-semibold text-amber-800">
                Registration Fee: <span className="text-base font-bold">₹{program.registration_fee}</span>
              </p>
              {event.payment_upi_id && (
                <p className="text-xs text-amber-700">UPI ID: <span className="font-mono font-semibold">{event.payment_upi_id}</span></p>
              )}
              {event.payment_qr_url && (
                <div className="mt-2">
                  <p className="text-xs text-amber-700 mb-1">Scan QR to pay:</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={event.payment_qr_url} alt="Payment QR" className="w-40 h-40 object-contain rounded-lg border border-amber-300 bg-white p-1" />
                </div>
              )}
              {event.payment_instructions && (
                <p className="text-[11px] text-amber-700">{event.payment_instructions}</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Transaction / Reference ID</label>
              <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Enter UPI/transaction reference"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </fieldset>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Registering...</>
          ) : (
            <><CheckCircle2 className="w-4 h-4" /> Complete Registration</>
          )}
        </button>
      </div>
    </form>
  );
}
