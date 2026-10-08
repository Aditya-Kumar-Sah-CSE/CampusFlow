import { z } from 'zod';

export const questionOptionSchema = z.object({
  id: z.string().optional(),
  option_key: z.string().min(1, 'Option key is required'),
  option_text: z.string().min(1, 'Option text cannot be empty'),
  position: z.number().int().min(1),
  is_correct: z.boolean(),
});

export const questionSchema = z.object({
  id: z.string().optional(),
  question_text: z.string().min(3, 'Question text must be at least 3 characters'),
  explanation: z.string().optional().nullable(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  topic: z.string().optional().nullable(),
  marks: z.number().positive('Marks must be greater than 0').default(1),
  position: z.number().int().min(1),
  options: z
    .array(questionOptionSchema)
    .min(2, 'Each question must have at least 2 options')
    .refine(
      options => options.filter(o => o.is_correct).length === 1,
      'Exactly one option must be marked as correct'
    )
    .refine(
      options => options.every(o => o.option_text && o.option_text.trim().length > 0),
      'Options cannot be empty'
    ),
});

export const examScopeSchema = z.object({
  college_id: z.string().uuid().optional(),
  academic_session_id: z.string().uuid('Valid academic session is required'),
  semester_id: z.string().uuid('Valid semester is required'),
  branch_ids: z.array(z.string().uuid()).min(1, 'At least one branch must be selected'),
  subject_ids: z.array(z.string().uuid()).min(1, 'At least one subject must be selected'),
  title: z.string().min(3, 'Exam title must be at least 3 characters'),
  exam_code: z.string().min(2, 'Exam code is required'),
  description: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  duration_minutes: z.number().int().positive('Duration must be greater than 0').default(30).optional(),
  passing_percentage: z.number().min(0).max(100).default(40).optional(),
  negative_marking_enabled: z.boolean().default(false).optional(),
  negative_marks: z.number().min(0).default(0).optional(),
  max_attempts: z.number().int().min(1).default(1).optional(),
  start_at: z.string().optional().nullable(),
  end_at: z.string().optional().nullable(),
  result_visibility: z
    .enum(['AFTER_SUBMISSION', 'AFTER_EXAM_END', 'MANUAL_RELEASE', 'IMMEDIATE', 'AFTER_END_DATE', 'MANUAL'])
    .default('AFTER_SUBMISSION')
    .optional(),
  show_correct_answers: z.boolean().default(true).optional(),
  randomize_questions: z.boolean().default(false).optional(),
  randomize_options: z.boolean().default(false).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'ARCHIVED']).default('DRAFT').optional(),
});

export const startAttemptSchema = z.object({
  exam_id: z.string().uuid('Invalid exam ID'),
  student_name: z.string().min(2, 'Student name must be at least 2 characters'),
  roll_number: z.string().min(1, 'Roll number is required'),
  registration_number: z.string().min(1, 'Registration number is required'),
  student_email: z.string().email('Invalid email address').optional().nullable(),
  branch_id: z.string().uuid().optional().nullable(),
  semester_id: z.string().uuid().optional().nullable(),
});

export const saveAnswerSchema = z.object({
  attempt_id: z.string().uuid('Invalid attempt ID'),
  question_id: z.string().uuid('Invalid question ID'),
  selected_option_id: z.string().uuid().nullable(),
});

export const submitAttemptSchema = z.object({
  attempt_id: z.string().uuid('Invalid attempt ID'),
  auto_submitted: z.boolean().optional().default(false),
});

// Canonical Aliases & Payloads
export const createExamSchema = examScopeSchema;
export const updateExamSchema = examScopeSchema.partial().extend({
  id: z.string().uuid('Invalid exam ID'),
});

export const saveExamQuestionsSchema = z.object({
  exam_id: z.string().uuid('Invalid exam ID'),
  questions: z.array(questionSchema).min(1, 'Exam must contain at least 1 question'),
});

export const startExamAttemptSchema = startAttemptSchema;
export const submitExamAttemptSchema = submitAttemptSchema;

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type SaveExamQuestionsInput = z.infer<typeof saveExamQuestionsSchema>;
export type StartExamAttemptInput = z.infer<typeof startExamAttemptSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;

