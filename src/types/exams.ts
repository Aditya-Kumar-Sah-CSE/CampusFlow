import type {
  AcademicYear,
  Branch,
  Semester,
  Subject,
} from './database';

export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
export type ResultVisibility =
  | 'AFTER_SUBMISSION'
  | 'AFTER_EXAM_END'
  | 'MANUAL_RELEASE'
  | 'IMMEDIATE'
  | 'AFTER_END_DATE'
  | 'MANUAL';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type ExamAttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'AUTO_SUBMITTED' | 'ABANDONED';

export interface ExamQuestionOption {
  id: string;
  question_id: string;
  option_key: string; // 'A', 'B', 'C', 'D'
  option_text: string;
  position: number;
  is_correct?: boolean; // Stripped for students until allowed
  created_at?: string;
}

export interface ExamQuestion {
  id: string;
  exam_id: string;
  college_id?: string;
  question_text: string;
  explanation?: string | null;
  difficulty: QuestionDifficulty;
  topic?: string | null;
  marks: number;
  position: number;
  created_at?: string;
  updated_at?: string;
  options: ExamQuestionOption[];
}

export interface ExamBranch {
  exam_id: string;
  branch_id: string;
  branch?: Branch;
}

export interface ExamSubject {
  exam_id: string;
  subject_id: string;
  subject?: Subject;
}

export interface Exam {
  id: string;
  college_id: string;
  academic_session_id: string;
  semester_id: string;
  title: string;
  exam_code: string;
  description?: string | null;
  instructions?: string | null;
  duration_minutes: number;
  passing_percentage: number;
  negative_marking_enabled: boolean;
  negative_marks: number;
  max_attempts: number;
  start_at?: string | null;
  end_at?: string | null;
  result_visibility: ResultVisibility;
  show_correct_answers: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  status: ExamStatus;
  total_marks: number;
  total_questions: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relational fields
  college?: { id: string; name: string; code?: string; logo_url?: string | null };
  academic_session?: AcademicYear;
  semester?: Semester;
  branches?: Branch[];
  subjects?: Subject[];
  questions?: ExamQuestion[];
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  college_id: string;
  student_name: string;
  roll_number: string;
  registration_number: string;
  student_email?: string | null;
  branch_id?: string | null;
  semester_id?: string | null;
  attempt_number: number;
  status: ExamAttemptStatus;
  started_at: string;
  deadline_at: string;
  submitted_at?: string | null;
  total_marks: number;
  obtained_marks: number;
  percentage: number;
  is_passed: boolean;
  total_questions: number;
  attempted_count: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  created_at: string;
  updated_at: string;

  // Joined relations
  exam?: Exam;
  branch?: Branch;
  semester?: Semester;
  answers?: ExamAnswer[];
}

export interface ExamAnswer {
  id?: string;
  attempt_id: string;
  question_id: string;
  selected_option_id: string | null;
  answered_at?: string;
  is_correct?: boolean | null;
  marks_awarded?: number;
  question?: ExamQuestion;
  selected_option?: ExamQuestionOption;
}

// Student-safe interfaces (answers and keys stripped)
export interface PublicQuestionOption {
  id: string;
  option_key: string;
  option_text: string;
  position: number;
}

export interface PublicExamQuestion {
  id: string;
  question_text: string;
  difficulty: QuestionDifficulty;
  topic?: string | null;
  marks: number;
  position: number;
  options: PublicQuestionOption[];
}

export interface PublicExamDetail {
  id: string;
  title: string;
  exam_code: string;
  description?: string | null;
  instructions?: string | null;
  duration_minutes: number;
  passing_percentage: number;
  negative_marking_enabled: boolean;
  negative_marks: number;
  max_attempts: number;
  start_at?: string | null;
  end_at?: string | null;
  status: ExamStatus;
  total_marks: number;
  total_questions: number;
  academic_session_name?: string;
  semester_name?: string;
  branch_names?: string[];
  subject_names?: string[];
}

// Student result breakdown for single question
export interface StudentQuestionResult {
  question_id: string;
  position: number;
  question_text: string;
  marks: number;
  selected_option_id: string | null;
  selected_option_text: string | null;
  selected_option_key: string | null;
  correct_option_id?: string | null;
  correct_option_text?: string | null;
  correct_option_key?: string | null;
  is_correct: boolean;
  marks_awarded: number;
  explanation?: string | null;
}

export interface StudentExamResultCard {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  exam_code: string;
  subject_name: string;
  academic_session_name: string;
  branch_name: string;
  semester_name: string;
  student_name: string;
  roll_number: string;
  registration_number: string;
  student_email?: string | null;
  attempt_number: number;
  status: ExamAttemptStatus;
  submitted_at: string;
  duration_minutes: number;
  total_questions: number;
  attempted_count: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  total_marks: number;
  obtained_marks: number;
  percentage: number;
  passing_percentage: number;
  is_passed: boolean;
  show_correct_answers: boolean;
  can_view_breakdown: boolean;
  questions: StudentQuestionResult[];
}

// Analytics for faculty
export interface QuestionAnalyticsItem {
  question_id: string;
  position: number;
  question_text: string;
  difficulty: QuestionDifficulty;
  marks: number;
  total_attempts: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  accuracy_percentage: number;
}

export interface ExamResultsDashboardSummary {
  exam_id: string;
  exam_title: string;
  total_students_attempted: number;
  total_submissions: number;
  average_score: number;
  average_percentage: number;
  highest_score: number;
  lowest_score: number;
  pass_count: number;
  fail_count: number;
  pass_rate_percentage: number;
  total_attempts?: number;
  unique_students_count?: number;
  pass_percentage?: number;
}

export interface ExamAttemptResult {
  attempt: ExamAttempt & { college?: any; branch?: any; semester?: any };
  exam: Exam & { college?: any };
  breakdown: StudentQuestionResult[];
  can_view_breakdown: boolean;
  can_view_answers: boolean;
}

export interface ExamResultsDashboardData {
  exam: Exam & { college?: any };
  summary: {
    total_attempts: number;
    unique_students_count: number;
    average_score: number;
    average_percentage: number;
    highest_score: number;
    lowest_score: number;
    pass_count: number;
    fail_count: number;
    pass_percentage: number;
  };
  attempts: (ExamAttempt & { branch?: any; semester?: any })[];
  question_analytics: QuestionAnalyticsItem[];
  questionAnalytics?: QuestionAnalyticsItem[];
}

