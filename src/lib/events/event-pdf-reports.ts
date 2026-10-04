import PDFDocument from 'pdfkit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getEventRegistrations, resolveEventRegistrationSpreadsheet, type MasterRegistrationRow } from '@/lib/google/event-registration-sheets';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { formatSemesterDisplay, formatBranchDisplay } from '@/lib/events/academic-formatter';
import type { CollegeEvent, EventRegistration, EventStats, GoogleFormParticipantResponse } from '@/types/events';
import type { EventProgram } from '@/types/programs';

// ============================================================
// COLOR PALETTE & STYLES (Print-ready professional navy/slate)
// ============================================================

export const PDF_COLORS = {
  primary: '#0B192C',       // Official Dark Navy
  secondary: '#1E3E62',     // Slate Navy
  accent: '#2563EB',        // Royal Blue
  slateDark: '#0F172A',     // Primary text
  slateText: '#334155',     // Body text
  slateMuted: '#64748B',    // Subtitles & metadata
  border: '#CBD5E1',        // Table & card borders
  borderLight: '#E2E8F0',   // Hairline dividers
  bgLight: '#F8FAFC',       // Card background
  bgAlt: '#F1F5F9',         // Alternating table row
  white: '#FFFFFF',
  success: '#059669',       // Verified / Confirmed
  warning: '#D97706',       // Pending / Submitted
  danger: '#DC2626',        // Rejected / Cancelled
  leaderBg: '#FEF3C7',      // Amber badge for leader
  leaderText: '#92400E',
  memberBg: '#E0E7FF',      // Indigo badge for member
  memberText: '#3730A3',
};

// ============================================================
// DATA TYPES
// ============================================================

export interface CollegeMetadata {
  id: string;
  name: string;
  code: string;
  slug: string;
  logo_url?: string | null;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

export interface ReportParticipant {
  eventRegNumber: string;        // e.g. TECHFES-E001
  programRegNumber: string;      // e.g. TECHFES-TAB-001
  name: string;
  studentId: string;             // Roll / Student ID
  email: string;
  mobile: string;
  branch: string;
  semester: string;
  gender: string;
  role: 'TEAM LEADER' | 'TEAM MEMBER' | 'INDIVIDUAL';
  teamId?: string;
  teamName?: string;
  paymentRequired: boolean;
  paymentAmount: number;
  paymentStatus: string;         // 'VERIFIED', 'PENDING', 'NOT_REQUIRED', etc.
  paymentReference?: string;
  registrationStatus: string;    // 'CONFIRMED', 'REGISTERED', 'CANCELLED'
  registeredAt: string;
}

export interface ReportTeam {
  teamId: string;
  teamName: string;
  leader: ReportParticipant;
  members: ReportParticipant[];
  teamSize: number;
  minTeamSize?: number | null;
  maxTeamSize?: number | null;
  status: string;
  paymentStatus: string;
  paymentAmount: number;
  paymentReference?: string;
}

export interface ProgramReportData {
  college: CollegeMetadata;
  event: CollegeEvent;
  program: EventProgram & { category?: { id: string; name: string } | null };
  teams: ReportTeam[];
  individuals: ReportParticipant[];
  allParticipants: ReportParticipant[];
  stats: {
    totalTeams: number;
    totalTeamParticipants: number;
    totalIndividualParticipants: number;
    totalParticipants: number; // team participants + individual participants
    averageTeamSize: string;
    verifiedRevenue: number;
    pendingRevenue: number;
  };
}

export interface EventReportData {
  college: CollegeMetadata;
  event: CollegeEvent;
  categories: { id: string; name: string }[];
  programs: (EventProgram & {
    category?: { id: string; name: string } | null;
    reportData: ProgramReportData;
  })[];
  stats: {
    totalCategories: number;
    totalPrograms: number;
    totalTeams: number;
    totalIndividualParticipants: number;
    totalTeamParticipants: number;
    totalParticipants: number;
    totalRevenue: number;
  };
}

// ============================================================
// STREAM & LOGO HELPERS
// ============================================================

export function streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export async function fetchLogoBuffer(url?: string | null): Promise<Buffer | null> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

// Safe formatting for currencies to avoid PDFKit WinAnsiEncoding glitches
export function formatCurrency(amount: number): string {
  if (!amount || amount <= 0) return 'Free';
  return `INR ${amount.toLocaleString('en-IN')}`;
}

export function formatDateTime(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ============================================================
// DATA FETCHING & AUTHORITATIVE COMPILATION
// ============================================================

async function getDb() {
  return createAdminClient() || await createClient();
}

/**
 * Fetch and assemble authoritative data for a specific program report.
 * Uses Google Sheets as the single source of truth, cross-referencing
 * EVENT_REGISTRATIONS master rows to map students' event reg numbers.
 */
export async function getAuthoritativeProgramReportData(params: {
  collegeId: string;
  eventId: string;
  programId: string;
}): Promise<ProgramReportData | null> {
  const { collegeId, eventId, programId } = params;
  const db = await getDb();

  // 1. Fetch Event with College
  const { data: event, error: eventErr } = await db
    .from('events')
    .select('*, college:colleges(*)')
    .eq('id', eventId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (eventErr || !event) {
    console.error('[getAuthoritativeProgramReportData] Event not found:', eventErr?.message);
    return null;
  }

  // 2. Fetch Program with Category
  const { data: program, error: progErr } = await db
    .from('event_programs')
    .select('*, category:event_categories(id, name)')
    .eq('id', programId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (progErr || !program) {
    console.error('[getAuthoritativeProgramReportData] Program not found:', progErr?.message);
    return null;
  }

  const college: CollegeMetadata = {
    id: event.college?.id || collegeId,
    name: event.college?.name || 'Institution',
    code: event.college?.code || 'COLLEGE',
    slug: event.college?.slug || '',
    logo_url: event.college?.logo_url || null,
    address: event.college?.address || null,
    contact_email: event.college?.contact_email || null,
    contact_phone: event.college?.contact_phone || null,
    website_url: event.college?.website_url || null,
    primary_color: event.college?.primary_color || PDF_COLORS.primary,
    secondary_color: event.college?.secondary_color || PDF_COLORS.secondary,
  };

  // 3. Resolve Academic Masters for clean Branch & Semester lookup
  const branchLookup = new Map<string, string>();
  const semesterLookup = new Map<string, string>();
  try {
    const academic = await getCachedAcademicMasters(collegeId);
    for (const b of academic.branches || []) {
      const label = b.code || b.name;
      branchLookup.set(b.id, label);
      branchLookup.set(b.code.toUpperCase(), label);
    }
    for (const s of academic.semesters || []) {
      const label = formatSemesterDisplay(s.semester_number);
      semesterLookup.set(s.id, label);
      semesterLookup.set(String(s.semester_number), label);
    }
  } catch {
    // Non-fatal fallback
  }

  const resolveBranch = (val?: string | null): string => {
    if (!val) return '—';
    const clean = val.trim();
    if (branchLookup.has(clean)) return branchLookup.get(clean)!;
    return formatBranchDisplay(clean) || clean;
  };

  const resolveSemester = (val?: string | null): string => {
    if (!val) return '—';
    const clean = val.trim();
    if (semesterLookup.has(clean)) return semesterLookup.get(clean)!;
    return formatSemesterDisplay(clean) || clean;
  };

  // 4. Read authoritative Google Sheet registrations
  let masterRows: MasterRegistrationRow[] = [];
  try {
    const sheetId = event.registration_sheet_id || await resolveEventRegistrationSpreadsheet(collegeId, event.id, event.title);
    if (sheetId) {
      masterRows = await getEventRegistrations(collegeId, sheetId);
    }
  } catch (err) {
    console.warn('[getAuthoritativeProgramReportData] Google Sheets read warning:', err);
  }

  // 5. Index base event registrations (where programId is empty)
  // to resolve the student's Event Registration Number (e.g. TECHFES-E001)
  const baseRegs = masterRows.filter(r => r.programId === '' && r.registrationStatus !== 'CANCELLED');
  const baseStudentIdMap = new Map<string, string>();
  const baseEmailMap = new Map<string, string>();
  const baseRegNumMap = new Map<string, string>();

  for (const b of baseRegs) {
    if (b.studentId) baseStudentIdMap.set(b.studentId.trim().toUpperCase(), b.registrationNumber);
    if (b.email) baseEmailMap.set(b.email.trim().toLowerCase(), b.registrationNumber);
    if (b.registrationNumber) baseRegNumMap.set(b.registrationNumber.trim().toUpperCase(), b.registrationNumber);
  }

  // Helper to resolve student's event reg number
  const resolveEventRegNo = (r: { studentId?: string; email?: string; teamLeaderRegistrationNumber?: string; registrationNumber?: string }): string => {
    if (r.studentId && baseStudentIdMap.has(r.studentId.trim().toUpperCase())) {
      return baseStudentIdMap.get(r.studentId.trim().toUpperCase())!;
    }
    if (r.email && baseEmailMap.has(r.email.trim().toLowerCase())) {
      return baseEmailMap.get(r.email.trim().toLowerCase())!;
    }
    if (r.teamLeaderRegistrationNumber?.trim()) {
      return r.teamLeaderRegistrationNumber.trim();
    }
    return r.registrationNumber || '—';
  };

  // 6. Filter program rows from Google Sheet
  const cleanProgId = program.id;
  const cleanProgSlug = program.slug?.toLowerCase();
  const cleanProgName = program.name?.toLowerCase();

  const progRows = masterRows.filter(r => {
    if (r.registrationStatus === 'CANCELLED') return false;
    const matchesId = r.programId && r.programId === cleanProgId;
    const matchesName = r.programName && (r.programName.toLowerCase() === cleanProgName || r.programName.toLowerCase() === cleanProgSlug);
    return matchesId || matchesName;
  });

  const allParticipants: ReportParticipant[] = [];
  const teamMap = new Map<string, ReportTeam>();
  const individuals: ReportParticipant[] = [];

  let verifiedRevenue = 0;
  let pendingRevenue = 0;

  if (progRows.length > 0) {
    // Process Google Sheet rows
    for (const r of progRows) {
      const eventRegNumber = resolveEventRegNo(r);
      const isPaid = r.paymentStatus === 'PAID' || r.paymentStatus === 'VERIFIED';
      const isPending = r.paymentStatus === 'PENDING' || r.paymentStatus === 'SUBMITTED';
      const amount = Number(r.paymentAmount || 0);

      if (isPaid) verifiedRevenue += amount;
      else if (isPending) pendingRevenue += amount;

      const isTeam = r.participationType === 'TEAM' || !!r.teamId;
      const roleStr = r.participantRole?.toUpperCase() || '';
      const role: 'TEAM LEADER' | 'TEAM MEMBER' | 'INDIVIDUAL' = isTeam
        ? (roleStr.includes('LEADER') ? 'TEAM LEADER' : 'TEAM MEMBER')
        : 'INDIVIDUAL';

      const participant: ReportParticipant = {
        eventRegNumber,
        programRegNumber: r.registrationNumber,
        name: r.participantName || 'Participant',
        studentId: r.studentId || '—',
        email: r.email || '—',
        mobile: r.mobile || '—',
        branch: resolveBranch(r.branch),
        semester: resolveSemester(r.semester),
        gender: r.gender || '—',
        role,
        teamId: r.teamId || undefined,
        teamName: r.teamName || undefined,
        paymentRequired: r.paymentRequired === 'YES' || (event.payment_required && program.registration_fee > 0),
        paymentAmount: amount,
        paymentStatus: r.paymentStatus || (program.registration_fee > 0 ? 'PENDING' : 'NOT_REQUIRED'),
        paymentReference: r.paymentReference || undefined,
        registrationStatus: r.registrationStatus || 'CONFIRMED',
        registeredAt: r.registeredAt || new Date().toISOString(),
      };

      allParticipants.push(participant);

      if (isTeam) {
        const teamKey = (r.teamId || r.teamName || 'TEAM').trim().toUpperCase();
        if (!teamMap.has(teamKey)) {
          teamMap.set(teamKey, {
            teamId: r.teamId || teamKey,
            teamName: r.teamName || 'Team',
            leader: participant, // Temporary, will be set below
            members: [],
            teamSize: 0,
            minTeamSize: program.min_team_size,
            maxTeamSize: program.max_team_size,
            status: r.registrationStatus || 'CONFIRMED',
            paymentStatus: r.paymentStatus || 'NOT_REQUIRED',
            paymentAmount: amount,
            paymentReference: r.paymentReference || undefined,
          });
        }
        const t = teamMap.get(teamKey)!;
        t.members.push(participant);
        t.teamSize = t.members.length;
        if (role === 'TEAM LEADER' || !t.leader) {
          t.leader = participant;
        }
      } else {
        individuals.push(participant);
      }
    }
  } else {
    // 7. Fallback to Supabase program_registrations if sheet returned 0 program rows
    const { data: dbRegs } = await db
      .from('program_registrations')
      .select('*, members:program_registration_members(*)')
      .eq('program_id', program.id)
      .eq('college_id', collegeId)
      .neq('registration_status', 'CANCELLED');

    for (const r of dbRegs || []) {
      const amount = Number(r.payment_amount || 0);
      if (r.payment_status === 'VERIFIED') verifiedRevenue += amount;
      else if (r.payment_status === 'PENDING' || r.payment_status === 'SUBMITTED') pendingRevenue += amount;

      if (r.registration_type === 'TEAM') {
        const teamMembers: ReportParticipant[] = [];
        const dbMembers = (r.members || []).sort((a: any) => (a.is_leader ? -1 : 1));

        for (const m of dbMembers) {
          const p: ReportParticipant = {
            eventRegNumber: m.event_registration_number || r.registration_number,
            programRegNumber: r.registration_number,
            name: m.member_name || r.participant_name,
            studentId: m.student_id || r.student_id || '—',
            email: m.email || r.email || '—',
            mobile: m.mobile || r.mobile || '—',
            branch: resolveBranch(m.branch || r.branch),
            semester: resolveSemester(m.semester || r.semester),
            gender: '—',
            role: m.is_leader ? 'TEAM LEADER' : 'TEAM MEMBER',
            teamId: r.registration_number,
            teamName: r.team_name || 'Team',
            paymentRequired: program.registration_fee > 0,
            paymentAmount: amount,
            paymentStatus: r.payment_status,
            paymentReference: r.payment_reference,
            registrationStatus: r.registration_status,
            registeredAt: r.registered_at,
          };
          teamMembers.push(p);
          allParticipants.push(p);
        }

        const leader = teamMembers.find(m => m.role === 'TEAM LEADER') || teamMembers[0];
        teamMap.set(r.registration_number, {
          teamId: r.registration_number,
          teamName: r.team_name || 'Team',
          leader,
          members: teamMembers,
          teamSize: teamMembers.length,
          minTeamSize: program.min_team_size,
          maxTeamSize: program.max_team_size,
          status: r.registration_status,
          paymentStatus: r.payment_status,
          paymentAmount: amount,
          paymentReference: r.payment_reference,
        });
      } else {
        const p: ReportParticipant = {
          eventRegNumber: r.registration_number,
          programRegNumber: r.registration_number,
          name: r.participant_name,
          studentId: r.student_id || '—',
          email: r.email || '—',
          mobile: r.mobile || '—',
          branch: resolveBranch(r.branch),
          semester: resolveSemester(r.semester),
          gender: r.gender || '—',
          role: 'INDIVIDUAL',
          paymentRequired: program.registration_fee > 0,
          paymentAmount: amount,
          paymentStatus: r.payment_status,
          paymentReference: r.payment_reference,
          registrationStatus: r.registration_status,
          registeredAt: r.registered_at,
        };
        individuals.push(p);
        allParticipants.push(p);
      }
    }
  }

  // Ensure every team has leader placed FIRST in its members array
  for (const team of teamMap.values()) {
    if (team.leader) {
      team.members = [team.leader, ...team.members.filter(m => m !== team.leader)];
    }
  }

  const teams = Array.from(teamMap.values());
  const totalTeamParticipants = teams.reduce((sum, t) => sum + t.members.length, 0);
  const totalIndividualParticipants = individuals.length;
  const totalParticipants = totalTeamParticipants + totalIndividualParticipants;
  const averageTeamSize = teams.length > 0 ? (totalTeamParticipants / teams.length).toFixed(1) : '0';

  return {
    college,
    event,
    program,
    teams,
    individuals,
    allParticipants,
    stats: {
      totalTeams: teams.length,
      totalTeamParticipants,
      totalIndividualParticipants,
      totalParticipants,
      averageTeamSize,
      verifiedRevenue,
      pendingRevenue,
    },
  };
}

/**
 * Fetch and assemble authoritative event-level data across all programs.
 */
export async function getAuthoritativeEventReportData(params: {
  collegeId: string;
  eventId: string;
}): Promise<EventReportData | null> {
  const { collegeId, eventId } = params;
  const db = await getDb();

  const { data: event } = await db
    .from('events')
    .select('*, college:colleges(*)')
    .eq('id', eventId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (!event) return null;

  const { data: categories } = await db
    .from('event_categories')
    .select('id, name')
    .eq('event_id', event.id)
    .eq('college_id', collegeId)
    .order('display_order', { ascending: true });

  const { data: programs } = await db
    .from('event_programs')
    .select('*, category:event_categories(id, name)')
    .eq('event_id', event.id)
    .eq('college_id', collegeId)
    .order('display_order', { ascending: true });

  const college: CollegeMetadata = {
    id: event.college?.id || collegeId,
    name: event.college?.name || 'Institution',
    code: event.college?.code || 'COLLEGE',
    slug: event.college?.slug || '',
    logo_url: event.college?.logo_url || null,
    address: event.college?.address || null,
    contact_email: event.college?.contact_email || null,
    contact_phone: event.college?.contact_phone || null,
    website_url: event.college?.website_url || null,
    primary_color: event.college?.primary_color || PDF_COLORS.primary,
    secondary_color: event.college?.secondary_color || PDF_COLORS.secondary,
  };

  const programReports: (EventProgram & {
    category?: { id: string; name: string } | null;
    reportData: ProgramReportData;
  })[] = [];

  for (const prog of programs || []) {
    const reportData = await getAuthoritativeProgramReportData({
      collegeId,
      eventId,
      programId: prog.id,
    });
    if (reportData) {
      programReports.push({
        ...prog,
        reportData,
      });
    }
  }

  let totalTeams = 0;
  let totalIndividualParticipants = 0;
  let totalTeamParticipants = 0;
  let totalRevenue = 0;

  for (const p of programReports) {
    totalTeams += p.reportData.stats.totalTeams;
    totalIndividualParticipants += p.reportData.stats.totalIndividualParticipants;
    totalTeamParticipants += p.reportData.stats.totalTeamParticipants;
    totalRevenue += p.reportData.stats.verifiedRevenue;
  }

  const totalParticipants = totalTeamParticipants + totalIndividualParticipants;

  return {
    college,
    event,
    categories: categories || [],
    programs: programReports,
    stats: {
      totalCategories: (categories || []).length,
      totalPrograms: programReports.length,
      totalTeams,
      totalIndividualParticipants,
      totalTeamParticipants,
      totalParticipants,
      totalRevenue,
    },
  };
}

// ============================================================
// COMMON OFFICIAL COLLEGE HEADER RENDERER
// ============================================================

export interface RenderHeaderOptions {
  college: CollegeMetadata;
  event: CollegeEvent;
  program?: { name: string; participation_type?: string; registration_fee?: number; category?: { name?: string } | null } | null;
  reportTitle: string;
  reportSubtitle?: string;
  logoBuffer?: Buffer | null;
}

export function renderOfficialHeader(
  doc: PDFKit.PDFDocument,
  options: RenderHeaderOptions
): number {
  const { college, event, program, reportTitle, reportSubtitle, logoBuffer } = options;
  const margin = 36;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - margin * 2;
  const isLandscape = pageWidth > pageHeight;

  let y = margin;

  // Outer container border with subtle shadow background
  // Portrait requires 94pt to comfortably display 4-5 lines of college details without any clipping
  const headerH = isLandscape ? 82 : 94;
  doc.rect(margin, y, contentWidth, headerH).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);

  // Left: College Logo or Crisp Monogram
  const logoBoxSize = isLandscape ? 54 : 50;
  const logoX = margin + 10;
  const logoY = y + Math.floor((headerH - logoBoxSize) / 2);

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, logoX, logoY, {
        fit: [logoBoxSize, logoBoxSize],
        align: 'center',
        valign: 'center',
      });
    } catch {
      // Fallback monogram
      doc.rect(logoX, logoY, logoBoxSize, logoBoxSize).fill(college.primary_color || PDF_COLORS.primary);
      doc.fillColor(PDF_COLORS.white).fontSize(14).font('Helvetica-Bold')
        .text((college.code || 'COL').slice(0, 4), logoX, logoY + 18, { width: logoBoxSize, align: 'center' });
    }
  } else {
    doc.rect(logoX, logoY, logoBoxSize, logoBoxSize).fill(college.primary_color || PDF_COLORS.primary);
    doc.fillColor(PDF_COLORS.white).fontSize(14).font('Helvetica-Bold')
      .text((college.code || 'COL').slice(0, 4), logoX, logoY + 18, { width: logoBoxSize, align: 'center' });
  }

  // Right Block: Report Title Badge & Generation Time
  // Placed first with strictly bounded coordinates so it NEVER overlaps middle college text
  const badgeWidth = isLandscape ? 210 : 160;
  const badgeX = margin + contentWidth - badgeWidth - 8;
  const badgeY = y + 8;
  const badgeHeight = headerH - 16;

  doc.rect(badgeX, badgeY, badgeWidth, badgeHeight).fillAndStroke(PDF_COLORS.white, PDF_COLORS.border);

  const titleFontSize = isLandscape ? 9.5 : 8.5;
  doc.font('Helvetica-Bold').fontSize(titleFontSize).fillColor(PDF_COLORS.primary)
    .text(reportTitle.toUpperCase(), badgeX + 4, badgeY + 8, { width: badgeWidth - 8, align: 'center', ellipsis: true });

  if (reportSubtitle) {
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.secondary)
      .text(reportSubtitle, badgeX + 4, badgeY + 23, { width: badgeWidth - 8, align: 'center', ellipsis: true });
  }

  const generatedTimeStr = formatDateTime(new Date());
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted)
    .text(`Generated: ${generatedTimeStr}`, badgeX + 4, badgeY + badgeHeight - 15, { width: badgeWidth - 8, align: 'center' });

  // Middle: College Details (Strictly bounded between logo and right badge)
  const collegeTextX = logoX + logoBoxSize + 10;
  const collegeColWidth = badgeX - collegeTextX - 10;

  const collegeNameFontSize = isLandscape ? 13 : 11;
  doc.font('Helvetica-Bold').fontSize(collegeNameFontSize).fillColor(college.primary_color || PDF_COLORS.primary)
    .text(college.name.toUpperCase(), collegeTextX, y + 8, { width: collegeColWidth, ellipsis: true });

  const codeAndAffil = [
    college.code ? college.code.toUpperCase() : null,
    'Official Event Registration Roster',
  ].filter(Boolean).join('  •  ');

  doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.secondary)
    .text(codeAndAffil, collegeTextX, y + 24, { width: collegeColWidth, ellipsis: true });

  // Address & Contacts (Gracefully separated and spaced)
  let textCursorY = y + 37;
  if (college.address) {
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateMuted)
      .text(college.address, collegeTextX, textCursorY, { width: collegeColWidth, ellipsis: true });
    textCursorY += 12;
  }

  const contactItems: string[] = [];
  if (college.contact_phone) contactItems.push(`Phone: ${college.contact_phone}`);
  if (college.contact_email) contactItems.push(`Email: ${college.contact_email}`);

  if (isLandscape) {
    if (college.website_url) contactItems.push(`Web: ${college.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}`);
    if (contactItems.length > 0) {
      doc.font('Helvetica').fontSize(7).fillColor(PDF_COLORS.slateMuted)
        .text(contactItems.join('  |  '), collegeTextX, textCursorY, { width: collegeColWidth, ellipsis: true });
    }
  } else {
    // In portrait mode: line 1 for Phone & Email, line 2 for Web so nothing ever clips or wraps awkwardly
    if (contactItems.length > 0) {
      doc.font('Helvetica').fontSize(7).fillColor(PDF_COLORS.slateMuted)
        .text(contactItems.join('  |  '), collegeTextX, textCursorY, { width: collegeColWidth, ellipsis: true });
      textCursorY += 10;
    }
    if (college.website_url) {
      doc.font('Helvetica').fontSize(7).fillColor(PDF_COLORS.slateMuted)
        .text(`Web: ${college.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}`, collegeTextX, textCursorY, { width: collegeColWidth, ellipsis: true });
    }
  }

  y += headerH + 6;

  // Metadata Strip: Event, Program, Category, Dates, Venue, Status
  doc.rect(margin, y, contentWidth, 32).fillAndStroke(PDF_COLORS.secondary, PDF_COLORS.secondary);

  const col1W = Math.floor(contentWidth * 0.40);
  const col2W = Math.floor(contentWidth * 0.35);
  const col3W = contentWidth - col1W - col2W;

  // Col 1: EVENT & Program
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.white)
    .text(`EVENT: ${event.title.toUpperCase()}`, margin + 10, y + 6, { width: col1W - 12, ellipsis: true });

  const progCategory = program?.category?.name ? ` [${program.category.name.toUpperCase()}]` : '';
  const progLine = program ? `Program: ${program.name}${progCategory}` : `Dates: ${formatDate(event.start_at)} — ${formatDate(event.end_at)}`;
  doc.font('Helvetica').fontSize(7.5).fillColor('#CBD5E1')
    .text(progLine, margin + 10, y + 19, { width: col1W - 12, ellipsis: true });

  // Col 2: Venue & Dates
  const dateRangeStr = `${formatDate(event.start_at)} — ${formatDate(event.end_at)}`;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.white)
    .text(`Venue: ${event.venue || 'Campus'}`, margin + col1W + 6, y + 6, { width: col2W - 12, ellipsis: true });
  doc.font('Helvetica').fontSize(7).fillColor('#CBD5E1')
    .text(`Event Dates: ${dateRangeStr}`, margin + col1W + 6, y + 19, { width: col2W - 12, ellipsis: true });

  // Col 3: Registration Status & Fee
  const isRegClosed = new Date() > new Date(event.registration_end);
  const statusStr = event.status === 'PUBLISHED' ? (isRegClosed ? 'REGISTRATION CLOSED' : 'REGISTRATION OPEN') : event.status;
  const feeStr = program ? (program.registration_fee && program.registration_fee > 0 ? `Fee: INR ${program.registration_fee}` : 'Fee: FREE') : '';

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(isRegClosed ? '#FCA5A5' : '#86EFAC')
    .text(statusStr, margin + col1W + col2W + 6, y + 6, { width: col3W - 12, align: 'right', ellipsis: true });
  if (feeStr) {
    doc.font('Helvetica').fontSize(7).fillColor('#CBD5E1')
      .text(feeStr, margin + col1W + col2W + 6, y + 19, { width: col3W - 12, align: 'right' });
  }

  y += 38;
  return y;
}

export function renderOfficialSignatureBlock(
  doc: PDFKit.PDFDocument,
  currentY: number
): number {
  const margin = 36;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - margin * 2;
  const blockHeight = 44;

  let y = currentY;
  // Ensure the signature block has enough room before the page footer
  if (y + blockHeight > pageHeight - margin - 35) {
    doc.addPage();
    y = margin + 14;
  } else {
    y += 14;
  }

  const sigLineWidth = 180;

  // Left signature line: Organizing Committee / Convener
  const leftX = margin + 8;
  doc.moveTo(leftX, y + 18).lineTo(leftX + sigLineWidth, y + 18)
    .strokeColor(PDF_COLORS.border).lineWidth(0.8).stroke();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.slateDark)
    .text('Organizing Committee / Convener', leftX, y + 22, { width: sigLineWidth, align: 'center' });
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted)
    .text('Verified Official Record', leftX, y + 32, { width: sigLineWidth, align: 'center' });

  // Right signature line: Event Coordinator / Faculty In-Charge
  const rightX = margin + contentWidth - sigLineWidth - 8;
  doc.moveTo(rightX, y + 18).lineTo(rightX + sigLineWidth, y + 18)
    .strokeColor(PDF_COLORS.border).lineWidth(0.8).stroke();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.slateDark)
    .text('Event Coordinator / Faculty In-Charge', rightX, y + 22, { width: sigLineWidth, align: 'center' });
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted)
    .text('Authorized Signature & Seal', rightX, y + 32, { width: sigLineWidth, align: 'center' });

  return y + blockHeight;
}

export function renderOfficialFooter(doc: PDFKit.PDFDocument, collegeName: string) {
  const range = doc.bufferedPageRange();
  const margin = 36;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - margin * 2;

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Hairline divider above footer
    doc.moveTo(margin, pageHeight - 28).lineTo(margin + contentWidth, pageHeight - 28)
      .strokeColor(PDF_COLORS.borderLight).lineWidth(0.5).stroke();

    doc.fillColor(PDF_COLORS.slateMuted).fontSize(7.5).font('Helvetica')
      .text(
        `Page ${i + 1} of ${range.count}   •   Generated by CampusFlow — ${collegeName}   •   Official College Record`,
        margin,
        pageHeight - 22,
        { width: contentWidth, align: 'center' }
      );
  }
}

// ============================================================
// REPORT 1: ALL TEAMS PDF (Program-Scoped)
// ============================================================

export async function generateProgramTeamsPDF(data: ProgramReportData): Promise<Buffer> {
  const { college, event, program, teams, stats } = data;
  const logoBuffer = await fetchLogoBuffer(college.logo_url);

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: 36,
    info: {
      Title: `All Teams — ${program.name}`,
      Author: `${college.name} Event Management`,
      Subject: 'Official Program Teams Roster',
    },
  });

  const bufferPromise = streamToBuffer(doc);
  const margin = 36;
  const pageWidth = doc.page.width; // 595.28 pt
  const pageHeight = doc.page.height; // 841.89 pt
  const contentWidth = pageWidth - margin * 2; // 523.28 pt

  let y = renderOfficialHeader(doc, {
    college,
    event,
    program,
    reportTitle: 'ALL TEAMS ROSTER',
    reportSubtitle: program.name,
    logoBuffer,
  });

  // Summary Metrics Bar
  const summaryBoxH = 34;
  const summaryItems = [
    { label: 'TOTAL TEAMS', val: String(stats.totalTeams) },
    { label: 'TEAM PARTICIPANTS', val: String(stats.totalTeamParticipants) },
    { label: 'AVERAGE TEAM SIZE', val: stats.averageTeamSize },
    { label: 'PROGRAM FEE', val: program.registration_fee > 0 ? `INR ${program.registration_fee}` : 'Free' },
  ];
  if (stats.verifiedRevenue > 0) {
    summaryItems.push({ label: 'CONFIRMED REVENUE', val: `INR ${stats.verifiedRevenue.toLocaleString('en-IN')}` });
  }

  const sBoxW = Math.floor(contentWidth / summaryItems.length);
  summaryItems.forEach((item, idx) => {
    const boxX = margin + idx * sBoxW;
    doc.rect(boxX, y, sBoxW - 4, summaryBoxH).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica').fontSize(6).fillColor(PDF_COLORS.slateMuted).text(item.label, boxX + 6, y + 4, { width: sBoxW - 12, ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(PDF_COLORS.primary).text(item.val, boxX + 6, y + 15, { width: sBoxW - 12, ellipsis: true });
  });

  y += summaryBoxH + 12;

  // Table Columns Definition (A4 Portrait - 523 pt total)
  const cols = [
    { label: '#', w: 22, align: 'center' as const },
    { label: 'Team ID & Status', w: 90, align: 'left' as const },
    { label: 'Team Name & Size', w: 110, align: 'left' as const },
    { label: 'Team Leader & ID', w: 120, align: 'left' as const },
    { label: 'Branch & Sem', w: 91, align: 'left' as const },
    { label: 'Leader Contact', w: 90, align: 'left' as const },
  ];

  const renderTableHeader = (currentY: number) => {
    doc.rect(margin, currentY, contentWidth, 20).fill(PDF_COLORS.primary);
    let colX = margin;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.white);
    for (const c of cols) {
      doc.text(c.label, colX + 4, currentY + 6, { width: c.w - 8, align: c.align });
      colX += c.w;
    }
    return currentY + 20;
  };

  if (teams.length === 0) {
    // Empty state
    doc.rect(margin, y, contentWidth, 40).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_COLORS.slateMuted)
      .text('No team registrations found for this program.', margin, y + 15, { width: contentWidth, align: 'center' });
  } else {
    y = renderTableHeader(y);
    const rowH = 28;

    teams.forEach((t, idx) => {
      if (y + rowH > pageHeight - margin - 45) {
        doc.addPage();
        y = margin;
        y = renderTableHeader(y);
      }

      const isEven = idx % 2 === 0;
      doc.rect(margin, y, contentWidth, rowH).fill(isEven ? PDF_COLORS.white : PDF_COLORS.bgLight);
      doc.moveTo(margin, y + rowH).lineTo(margin + contentWidth, y + rowH).strokeColor(PDF_COLORS.borderLight).lineWidth(0.5).stroke();

      let colX = margin;

      // 1. #
      doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark);
      doc.text(String(idx + 1), colX + 2, y + 9, { width: cols[0].w - 4, align: 'center' });
      colX += cols[0].w;

      // 2. Team ID & Status
      const statusColor = t.status === 'CONFIRMED' || t.status === 'REGISTERED' ? PDF_COLORS.success : PDF_COLORS.warning;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.primary).text(t.teamId, colX + 4, y + 4, { width: cols[1].w - 8, ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(statusColor).text(t.status, colX + 4, y + 15, { width: cols[1].w - 8, ellipsis: true });
      colX += cols[1].w;

      // 3. Team Name & Size
      const sizeStr = t.maxTeamSize ? `${t.teamSize}/${t.maxTeamSize} Members` : `${t.teamSize} Members`;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.primary).text(t.teamName, colX + 4, y + 4, { width: cols[2].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(sizeStr, colX + 4, y + 15, { width: cols[2].w - 8, ellipsis: true });
      colX += cols[2].w;

      // 4. Team Leader & ID
      const rollReg = t.leader ? (t.leader.studentId ? `ID: ${t.leader.studentId}` : (t.leader.eventRegNumber || '—')) : '—';
      doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.slateDark).text(t.leader?.name || '—', colX + 4, y + 4, { width: cols[3].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(rollReg, colX + 4, y + 15, { width: cols[3].w - 8, ellipsis: true });
      colX += cols[3].w;

      // 5. Branch & Sem
      doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark).text(t.leader?.branch || '—', colX + 4, y + 4, { width: cols[4].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(t.leader?.semester || '—', colX + 4, y + 15, { width: cols[4].w - 8, ellipsis: true });
      colX += cols[4].w;

      // 6. Leader Contact
      doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark).text(t.leader?.mobile || '—', colX + 4, y + 4, { width: cols[5].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text(t.leader?.email || '—', colX + 4, y + 15, { width: cols[5].w - 8, ellipsis: true, lineBreak: false });

      y += rowH;
    });
  }

  y = renderOfficialSignatureBlock(doc, y);
  renderOfficialFooter(doc, college.name);
  doc.end();
  return bufferPromise;
}

// ============================================================
// REPORT 2: INDIVIDUAL TEAM PDF
// ============================================================

export async function generateIndividualTeamPDF(data: ProgramReportData, targetTeamId: string): Promise<Buffer> {
  const { college, event, program, teams } = data;
  const logoBuffer = await fetchLogoBuffer(college.logo_url);

  // Locate requested team
  const cleanId = targetTeamId.trim().toUpperCase();
  const team = teams.find(t => t.teamId.toUpperCase() === cleanId || t.teamName.toUpperCase() === cleanId) || teams[0];

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: 36,
    info: {
      Title: `Team Registration — ${team ? team.teamName : 'Team'}`,
      Author: `${college.name} Event Management`,
      Subject: 'Official Team Registration Document',
    },
  });

  const bufferPromise = streamToBuffer(doc);
  const margin = 36;
  const pageWidth = doc.page.width; // 595.28 pt
  const pageHeight = doc.page.height; // 841.89 pt
  const contentWidth = pageWidth - margin * 2;

  let y = renderOfficialHeader(doc, {
    college,
    event,
    program,
    reportTitle: 'TEAM REGISTRATION RECORD',
    reportSubtitle: team ? `Team: ${team.teamName}` : 'Team Record',
    logoBuffer,
  });

  if (!team) {
    doc.rect(margin, y, contentWidth, 40).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(PDF_COLORS.danger)
      .text('Team record not found for the requested Team ID.', margin, y + 14, { width: contentWidth, align: 'center' });
    renderOfficialFooter(doc, college.name);
    doc.end();
    return bufferPromise;
  }

  // --- TEAM INFORMATION CARD ---
  const infoCardH = 98;
  doc.rect(margin, y, contentWidth, infoCardH).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);

  // Top header of info card
  doc.rect(margin, y, contentWidth, 18).fill(PDF_COLORS.secondary);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.white)
    .text('TEAM REGISTRATION INFORMATION', margin + 8, y + 5);

  const colW = Math.floor(contentWidth / 3);
  let cardY = y + 24;

  // Row 1: Team Essentials
  // Col 1: Team Name
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('TEAM NAME', margin + 10, cardY);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_COLORS.primary).text(team.teamName, margin + 10, cardY + 9, { width: colW - 16, ellipsis: true });

  // Col 2: Team ID
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('TEAM ID', margin + colW + 6, cardY);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_COLORS.primary).text(team.teamId, margin + colW + 6, cardY + 9, { width: colW - 16, ellipsis: true });

  // Col 3: Team Status
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('TEAM STATUS', margin + colW * 2 + 6, cardY);
  const statusColor = team.status === 'CONFIRMED' || team.status === 'REGISTERED' ? PDF_COLORS.success : PDF_COLORS.warning;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(statusColor).text(team.status, margin + colW * 2 + 6, cardY + 9);

  // Row 2: Team Leader Identity
  cardY += 24;
  // Col 1: Team Leader
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('TEAM LEADER', margin + 10, cardY);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.primary).text(team.leader?.name || '—', margin + 10, cardY + 8, { width: colW - 16, ellipsis: true });

  // Col 2: Leader Event Reg No
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('LEADER REGISTRATION NO.', margin + colW + 6, cardY);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.primary).text(team.leader?.eventRegNumber || '—', margin + colW + 6, cardY + 8, { width: colW - 16, ellipsis: true });

  // Col 3: Leader Student ID / Roll
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('LEADER STUDENT ID / ROLL', margin + colW * 2 + 6, cardY);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.primary).text(team.leader?.studentId || '—', margin + colW * 2 + 6, cardY + 8, { width: colW - 16, ellipsis: true });

  // Row 3: Leader Contact & Academic Info
  cardY += 24;
  // Col 1: Leader Mobile No.
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('LEADER MOBILE NO.', margin + 10, cardY);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.primary).text(team.leader?.mobile || '—', margin + 10, cardY + 8, { width: colW - 16, ellipsis: true });

  // Col 2: Leader Email
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('LEADER EMAIL', margin + colW + 6, cardY);
  doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark).text(team.leader?.email || '—', margin + colW + 6, cardY + 8, { width: colW - 16, ellipsis: true, lineBreak: false });

  // Col 3: Leader Branch & Semester
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('LEADER BRANCH & SEMESTER', margin + colW * 2 + 6, cardY);
  const semFormatted = team.leader?.semester ? ` (${team.leader.semester.replace(/Semester/i, 'Sem').trim()})` : '';
  const leaderBranchSem = team.leader ? `${team.leader.branch || '—'}${semFormatted}` : '—';
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.primary).text(leaderBranchSem, margin + colW * 2 + 6, cardY + 8, { width: colW - 16, ellipsis: true });

  y += infoCardH + 12;

  // --- TEAM MEMBERS SECTION HEADING ---
  doc.rect(margin, y, contentWidth, 16).fill(PDF_COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.white)
    .text(`OFFICIAL TEAM ROSTER (${team.members.length} MEMBERS)`, margin + 8, y + 4);

  y += 18;

  // Members Table Columns (A4 Portrait - 523 pt total)
  const mCols = [
    { label: '#', w: 22, align: 'center' as const },
    { label: 'Role', w: 70, align: 'center' as const },
    { label: 'Member Name & ID', w: 125, align: 'left' as const },
    { label: 'Branch & Semester', w: 110, align: 'left' as const },
    { label: 'Contact Details', w: 116, align: 'left' as const },
    { label: 'Status', w: 80, align: 'center' as const },
  ];

  const renderMemberHeader = (currentY: number) => {
    doc.rect(margin, currentY, contentWidth, 16).fill(PDF_COLORS.secondary);
    let colX = margin;
    doc.font('Helvetica-Bold').fontSize(7).fillColor(PDF_COLORS.white);
    for (const c of mCols) {
      doc.text(c.label, colX + 3, currentY + 5, { width: c.w - 6, align: c.align });
      colX += c.w;
    }
    return currentY + 16;
  };

  y = renderMemberHeader(y);
  const mRowH = 26;

  team.members.forEach((m, idx) => {
    if (y + mRowH > pageHeight - margin - 80) {
      doc.addPage();
      y = margin;
      y = renderMemberHeader(y);
    }

    const isLeader = m.role === 'TEAM LEADER';
    const isEven = idx % 2 === 0;
    doc.rect(margin, y, contentWidth, mRowH).fill(isLeader ? '#FFFBEB' : (isEven ? PDF_COLORS.white : PDF_COLORS.bgLight));
    doc.moveTo(margin, y + mRowH).lineTo(margin + contentWidth, y + mRowH).strokeColor(PDF_COLORS.borderLight).lineWidth(0.5).stroke();

    let colX = margin;

    // 1. #
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark);
    doc.text(String(idx + 1), colX + 2, y + 8, { width: mCols[0].w - 4, align: 'center' });
    colX += mCols[0].w;

    // 2. Role badge
    doc.rect(colX + 4, y + 5, mCols[1].w - 8, 16).fill(isLeader ? PDF_COLORS.leaderBg : PDF_COLORS.memberBg);
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(isLeader ? PDF_COLORS.leaderText : PDF_COLORS.memberText)
      .text(isLeader ? 'LEADER' : 'MEMBER', colX + 4, y + 9, { width: mCols[1].w - 8, align: 'center' });
    colX += mCols[1].w;

    // 3. Name & ID
    const idReg = [m.studentId ? `ID: ${m.studentId}` : null, m.eventRegNumber ? `Reg: ${m.eventRegNumber}` : null].filter(Boolean).join(' | ') || '—';
    doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.slateDark).text(m.name, colX + 4, y + 4, { width: mCols[2].w - 8, ellipsis: true });
    doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(idReg, colX + 4, y + 15, { width: mCols[2].w - 8, ellipsis: true });
    colX += mCols[2].w;

    // 4. Branch & Semester
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark).text(m.branch || '—', colX + 4, y + 4, { width: mCols[3].w - 8, ellipsis: true });
    doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(m.semester || '—', colX + 4, y + 15, { width: mCols[3].w - 8, ellipsis: true });
    colX += mCols[3].w;

    // 5. Contact Details
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark).text(m.mobile || '—', colX + 4, y + 4, { width: mCols[4].w - 8, ellipsis: true });
    doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text(m.email || '—', colX + 4, y + 15, { width: mCols[4].w - 8, ellipsis: true, lineBreak: false });
    colX += mCols[4].w;

    // 6. Status
    const mStatusColor = m.registrationStatus === 'CONFIRMED' || m.registrationStatus === 'REGISTERED' ? PDF_COLORS.success : PDF_COLORS.warning;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(mStatusColor).text(m.registrationStatus || team.status, colX + 2, y + 8, { width: mCols[5].w - 4, align: 'center' });

    y += mRowH;
  });

  y += 14;

  // --- BOTTOM METRICS & PAYMENT DETAILS ---
  if (y + 60 > pageHeight - margin - 30) {
    doc.addPage();
    y = margin;
  }

  const bottomCardH = 46;
  doc.rect(margin, y, contentWidth, bottomCardH).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);

  const bColW = Math.floor(contentWidth / 4);

  // Col 1: Members requirement
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('TEAM SIZE', margin + 8, y + 8);
  const minMaxStr = `${team.teamSize} member(s)` + (team.maxTeamSize ? ` (Min: ${team.minTeamSize || 1} / Max: ${team.maxTeamSize})` : '');
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.primary).text(minMaxStr, margin + 8, y + 19, { width: bColW - 12 });

  // Col 2: Registration Fee
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('REGISTRATION FEE', margin + bColW + 6, y + 8);
  const feeText = program.registration_fee > 0 ? `INR ${program.registration_fee}` : 'Free';
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.primary).text(feeText, margin + bColW + 6, y + 19);

  // Col 3: Payment Status
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('PAYMENT STATUS', margin + bColW * 2 + 6, y + 8);
  const pColor = team.paymentStatus === 'VERIFIED' || team.paymentStatus === 'PAID' ? PDF_COLORS.success : (program.registration_fee > 0 ? PDF_COLORS.warning : PDF_COLORS.slateDark);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(pColor).text(team.paymentStatus, margin + bColW * 2 + 6, y + 19);

  // Col 4: Payment Ref
  doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text('PAYMENT REFERENCE', margin + bColW * 3 + 6, y + 8);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.slateDark).text(team.paymentReference || 'NOT REQUIRED', margin + bColW * 3 + 6, y + 19, { width: bColW - 12, ellipsis: true });

  // Official Dual Sign-off Block (Organizing Committee & Event Coordinator / Faculty In-Charge)
  y += bottomCardH + 10;
  y = renderOfficialSignatureBlock(doc, y);

  renderOfficialFooter(doc, college.name);
  doc.end();
  return bufferPromise;
}

// ============================================================
// REPORT 3: ALL INDIVIDUAL PARTICIPANTS PDF
// ============================================================

export async function generateProgramIndividualsPDF(data: ProgramReportData): Promise<Buffer> {
  const { college, event, program, individuals, stats } = data;
  const logoBuffer = await fetchLogoBuffer(college.logo_url);

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: 36,
    info: {
      Title: `Individual Participants — ${program.name}`,
      Author: `${college.name} Event Management`,
      Subject: 'Individual Participants Roster',
    },
  });

  const bufferPromise = streamToBuffer(doc);
  const margin = 36;
  const pageWidth = doc.page.width; // 595.28 pt
  const pageHeight = doc.page.height; // 841.89 pt
  const contentWidth = pageWidth - margin * 2; // 523.28 pt

  let y = renderOfficialHeader(doc, {
    college,
    event,
    program,
    reportTitle: 'INDIVIDUAL PARTICIPANTS',
    reportSubtitle: program.name,
    logoBuffer,
  });

  // Summary Metrics Bar
  const summaryBoxH = 34;
  const summaryItems = [
    { label: 'INDIVIDUAL PARTICIPANTS', val: String(stats.totalIndividualParticipants) },
    { label: 'REGISTRATION TYPE', val: 'INDIVIDUAL ONLY' },
    { label: 'PROGRAM FEE', val: program.registration_fee > 0 ? `INR ${program.registration_fee}` : 'Free' },
  ];

  const sBoxW = Math.floor(contentWidth / summaryItems.length);
  summaryItems.forEach((item, idx) => {
    const boxX = margin + idx * sBoxW;
    doc.rect(boxX, y, sBoxW - 4, summaryBoxH).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica').fontSize(6).fillColor(PDF_COLORS.slateMuted).text(item.label, boxX + 6, y + 4, { width: sBoxW - 12, ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(PDF_COLORS.primary).text(item.val, boxX + 6, y + 15, { width: sBoxW - 12, ellipsis: true });
  });

  y += summaryBoxH + 12;

  if (individuals.length === 0) {
    // Elegant empty state callout
    doc.rect(margin, y, contentWidth, 48).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(PDF_COLORS.slateMuted)
      .text('No individual participants registered for this program.', margin, y + 18, { width: contentWidth, align: 'center' });
  } else {
    // Columns (A4 Portrait - 523 pt total)
    const cols = [
      { label: '#', w: 22, align: 'center' as const },
      { label: 'Registration Numbers', w: 88, align: 'left' as const },
      { label: 'Participant & ID', w: 125, align: 'left' as const },
      { label: 'Branch & Semester', w: 105, align: 'left' as const },
      { label: 'Contact Details', w: 100, align: 'left' as const },
      { label: 'Payment & Status', w: 83, align: 'center' as const },
    ];

    const renderTableHeader = (currentY: number) => {
      doc.rect(margin, currentY, contentWidth, 20).fill(PDF_COLORS.primary);
      let colX = margin;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.white);
      for (const c of cols) {
        doc.text(c.label, colX + 4, currentY + 6, { width: c.w - 8, align: c.align });
        colX += c.w;
      }
      return currentY + 20;
    };

    y = renderTableHeader(y);
    const rowH = 28;

    individuals.forEach((ind, idx) => {
      if (y + rowH > pageHeight - margin - 45) {
        doc.addPage();
        y = margin;
        y = renderTableHeader(y);
      }

      const isEven = idx % 2 === 0;
      doc.rect(margin, y, contentWidth, rowH).fill(isEven ? PDF_COLORS.white : PDF_COLORS.bgLight);
      doc.moveTo(margin, y + rowH).lineTo(margin + contentWidth, y + rowH).strokeColor(PDF_COLORS.borderLight).lineWidth(0.5).stroke();

      let colX = margin;

      // 1. #
      doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark);
      doc.text(String(idx + 1), colX + 2, y + 9, { width: cols[0].w - 4, align: 'center' });
      colX += cols[0].w;

      // 2. Reg Numbers (Event Reg & Prog Reg)
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.primary).text(ind.eventRegNumber || '—', colX + 4, y + 4, { width: cols[1].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(ind.programRegNumber || '—', colX + 4, y + 15, { width: cols[1].w - 8, ellipsis: true });
      colX += cols[1].w;

      // 3. Participant & ID
      doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.slateDark).text(ind.name, colX + 4, y + 4, { width: cols[2].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(ind.studentId ? `ID: ${ind.studentId}` : '—', colX + 4, y + 15, { width: cols[2].w - 8, ellipsis: true });
      colX += cols[2].w;

      // 4. Branch & Semester
      doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark).text(ind.branch || '—', colX + 4, y + 4, { width: cols[3].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(ind.semester || '—', colX + 4, y + 15, { width: cols[3].w - 8, ellipsis: true });
      colX += cols[3].w;

      // 5. Contact Details
      doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark).text(ind.mobile || '—', colX + 4, y + 4, { width: cols[4].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text(ind.email || '—', colX + 4, y + 15, { width: cols[4].w - 8, ellipsis: true, lineBreak: false });
      colX += cols[4].w;

      // 6. Payment & Status
      const pColor = ind.paymentStatus === 'VERIFIED' || ind.paymentStatus === 'PAID' ? PDF_COLORS.success : (ind.paymentStatus === 'NOT_REQUIRED' ? PDF_COLORS.slateMuted : PDF_COLORS.warning);
      const sColor = ind.registrationStatus === 'CONFIRMED' || ind.registrationStatus === 'REGISTERED' ? PDF_COLORS.success : PDF_COLORS.danger;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(pColor).text(ind.paymentStatus || 'FREE', colX + 2, y + 4, { width: cols[5].w - 4, align: 'center', ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(sColor).text(ind.registrationStatus || 'CONFIRMED', colX + 2, y + 15, { width: cols[5].w - 4, align: 'center', ellipsis: true });

      y += rowH;
    });
  }

  y = renderOfficialSignatureBlock(doc, y);
  renderOfficialFooter(doc, college.name);
  doc.end();
  return bufferPromise;
}

// ============================================================
// REPORT 4: COMPLETE PARTICIPANT REPORT (CONSOLIDATED)
// ============================================================

export async function generateProgramCompleteReportPDF(data: ProgramReportData): Promise<Buffer> {
  const { college, event, program, teams, individuals, stats } = data;
  const logoBuffer = await fetchLogoBuffer(college.logo_url);

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: 36,
    info: {
      Title: `Complete Participant Report — ${program.name}`,
      Author: `${college.name} Event Management`,
      Subject: 'Consolidated Participant Report',
    },
  });

  const bufferPromise = streamToBuffer(doc);
  const margin = 36;
  const pageWidth = doc.page.width; // 595.28 pt
  const pageHeight = doc.page.height; // 841.89 pt
  const contentWidth = pageWidth - margin * 2; // 523.28 pt

  let y = renderOfficialHeader(doc, {
    college,
    event,
    program,
    reportTitle: 'COMPLETE PARTICIPANT REPORT',
    reportSubtitle: program.name,
    logoBuffer,
  });

  // Top Consolidated Summary Cards
  const summaryBoxH = 34;
  const summaryItems = [
    { label: 'TOTAL TEAMS', val: String(stats.totalTeams) },
    { label: 'TEAM PARTICIPANTS', val: String(stats.totalTeamParticipants) },
    { label: 'INDIVIDUAL PARTICIPANTS', val: String(stats.totalIndividualParticipants) },
    { label: 'TOTAL PARTICIPANTS', val: String(stats.totalParticipants) },
  ];
  if (stats.verifiedRevenue > 0) {
    summaryItems.push({ label: 'CONFIRMED REVENUE', val: `INR ${stats.verifiedRevenue.toLocaleString('en-IN')}` });
  }

  const sBoxW = Math.floor(contentWidth / summaryItems.length);
  summaryItems.forEach((item, idx) => {
    const boxX = margin + idx * sBoxW;
    doc.rect(boxX, y, sBoxW - 4, summaryBoxH).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica').fontSize(6).fillColor(PDF_COLORS.slateMuted).text(item.label, boxX + 6, y + 4, { width: sBoxW - 12, ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(PDF_COLORS.primary).text(item.val, boxX + 6, y + 15, { width: sBoxW - 12, ellipsis: true });
  });

  y += summaryBoxH + 14;

  // ------------------------------------------------------------
  // SECTION A: ALL TEAMS
  // ------------------------------------------------------------
  const renderSectionHeader = (title: string, countLabel: string) => {
    if (y + 36 > pageHeight - margin - 35) {
      doc.addPage();
      y = margin;
    }
    doc.rect(margin, y, contentWidth, 18).fill(PDF_COLORS.secondary);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.white)
      .text(title.toUpperCase(), margin + 8, y + 5);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#CBD5E1')
      .text(countLabel, margin + contentWidth - 160, y + 5, { width: 152, align: 'right' });
    y += 20;
  };

  renderSectionHeader('SECTION A: ALL REGISTERED TEAMS', `Total Teams: ${teams.length}`);

  if (teams.length === 0) {
    doc.rect(margin, y, contentWidth, 24).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateMuted)
      .text('No team registrations recorded for this program.', margin, y + 8, { width: contentWidth, align: 'center' });
    y += 30;
  } else {
    // Teams Table (A4 Portrait - 523 pt total)
    const tCols = [
      { label: '#', w: 22, align: 'center' as const },
      { label: 'Team ID & Status', w: 90, align: 'left' as const },
      { label: 'Team Name & Size', w: 110, align: 'left' as const },
      { label: 'Team Leader & ID', w: 120, align: 'left' as const },
      { label: 'Branch & Sem', w: 91, align: 'left' as const },
      { label: 'Leader Contact', w: 90, align: 'left' as const },
    ];

    const renderTHeader = (curY: number) => {
      doc.rect(margin, curY, contentWidth, 16).fill(PDF_COLORS.primary);
      let colX = margin;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(PDF_COLORS.white);
      for (const c of tCols) {
        doc.text(c.label, colX + 3, curY + 5, { width: c.w - 6, align: c.align });
        colX += c.w;
      }
      return curY + 16;
    };

    y = renderTHeader(y);
    const rowH = 26;

    teams.forEach((t, idx) => {
      if (y + rowH > pageHeight - margin - 45) {
        doc.addPage();
        y = margin;
        y = renderTHeader(y);
      }
      const isEven = idx % 2 === 0;
      doc.rect(margin, y, contentWidth, rowH).fill(isEven ? PDF_COLORS.white : PDF_COLORS.bgLight);
      doc.moveTo(margin, y + rowH).lineTo(margin + contentWidth, y + rowH).strokeColor(PDF_COLORS.borderLight).lineWidth(0.5).stroke();

      let colX = margin;

      // 1. #
      doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark);
      doc.text(String(idx + 1), colX + 2, y + 8, { width: tCols[0].w - 4, align: 'center' });
      colX += tCols[0].w;

      // 2. Team ID & Status
      const statusColor = t.status === 'CONFIRMED' || t.status === 'REGISTERED' ? PDF_COLORS.success : PDF_COLORS.warning;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.primary).text(t.teamId, colX + 4, y + 4, { width: tCols[1].w - 8, ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(statusColor).text(t.status, colX + 4, y + 14, { width: tCols[1].w - 8, ellipsis: true });
      colX += tCols[1].w;

      // 3. Team Name & Size
      const sizeStr = t.maxTeamSize ? `${t.teamSize}/${t.maxTeamSize} Members` : `${t.teamSize} Members`;
      doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.primary).text(t.teamName, colX + 4, y + 4, { width: tCols[2].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(sizeStr, colX + 4, y + 14, { width: tCols[2].w - 8, ellipsis: true });
      colX += tCols[2].w;

      // 4. Team Leader & ID
      const rollReg = t.leader ? (t.leader.studentId ? `ID: ${t.leader.studentId}` : (t.leader.eventRegNumber || '—')) : '—';
      doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.slateDark).text(t.leader?.name || '—', colX + 4, y + 4, { width: tCols[3].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(rollReg, colX + 4, y + 14, { width: tCols[3].w - 8, ellipsis: true });
      colX += tCols[3].w;

      // 5. Branch & Sem
      doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark).text(t.leader?.branch || '—', colX + 4, y + 4, { width: tCols[4].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(t.leader?.semester || '—', colX + 4, y + 14, { width: tCols[4].w - 8, ellipsis: true });
      colX += tCols[4].w;

      // 6. Leader Contact
      doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark).text(t.leader?.mobile || '—', colX + 4, y + 4, { width: tCols[5].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text(t.leader?.email || '—', colX + 4, y + 14, { width: tCols[5].w - 8, ellipsis: true, lineBreak: false });

      y += rowH;
    });

    y += 12;
  }

  // ------------------------------------------------------------
  // SECTION B: ALL TEAM MEMBERS (ROSTER)
  // ------------------------------------------------------------
  const allTeamMembers = teams.flatMap(t => t.members);
  renderSectionHeader('SECTION B: ALL TEAM MEMBERS', `Total Team Members: ${allTeamMembers.length}`);

  if (allTeamMembers.length === 0) {
    doc.rect(margin, y, contentWidth, 24).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateMuted)
      .text('No team members found.', margin, y + 8, { width: contentWidth, align: 'center' });
    y += 30;
  } else {
    // Team Members Table (A4 Portrait - 523 pt total)
    const tmCols = [
      { label: '#', w: 22, align: 'center' as const },
      { label: 'Team & Role', w: 105, align: 'left' as const },
      { label: 'Member Name & ID', w: 135, align: 'left' as const },
      { label: 'Branch & Contact', w: 181, align: 'left' as const },
      { label: 'Status', w: 80, align: 'center' as const },
    ];

    const renderTMHeader = (curY: number) => {
      doc.rect(margin, curY, contentWidth, 16).fill(PDF_COLORS.primary);
      let colX = margin;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(PDF_COLORS.white);
      for (const c of tmCols) {
        doc.text(c.label, colX + 3, curY + 5, { width: c.w - 6, align: c.align });
        colX += c.w;
      }
      return curY + 16;
    };

    y = renderTMHeader(y);
    const rowH = 26;

    allTeamMembers.forEach((m, idx) => {
      if (y + rowH > pageHeight - margin - 45) {
        doc.addPage();
        y = margin;
        y = renderTMHeader(y);
      }

      const isLeader = m.role === 'TEAM LEADER';
      const isEven = idx % 2 === 0;
      doc.rect(margin, y, contentWidth, rowH).fill(isLeader ? '#FFFBEB' : (isEven ? PDF_COLORS.white : PDF_COLORS.bgLight));
      doc.moveTo(margin, y + rowH).lineTo(margin + contentWidth, y + rowH).strokeColor(PDF_COLORS.borderLight).lineWidth(0.5).stroke();

      let colX = margin;

      // 1. #
      doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark);
      doc.text(String(idx + 1), colX + 2, y + 8, { width: tmCols[0].w - 4, align: 'center' });
      colX += tmCols[0].w;

      // 2. Team Name & Role
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.primary).text(m.teamName || 'Team', colX + 4, y + 4, { width: tmCols[1].w - 8, ellipsis: true });
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(isLeader ? PDF_COLORS.leaderText : PDF_COLORS.memberText)
        .text(isLeader ? 'LEADER' : 'MEMBER', colX + 4, y + 14, { width: tmCols[1].w - 8, ellipsis: true });
      colX += tmCols[1].w;

      // 3. Member Name & ID
      const idReg = [m.studentId ? `ID: ${m.studentId}` : null, m.eventRegNumber ? `Reg: ${m.eventRegNumber}` : null].filter(Boolean).join(' | ') || '—';
      doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.slateDark).text(m.name, colX + 4, y + 4, { width: tmCols[2].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(idReg, colX + 4, y + 14, { width: tmCols[2].w - 8, ellipsis: true });
      colX += tmCols[2].w;

      // 4. Branch & Contact
      const branchSemStr = `${m.branch || '—'}${m.semester ? ` (${m.semester.replace(/Semester/i, 'Sem').trim()})` : ''}`;
      doc.font('Helvetica').fontSize(7.2).fillColor(PDF_COLORS.slateDark).text(branchSemStr, colX + 4, y + 4, { width: tmCols[3].w - 8, ellipsis: true });
      const contactStr = [m.mobile, m.email].filter(Boolean).join('  •  ') || '—';
      doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text(contactStr, colX + 4, y + 14, { width: tmCols[3].w - 8, ellipsis: true, lineBreak: false });
      colX += tmCols[3].w;

      // 5. Status
      const statusColor = m.registrationStatus === 'CONFIRMED' || m.registrationStatus === 'REGISTERED' ? PDF_COLORS.success : PDF_COLORS.warning;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(statusColor).text(m.registrationStatus, colX + 2, y + 8, { width: tmCols[4].w - 4, align: 'center' });

      y += rowH;
    });

    y += 12;
  }

  // ------------------------------------------------------------
  // SECTION C: ALL INDIVIDUAL PARTICIPANTS
  // ------------------------------------------------------------
  renderSectionHeader('SECTION C: ALL INDIVIDUAL PARTICIPANTS', `Total Individuals: ${individuals.length}`);

  if (individuals.length === 0) {
    doc.rect(margin, y, contentWidth, 24).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateMuted)
      .text('No individual participants registered for this program.', margin, y + 8, { width: contentWidth, align: 'center' });
    y += 30;
  } else {
    // Individual Table (A4 Portrait - 523 pt total)
    const iCols = [
      { label: '#', w: 22, align: 'center' as const },
      { label: 'Reg Numbers', w: 105, align: 'left' as const },
      { label: 'Participant & ID', w: 135, align: 'left' as const },
      { label: 'Branch & Contact', w: 181, align: 'left' as const },
      { label: 'Status', w: 80, align: 'center' as const },
    ];

    const renderIHeader = (curY: number) => {
      doc.rect(margin, curY, contentWidth, 16).fill(PDF_COLORS.primary);
      let colX = margin;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(PDF_COLORS.white);
      for (const c of iCols) {
        doc.text(c.label, colX + 3, curY + 5, { width: c.w - 6, align: c.align });
        colX += c.w;
      }
      return curY + 16;
    };

    y = renderIHeader(y);
    const rowH = 26;

    individuals.forEach((ind, idx) => {
      if (y + rowH > pageHeight - margin - 45) {
        doc.addPage();
        y = margin;
        y = renderIHeader(y);
      }
      const isEven = idx % 2 === 0;
      doc.rect(margin, y, contentWidth, rowH).fill(isEven ? PDF_COLORS.white : PDF_COLORS.bgLight);
      doc.moveTo(margin, y + rowH).lineTo(margin + contentWidth, y + rowH).strokeColor(PDF_COLORS.borderLight).lineWidth(0.5).stroke();

      let colX = margin;

      // 1. #
      doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark);
      doc.text(String(idx + 1), colX + 2, y + 8, { width: iCols[0].w - 4, align: 'center' });
      colX += iCols[0].w;

      // 2. Reg Numbers
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.primary).text(ind.eventRegNumber || '—', colX + 4, y + 4, { width: iCols[1].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(ind.programRegNumber || '—', colX + 4, y + 14, { width: iCols[1].w - 8, ellipsis: true });
      colX += iCols[1].w;

      // 3. Participant & ID
      doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.slateDark).text(ind.name, colX + 4, y + 4, { width: iCols[2].w - 8, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted).text(ind.studentId ? `ID: ${ind.studentId}` : '—', colX + 4, y + 14, { width: iCols[2].w - 8, ellipsis: true });
      colX += iCols[2].w;

      // 4. Branch & Contact
      const bSemStr = `${ind.branch || '—'}${ind.semester ? ` (${ind.semester.replace(/Semester/i, 'Sem').trim()})` : ''}`;
      doc.font('Helvetica').fontSize(7.2).fillColor(PDF_COLORS.slateDark).text(bSemStr, colX + 4, y + 4, { width: iCols[3].w - 8, ellipsis: true });
      const contactStr = [ind.mobile, ind.email].filter(Boolean).join('  •  ') || '—';
      doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text(contactStr, colX + 4, y + 14, { width: iCols[3].w - 8, ellipsis: true, lineBreak: false });
      colX += iCols[3].w;

      // 5. Status
      const statusColor = ind.registrationStatus === 'CONFIRMED' || ind.registrationStatus === 'REGISTERED' ? PDF_COLORS.success : PDF_COLORS.warning;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(statusColor).text(ind.registrationStatus, colX + 2, y + 8, { width: iCols[4].w - 4, align: 'center' });

      y += rowH;
    });

    y += 12;
  }

  // ------------------------------------------------------------
  // FINAL GRAND SUMMARY BAR
  // ------------------------------------------------------------
  if (y + 36 > pageHeight - margin - 30) {
    doc.addPage();
    y = margin;
  }

  doc.rect(margin, y, contentWidth, 26).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
  const finalSummaryText = `Total Teams: ${stats.totalTeams}   |   Team Members: ${stats.totalTeamParticipants}   |   Individual Participants: ${stats.totalIndividualParticipants}   |   TOTAL PARTICIPANTS: ${stats.totalParticipants}`;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.primary)
    .text(finalSummaryText, margin + 8, y + 8, { width: contentWidth - 16, align: 'center' });

  y = renderOfficialSignatureBlock(doc, y + 26);
  renderOfficialFooter(doc, college.name);
  doc.end();
  return bufferPromise;
}

// ============================================================
// REPORT 5 / 6: COMPLETE EVENT PROGRAMS & REGISTRATIONS REPORT
// ============================================================

export async function generateCompleteEventProgramsPDF(data: EventReportData): Promise<Buffer> {
  const { college, event, categories, programs, stats } = data;
  const logoBuffer = await fetchLogoBuffer(college.logo_url);

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: 36,
    info: {
      Title: `${event.title} - Complete Event Programs Report`,
      Author: `${college.name} Event Management`,
      Subject: 'Event Programs & Registrations Report',
    },
  });

  const bufferPromise = streamToBuffer(doc);
  const margin = 36;
  const pageWidth = doc.page.width; // 595.28 pt
  const pageHeight = doc.page.height; // 841.89 pt
  const contentWidth = pageWidth - margin * 2; // 523.28 pt

  let y = renderOfficialHeader(doc, {
    college,
    event,
    reportTitle: 'ALL PROGRAMS REPORT',
    reportSubtitle: event.title,
    logoBuffer,
  });

  // Overall Event Summary in 2 Clean Rows (Tailored for Portrait A4)
  const sumItems = [
    { l: 'CATEGORIES', v: String(stats.totalCategories) },
    { l: 'PROGRAMS', v: String(stats.totalPrograms) },
    { l: 'TEAMS', v: String(stats.totalTeams) },
    { l: 'TEAM PARTICIPANTS', v: String(stats.totalTeamParticipants) },
    { l: 'INDIVIDUAL PARTICIPANTS', v: String(stats.totalIndividualParticipants) },
    { l: 'TOTAL PARTICIPANTS', v: String(stats.totalParticipants) },
    { l: 'TOTAL REVENUE', v: `INR ${stats.totalRevenue.toLocaleString('en-IN')}` },
  ];

  const sBoxH = 30;
  // Row 1: 4 cards
  const row1Items = sumItems.slice(0, 4);
  const b1W = Math.floor(contentWidth / 4);
  row1Items.forEach((item, idx) => {
    const bX = margin + idx * b1W;
    doc.rect(bX, y, b1W - 4, sBoxH).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica').fontSize(6).fillColor(PDF_COLORS.slateMuted).text(item.l, bX + 6, y + 4, { width: b1W - 12, ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(PDF_COLORS.primary).text(item.v, bX + 6, y + 14, { width: b1W - 12, ellipsis: true });
  });

  y += sBoxH + 4;

  // Row 2: 3 cards
  const row2Items = sumItems.slice(4);
  const b2W = Math.floor(contentWidth / 3);
  row2Items.forEach((item, idx) => {
    const bX = margin + idx * b2W;
    doc.rect(bX, y, b2W - 4, sBoxH).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica').fontSize(6).fillColor(PDF_COLORS.slateMuted).text(item.l, bX + 6, y + 4, { width: b2W - 12, ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(PDF_COLORS.primary).text(item.v, bX + 6, y + 14, { width: b2W - 12, ellipsis: true });
  });

  y += sBoxH + 14;

  // Process Category by Category
  for (const cat of categories) {
    const catPrograms = programs.filter(p => p.category_id === cat.id);
    if (catPrograms.length === 0) continue;

    // Check pagination for category header
    if (y > pageHeight - margin - 80) {
      doc.addPage();
      y = margin;
    }

    // Clean text category banner (NO broken emoji characters!)
    doc.rect(margin, y, contentWidth, 20).fill('#E0F2FE').stroke(PDF_COLORS.border);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.secondary)
      .text(`CATEGORY: ${cat.name.toUpperCase()}`, margin + 10, y + 5);

    y += 24;

    for (const prog of catPrograms) {
      if (y > pageHeight - margin - 80) {
        doc.addPage();
        y = margin;
      }

      const pReport = prog.reportData;
      const feeText = prog.registration_fee > 0 ? `INR ${prog.registration_fee}` : 'Free';
      const metaText = `Type: ${prog.participation_type}  |  Fee: ${feeText}  |  Teams: ${pReport.stats.totalTeams}  |  Participants: ${pReport.stats.totalParticipants}`;

      // Program Header Bar
      doc.rect(margin, y, contentWidth, 16).fill(PDF_COLORS.secondary);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.white)
        .text(prog.name.toUpperCase(), margin + 8, y + 4, { width: contentWidth * 0.42, ellipsis: true });
      doc.font('Helvetica').fontSize(6.8).fillColor('#CBD5E1')
        .text(metaText, margin + contentWidth * 0.42, y + 4, { width: contentWidth * 0.58 - 8, align: 'right', ellipsis: true });

      y += 18;

      const pParticipants = pReport.allParticipants;

      if (pParticipants.length === 0) {
        doc.font('Helvetica').fontSize(7).fillColor(PDF_COLORS.slateMuted)
          .text('No participants registered for this program.', margin + 8, y + 4);
        y += 18;
        continue;
      }

      // Compact table for participants (A4 Portrait - 523 pt total)
      const miniCols = [
        { l: '#', w: 22, a: 'center' as const },
        { l: 'Reg No. & Type', w: 110, a: 'left' as const },
        { l: 'Participant & Role', w: 135, a: 'left' as const },
        { l: 'Email & Contact', w: 176, a: 'left' as const },
        { l: 'Status', w: 80, a: 'center' as const },
      ];

      const renderMiniHeader = (curY: number) => {
        doc.rect(margin, curY, contentWidth, 14).fill('#E2E8F0');
        let colX = margin;
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor(PDF_COLORS.slateDark);
        for (const c of miniCols) {
          doc.text(c.l, colX + 3, curY + 3.5, { width: c.w - 6, align: c.a });
          colX += c.w;
        }
        return curY + 14;
      };

      y = renderMiniHeader(y);
      const miniRowH = 24;

      pParticipants.forEach((part, pIdx) => {
        if (y + miniRowH > pageHeight - margin - 45) {
          doc.addPage();
          y = margin;
          y = renderMiniHeader(y);
        }

        const isEven = pIdx % 2 === 0;
        doc.rect(margin, y, contentWidth, miniRowH).fill(isEven ? PDF_COLORS.white : PDF_COLORS.bgLight);
        doc.moveTo(margin, y + miniRowH).lineTo(margin + contentWidth, y + miniRowH).strokeColor(PDF_COLORS.borderLight).lineWidth(0.5).stroke();

        let colX = margin;

        // 1. #
        doc.font('Helvetica').fontSize(7).fillColor(PDF_COLORS.slateDark);
        doc.text(String(pIdx + 1), colX + 2, y + 7, { width: miniCols[0].w - 4, align: 'center' });
        colX += miniCols[0].w;

        // 2. Reg No. & Type
        const regNo = part.eventRegNumber || part.programRegNumber || '—';
        const typeTeamStr = part.teamName ? `TEAM: ${part.teamName}` : (part.role === 'INDIVIDUAL' ? 'INDIVIDUAL' : (part.role || 'INDIVIDUAL'));
        doc.font('Helvetica-Bold').fontSize(7.2).fillColor(PDF_COLORS.primary).text(regNo, colX + 3, y + 3.5, { width: miniCols[1].w - 6, ellipsis: true });
        doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text(typeTeamStr, colX + 3, y + 13, { width: miniCols[1].w - 6, ellipsis: true });
        colX += miniCols[1].w;

        // 3. Participant & Role
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.slateDark).text(part.name, colX + 3, y + 3.5, { width: miniCols[2].w - 6, ellipsis: true });
        const roleOrId = [part.role, part.studentId ? `ID: ${part.studentId}` : null].filter(Boolean).join(' | ') || '—';
        doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text(roleOrId, colX + 3, y + 13, { width: miniCols[2].w - 6, ellipsis: true });
        colX += miniCols[2].w;

        // 4. Email & Contact
        doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateDark).text(part.email || '—', colX + 3, y + 3.5, { width: miniCols[3].w - 6, ellipsis: true, lineBreak: false });
        doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted).text(part.mobile || '—', colX + 3, y + 13, { width: miniCols[3].w - 6, ellipsis: true });
        colX += miniCols[3].w;

        // 5. Status
        const sColor = part.registrationStatus === 'CONFIRMED' || part.registrationStatus === 'REGISTERED' ? PDF_COLORS.success : PDF_COLORS.warning;
        doc.font('Helvetica-Bold').fontSize(7.2).fillColor(sColor).text(part.registrationStatus || 'CONFIRMED', colX + 2, y + 7, { width: miniCols[4].w - 4, align: 'center' });

        y += miniRowH;
      });

      y += 10;
    }
  }

  y = renderOfficialSignatureBlock(doc, y);
  renderOfficialFooter(doc, college.name);
  doc.end();
  return bufferPromise;
}

// ============================================================
// REPORT 0: EVENT ENROLLMENT ROSTER (ENHANCED)
// ============================================================

export async function generateEventEnrollmentPDF(params: {
  event: CollegeEvent;
  registrations: EventRegistration[];
  stats: EventStats;
  collegeName: string;
  collegeCode?: string;
  branding?: any;
  collegeDetails?: CollegeMetadata;
}): Promise<Buffer> {
  const { event, registrations, stats, collegeName, collegeCode = 'COLLEGE', branding, collegeDetails } = params;
  const isPaid = event.payment_required;

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: 36,
    info: {
      Title: `${event.title} - Official Enrollment Roster`,
      Author: `${collegeName} Event Management`,
      Subject: 'Official Student Event Enrollment Roster',
    },
  });

  const bufferPromise = streamToBuffer(doc);
  const margin = 36;
  const pageWidth = doc.page.width; // 595.28 pt
  const pageHeight = doc.page.height; // 841.89 pt
  const contentWidth = pageWidth - margin * 2; // 523.28 pt

  const collegeMeta: CollegeMetadata = collegeDetails || {
    id: event.college_id,
    name: collegeName,
    code: collegeCode,
    slug: '',
    logo_url: branding?.logoUrl,
    primary_color: branding?.primaryColor || PDF_COLORS.primary,
  };

  const logoBuffer = await fetchLogoBuffer(collegeMeta.logo_url);

  let y = renderOfficialHeader(doc, {
    college: collegeMeta,
    event,
    reportTitle: 'EVENT ENROLLMENT ROSTER',
    reportSubtitle: 'Master Student Registrations',
    logoBuffer,
  });

  // Summary Metrics Bar
  const summaryBoxH = 32;
  const summaryItems = [
    { label: 'TOTAL ENROLLED', val: String(stats.totalEnrolled) },
    { label: 'CONFIRMED REGISTRATIONS', val: String(stats.paymentVerified || stats.totalEnrolled) },
    { label: 'PENDING PAYMENTS', val: String(stats.paymentPending || 0) },
  ];
  if (stats.availableSeats !== null) {
    summaryItems.push({ label: 'AVAILABLE SEATS', val: String(stats.availableSeats) });
  }

  const sBoxW = Math.floor(contentWidth / summaryItems.length);
  summaryItems.forEach((item, idx) => {
    const boxX = margin + idx * sBoxW;
    doc.rect(boxX, y, sBoxW - 4, summaryBoxH).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica').fontSize(6).fillColor(PDF_COLORS.slateMuted).text(item.label, boxX + 6, y + 4, { width: sBoxW - 12, ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(PDF_COLORS.primary).text(item.val, boxX + 6, y + 14, { width: sBoxW - 12, ellipsis: true });
  });

  y += summaryBoxH + 10;

  // Table Columns (Tailored for A4 Portrait with zero overlapping)
  const columns = [
    { header: '#', width: 25, align: 'center' as const },
    { header: 'Reg Number', width: 85, align: 'left' as const },
    { header: 'Student Name & Roll', width: 125, align: 'left' as const },
    { header: 'Branch & Sem', width: 105, align: 'left' as const },
    { header: 'Contact & Email', width: 100, align: 'left' as const },
    { header: 'Status', width: 83, align: 'center' as const },
  ];

  const renderTableHeader = (currentY: number) => {
    doc.rect(margin, currentY, contentWidth, 20).fill(PDF_COLORS.primary);
    let colX = margin;
    doc.fillColor(PDF_COLORS.white).font('Helvetica-Bold').fontSize(7.5);
    for (const col of columns) {
      doc.text(col.header, colX + 4, currentY + 6, {
        width: col.width - 8,
        align: col.align,
      });
      colX += col.width;
    }
    return currentY + 20;
  };

  y = renderTableHeader(y);
  const rowHeight = 28;
  let rowIdx = 0;

  for (const reg of registrations) {
    rowIdx++;
    if (y + rowHeight > pageHeight - margin - 45) {
      doc.addPage();
      y = margin;
      y = renderTableHeader(y);
    }

    const isEven = rowIdx % 2 === 0;
    doc.rect(margin, y, contentWidth, rowHeight).fill(isEven ? PDF_COLORS.white : PDF_COLORS.bgLight);
    doc.moveTo(margin, y + rowHeight).lineTo(margin + contentWidth, y + rowHeight).strokeColor(PDF_COLORS.borderLight).lineWidth(0.5).stroke();

    let colX = margin;

    // 1. S.No
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.slateMuted)
      .text(String(rowIdx), colX, y + 9, { width: columns[0].width, align: 'center' });
    colX += columns[0].width;

    // 2. Reg. Number
    doc.font('Helvetica-Bold').fontSize(7).fillColor(PDF_COLORS.primary)
      .text(reg.registration_number || '-', colX + 4, y + 9, { width: columns[1].width - 8, ellipsis: true });
    colX += columns[1].width;

    // 3. Student Name & Roll
    const rollDisplay = (reg as any).roll_number || (reg as any).student_id || reg.registration_number || '-';
    doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.slateDark)
      .text(reg.student_name || '-', colX + 4, y + 4, { width: columns[2].width - 8, ellipsis: true });
    doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted)
      .text(`Roll: ${rollDisplay}`, colX + 4, y + 15, { width: columns[2].width - 8, ellipsis: true });
    colX += columns[2].width;

    // 4. Branch & Sem
    const branchName = reg.branch?.code || reg.branch?.name || '-';
    const semName = reg.semester?.semester_number ? `Sem ${reg.semester.semester_number}` : '-';
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark)
      .text(branchName, colX + 4, y + 4, { width: columns[3].width - 8, ellipsis: true });
    doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted)
      .text(semName, colX + 4, y + 15, { width: columns[3].width - 8, ellipsis: true });
    colX += columns[3].width;

    // 5. Contact & Email
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark)
      .text(reg.mobile || '-', colX + 4, y + 4, { width: columns[4].width - 8, ellipsis: true });
    doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted)
      .text(reg.email || '-', colX + 4, y + 15, { width: columns[4].width - 8, ellipsis: true });
    colX += columns[4].width;

    // 6. Status & Payment
    const rColor = reg.registration_status === 'REGISTERED' ? PDF_COLORS.success : PDF_COLORS.danger;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(rColor)
      .text(reg.registration_status, colX + 2, y + 4, { width: columns[5].width - 4, align: 'center', ellipsis: true });
    if (isPaid && reg.payment_status) {
      const pColor = reg.payment_status === 'VERIFIED' ? PDF_COLORS.success : reg.payment_status === 'REJECTED' ? PDF_COLORS.danger : PDF_COLORS.warning;
      doc.font('Helvetica').fontSize(6.5).fillColor(pColor)
        .text(`Pay: ${reg.payment_status}`, colX + 2, y + 15, { width: columns[5].width - 4, align: 'center', ellipsis: true });
    } else {
      doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted)
        .text('Free Entry', colX + 2, y + 15, { width: columns[5].width - 4, align: 'center' });
    }

    y += rowHeight;
  }

  if (y + 60 > pageHeight - margin - 35) {
    doc.addPage();
    y = margin;
  }
  y = renderOfficialSignatureBlock(doc, y);
  renderOfficialFooter(doc, collegeName);
  doc.end();
  return bufferPromise;
}

export const generateEnrollmentPDF = generateEventEnrollmentPDF;

/**
 * Generate official participant enrollment roster PDF for small events
 * powered by live Google Form / Google Sheets responses.
 */
export async function generateGoogleEventEnrollmentPDF(params: {
  event: CollegeEvent;
  responses: GoogleFormParticipantResponse[];
  collegeName: string;
  collegeCode?: string;
  branding?: any;
  collegeDetails?: CollegeMetadata;
}): Promise<Buffer> {
  const { event, responses, collegeName, collegeCode = 'COLLEGE', branding, collegeDetails } = params;

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: 36,
    info: {
      Title: `${event.title} - Participant Roster`,
      Author: `${collegeName} Event Management`,
      Subject: 'Official Student Event Registration Roster (Google Form)',
    },
  });

  const bufferPromise = streamToBuffer(doc);
  const margin = 36;
  const pageWidth = doc.page.width; // 595.28 pt
  const pageHeight = doc.page.height; // 841.89 pt
  const contentWidth = pageWidth - margin * 2; // 523.28 pt

  const collegeMeta: CollegeMetadata = collegeDetails || {
    id: event.college_id,
    name: collegeName,
    code: collegeCode,
    slug: '',
    logo_url: branding?.logoUrl,
    primary_color: branding?.primaryColor || PDF_COLORS.primary,
  };

  const logoBuffer = await fetchLogoBuffer(collegeMeta.logo_url);

  let y = renderOfficialHeader(doc, {
    college: collegeMeta,
    event,
    reportTitle: 'PARTICIPANT REGISTRATION ROSTER',
    reportSubtitle: 'Live Google Form Registrations & Participant Ledger',
    logoBuffer,
  });

  // Summary Metrics Bar
  const summaryBoxH = 32;
  const uniqueCategories = Array.from(new Set(responses.map(r => r.performanceType).filter(Boolean)));
  const summaryItems = [
    { label: 'TOTAL PARTICIPANTS', val: String(responses.length) },
    { label: 'PERFORMANCE CATEGORIES', val: String(uniqueCategories.length) },
    { label: 'DATA SOURCE', val: 'Google Sheets (Live)' },
    { label: 'EVENT STATUS', val: event.status },
  ];

  const sBoxW = Math.floor(contentWidth / summaryItems.length);
  summaryItems.forEach((item, idx) => {
    const boxX = margin + idx * sBoxW;
    doc.rect(boxX, y, sBoxW - 4, summaryBoxH).fillAndStroke(PDF_COLORS.bgLight, PDF_COLORS.border);
    doc.font('Helvetica').fontSize(6).fillColor(PDF_COLORS.slateMuted).text(item.label, boxX + 6, y + 4, { width: sBoxW - 12, ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(PDF_COLORS.primary).text(item.val, boxX + 6, y + 14, { width: sBoxW - 12, ellipsis: true });
  });

  y += summaryBoxH + 10;

  // Table Columns (Tailored for A4 Portrait with zero overlapping)
  const columns = [
    { header: '#', width: 25, align: 'center' as const },
    { header: 'Pass Number', width: 85, align: 'left' as const },
    { header: 'Participant & Roll No', width: 125, align: 'left' as const },
    { header: 'Department & Year', width: 110, align: 'left' as const },
    { header: 'Category & Mode', width: 95, align: 'left' as const },
    { header: 'Contact & Email', width: 83, align: 'left' as const },
  ];

  const renderTableHeader = (currentY: number) => {
    doc.rect(margin, currentY, contentWidth, 20).fill(PDF_COLORS.primary);
    let colX = margin;
    doc.fillColor(PDF_COLORS.white).font('Helvetica-Bold').fontSize(7.5);
    for (const col of columns) {
      doc.text(col.header, colX + 4, currentY + 6, {
        width: col.width - 8,
        align: col.align,
      });
      colX += col.width;
    }
    return currentY + 20;
  };

  y = renderTableHeader(y);
  const rowHeight = 28;
  let rowIdx = 0;

  for (const resp of responses) {
    rowIdx++;
    if (y + rowHeight > pageHeight - margin - 45) {
      doc.addPage();
      y = margin;
      y = renderTableHeader(y);
    }

    const isEven = rowIdx % 2 === 0;
    doc.rect(margin, y, contentWidth, rowHeight).fill(isEven ? PDF_COLORS.white : PDF_COLORS.bgLight);
    doc.moveTo(margin, y + rowHeight).lineTo(margin + contentWidth, y + rowHeight).strokeColor(PDF_COLORS.borderLight).lineWidth(0.5).stroke();

    let colX = margin;

    // 1. S.No
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.slateMuted)
      .text(String(rowIdx), colX, y + 9, { width: columns[0].width, align: 'center' });
    colX += columns[0].width;

    // 2. Pass / Reg No
    doc.font('Helvetica-Bold').fontSize(7).fillColor(PDF_COLORS.primary)
      .text(resp.registrationNumber || '-', colX + 4, y + 9, { width: columns[1].width - 8, ellipsis: true });
    colX += columns[1].width;

    // 3. Participant Name & Roll No
    const rollDisplay = resp.rollNumber || resp.collegeRegistrationNumber || '-';
    doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_COLORS.slateDark)
      .text(resp.participantName || '-', colX + 4, y + 4, { width: columns[2].width - 8, ellipsis: true });
    doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted)
      .text(`Roll: ${rollDisplay}`, colX + 4, y + 15, { width: columns[2].width - 8, ellipsis: true });
    colX += columns[2].width;

    // 4. Branch & Year
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark)
      .text(resp.branch || '-', colX + 4, y + 4, { width: columns[3].width - 8, ellipsis: true });
    doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateMuted)
      .text(resp.year || '-', colX + 4, y + 15, { width: columns[3].width - 8, ellipsis: true });
    colX += columns[3].width;

    // 5. Category & Mode
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PDF_COLORS.secondary)
      .text(resp.performanceType || 'General Entry', colX + 4, y + 4, { width: columns[4].width - 8, ellipsis: true });
    doc.font('Helvetica').fontSize(6.8).fillColor(PDF_COLORS.slateDark)
      .text(`Mode: ${resp.participationType || 'Solo'}`, colX + 4, y + 15, { width: columns[4].width - 8, ellipsis: true });
    colX += columns[4].width;

    // 6. Contact & Email
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_COLORS.slateDark)
      .text(resp.contactNumber || '-', colX + 4, y + 4, { width: columns[5].width - 8, ellipsis: true });
    doc.font('Helvetica').fontSize(6.5).fillColor(PDF_COLORS.slateMuted)
      .text(resp.email || '-', colX + 4, y + 15, { width: columns[5].width - 8, ellipsis: true });

    y += rowHeight;
  }

  if (y + 60 > pageHeight - margin - 35) {
    doc.addPage();
    y = margin;
  }
  y = renderOfficialSignatureBlock(doc, y);
  renderOfficialFooter(doc, collegeName);
  doc.end();
  return bufferPromise;
}

