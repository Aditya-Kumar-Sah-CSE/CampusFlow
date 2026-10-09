/**
-- CampusFlow Student Authentication & Profile Types
 */

export interface StudentProfile {
  id: string;
  userId: string;
  collegeId: string;
  collegeName: string;
  collegeSlug: string;
  collegeCode: string;
  collegeLogoUrl: string | null;
  email: string;
  fullName: string;
  registrationNumber?: string | null;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface StudentSession {
  isAuthenticated: boolean;
  isStudent: boolean;
  emailVerified: boolean;
  student: StudentProfile | null;
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, any>;
  } | null;
}

export interface StudentSignupInput {
  collegeId: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export interface StudentLoginInput {
  email: string;
  password: string;
}

export interface StudentFormEligibility {
  isEligible: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  reason?: 'NOT_AUTHENTICATED' | 'EMAIL_NOT_VERIFIED' | 'CROSS_COLLEGE_RESTRICTED' | 'FORM_CLOSED' | 'ELIGIBLE';
  message?: string;
  studentCollegeId?: string;
  studentCollegeName?: string;
  formCollegeId?: string;
  formCollegeName?: string;
  alreadySubmitted?: boolean;
  submittedAt?: string | null;
}
