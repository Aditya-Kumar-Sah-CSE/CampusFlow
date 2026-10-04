export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
export type EventPaymentStatus = 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type EventRegistrationStatus = 'REGISTERED' | 'CANCELLED' | 'REJECTED';
export type EventRegistrationType = 'google_form' | 'internal' | 'none';

export type GoogleRegistrationStatus = 'NOT_CONFIGURED' | 'PENDING' | 'READY' | 'ERROR';

export interface CollegeEvent {
  id: string;
  college_id: string;
  title: string;
  slug: string;
  description: string | null;
  venue: string;
  start_at: string;
  end_at: string;
  registration_start: string;
  registration_end: string;
  max_capacity: number | null;
  status: EventStatus;
  registration_enabled: boolean;
  registration_type?: EventRegistrationType | null;
  google_form_id?: string | null;
  google_form_url?: string | null;
  google_spreadsheet_id?: string | null;
  google_spreadsheet_url?: string | null;
  google_drive_folder_id?: string | null;
  google_drive_folder_url?: string | null;
  google_registration_status?: GoogleRegistrationStatus;
  google_registration_error?: string | null;
  google_resources_created_at?: string | null;
  google_resources_updated_at?: string | null;
  registration_deadline?: string | null;
  registration_label?: string | null;
  performance_categories?: string[] | null;
  participation_modes?: string[] | null;
  payment_required: boolean;
  payment_amount: number | null;
  payment_upi_id: string | null;
  payment_qr_url: string | null;
  payment_instructions: string | null;
  show_public_participants: boolean;
  registration_sheet_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed / joined
  registrations_count?: number;
  active_registrations_count?: number;
}

// ============================================================
// GOOGLE SHEETS-BACKED EVENT REGISTRATION (NEW FLOW)
// ============================================================

export interface SheetEventRegistrationInput {
  college_id: string;
  event_id: string;
  full_name: string;
  student_id: string;
  email: string;
  mobile: string;
  branch?: string;
  semester?: string;
  gender?: string;
}

export interface EventLoginInput {
  event_id: string;
  college_id: string;
  registration_number: string;
  email: string;
}

export interface EventSessionInfo {
  registrationNumber: string;
  email: string;
  fullName: string;
  studentId: string;
  eventId: string;
  collegeId: string;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  college_id: string;
  registration_number: string;
  student_name: string;
  email: string;
  mobile: string;
  branch_id: string | null;
  semester_id: string | null;
  transaction_id: string | null;
  payment_status: EventPaymentStatus;
  payment_screenshot_url: string | null;
  registration_status: EventRegistrationStatus;
  registered_at: string;
  updated_at: string;
  // Joined relations
  branch?: {
    id: string;
    name: string;
    code: string;
  } | null;
  semester?: {
    id: string;
    name: string;
    semester_number: number;
  } | null;
  event?: CollegeEvent;
}

export interface EventStats {
  totalEnrolled: number;
  paymentPending: number;
  paymentVerified: number;
  paymentRejected: number;
  availableSeats: number | null;
  maxCapacity: number | null;
}

export interface EventFormData {
  title: string;
  slug: string;
  description?: string;
  venue: string;
  start_at: string;
  end_at: string;
  registration_start: string;
  registration_end: string;
  max_capacity?: number | null;
  status: EventStatus;
  registration_enabled: boolean;
  registration_type?: EventRegistrationType;
  google_form_id?: string;
  google_form_url?: string;
  google_spreadsheet_id?: string;
  google_spreadsheet_url?: string;
  google_drive_folder_id?: string;
  google_drive_folder_url?: string;
  google_registration_status?: GoogleRegistrationStatus;
  google_registration_error?: string;
  registration_deadline?: string;
  registration_label?: string;
  performance_categories?: string[];
  participation_modes?: string[];
  payment_required: boolean;
  payment_amount?: number | null;
  payment_upi_id?: string;
  payment_qr_url?: string;
  payment_instructions?: string;
}

export interface GoogleRegistrationResources {
  googleFormId?: string | null;
  googleFormUrl?: string | null;
  googleSpreadsheetId?: string | null;
  googleSpreadsheetUrl?: string | null;
  googleDriveFolderId?: string | null;
  googleDriveFolderUrl?: string | null;
  status: GoogleRegistrationStatus;
  error?: string | null;
}

export interface GoogleFormParticipantResponse {
  responseId: string;
  submittedAt: string;
  participantName: string;
  registrationNumber: string;
  collegeRegistrationNumber?: string;
  rollNumber: string;
  year: string;
  branch: string;
  contactNumber: string;
  email: string;
  performanceType?: string;
  participationType?: string;
  notes?: string;
  consent: boolean;
  rawAnswers?: Record<string, string>;
}

export interface PublicEventRegistrationInput {
  college_id: string;
  event_id: string;
  registration_number: string;
  student_name: string;
  email: string;
  mobile: string;
  branch_id?: string | null;
  semester_id?: string | null;
  transaction_id?: string | null;
  payment_screenshot_url?: string | null;
}
