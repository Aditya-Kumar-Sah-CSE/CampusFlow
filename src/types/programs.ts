/**
 * Program-wise Event Registration Types
 * Event → Category → Program → Registration → Members
 */

// ============================================================
// PARTICIPATION TYPE
// ============================================================

export type ParticipationType = 'INDIVIDUAL' | 'TEAM' | 'BOTH';
export type ProgramPaymentStatus = 'NOT_REQUIRED' | 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
export type ProgramRegistrationStatus = 'REGISTERED' | 'CANCELLED' | 'REJECTED' | 'WAITLISTED';
export type ProgramRegistrationType = 'INDIVIDUAL' | 'TEAM';

// ============================================================
// EVENT CATEGORY
// ============================================================

export interface EventCategory {
  id: string;
  event_id: string;
  college_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed
  programs_count?: number;
  programs?: EventProgram[];
}

export interface CategoryFormData {
  name: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}

// ============================================================
// EVENT PROGRAM
// ============================================================

export interface EventProgram {
  id: string;
  event_id: string;
  category_id: string;
  college_id: string;
  name: string;
  slug: string;
  description: string | null;
  rules: string | null;
  participation_type: ParticipationType;
  registration_fee: number;
  currency: string;
  min_team_size: number | null;
  max_team_size: number | null;
  max_participants: number | null;
  max_teams: number | null;
  registration_open_at: string | null;
  registration_close_at: string | null;
  show_public_participants: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  // Joined / computed
  category?: EventCategory;
  registrations_count?: number;
  participants_count?: number;
  teams_count?: number;
  individual_count?: number;
}

export interface ProgramFormData {
  name: string;
  slug: string;
  category_id: string;
  description?: string;
  rules?: string;
  participation_type: ParticipationType;
  registration_fee: number;
  currency?: string;
  min_team_size?: number | null;
  max_team_size?: number | null;
  max_participants?: number | null;
  max_teams?: number | null;
  registration_open_at?: string;
  registration_close_at?: string;
  show_public_participants?: boolean;
  is_active?: boolean;
  display_order?: number;
}

// ============================================================
// PROGRAM REGISTRATION
// ============================================================

export interface ProgramRegistration {
  id: string;
  event_id: string;
  program_id: string;
  category_id: string;
  college_id: string;
  registration_number: string;
  registration_type: ProgramRegistrationType;
  // Participant / team leader
  participant_name: string;
  student_id: string | null;
  email: string;
  mobile: string | null;
  branch: string | null;
  semester: string | null;
  gender: string | null;
  // Team
  team_name: string | null;
  team_role?: string | null;
  // Payment
  payment_status: ProgramPaymentStatus;
  payment_reference: string | null;
  payment_method: string | null;
  payment_amount: number | null;
  payment_screenshot_url: string | null;
  paid_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  // Status
  registration_status: ProgramRegistrationStatus;
  registered_at: string;
  updated_at: string;
  // Joined
  program?: EventProgram;
  category?: EventCategory;
  members?: ProgramRegistrationMember[];
}

// ============================================================
// PROGRAM REGISTRATION MEMBER (TEAM MEMBER)
// ============================================================

export interface ProgramRegistrationMember {
  id: string;
  registration_id: string;
  program_id: string;
  college_id: string;
  member_name: string;
  student_id: string | null;
  email: string | null;
  mobile: string | null;
  branch: string | null;
  semester: string | null;
  gender: string | null;
  is_leader: boolean;
  display_order: number;
  created_at: string;
}

// ============================================================
// STATISTICS
// ============================================================

export interface ProgramStats {
  totalRegistrations: number;
  totalParticipants: number;
  totalTeams: number;
  totalIndividual: number;
  paymentPending: number;
  paymentVerified: number;
  paymentRejected: number;
  paymentSubmitted: number;
  totalRevenue: number;
  availableSlots: number | null;
  maxParticipants: number | null;
  maxTeams: number | null;
}

export interface EventProgramsStats {
  totalPrograms: number;
  totalCategories: number;
  totalRegistrations: number;
  totalParticipants: number;
  totalTeams: number;
  totalIndividual: number;
  totalPaid: number;
  totalPending: number;
  totalRevenue: number;
}

// ============================================================
// PUBLIC REGISTRATION INPUT
// ============================================================

export interface ProgramRegistrationInput {
  event_id: string;
  program_id: string;
  college_id: string;
  registration_type: ProgramRegistrationType;
  // Participant / team leader
  participant_name: string;
  student_id: string;
  email: string;
  mobile: string;
  branch?: string;
  semester?: string;
  gender?: string;
  // Team
  team_name?: string;
  members?: TeamMemberInput[];
  // Payment
  payment_reference?: string;
  payment_screenshot_url?: string;
}

export interface TeamMemberInput {
  member_name: string;
  student_id?: string;
  email?: string;
  mobile?: string;
  branch?: string;
  semester?: string;
  gender?: string;
}

// ============================================================
// PUBLIC PARTICIPANT (SAFE DISPLAY)
// ============================================================

export interface PublicParticipant {
  registration_number: string;
  participant_name: string;
  registration_type: ProgramRegistrationType;
  team_name: string | null;
  program_name: string;
  category_name: string;
}

export interface PublicTeamParticipant extends PublicParticipant {
  members: { member_name: string; is_leader: boolean }[];
}
