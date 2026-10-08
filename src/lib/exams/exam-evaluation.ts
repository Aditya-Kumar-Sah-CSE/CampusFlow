import type {
  ExamQuestion,
  ExamAnswer,
  Exam,
  QuestionAnalyticsItem,
  StudentQuestionResult,
} from '@/types/exams';

export interface EvaluationResult {
  total_questions: number;
  attempted_count: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  total_marks: number;
  obtained_marks: number;
  percentage: number;
  is_passed: boolean;
  evaluated_answers: {
    question_id: string;
    selected_option_id: string | null;
    is_correct: boolean;
    marks_awarded: number;
  }[];
}

/**
 * Safely rounds decimal numbers to 2 decimal places to avoid floating point issues.
 */
export function roundDecimal(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Authoritative Server-Side Evaluation Engine.
 * Evaluates submitted answers against actual question records in database.
 */
export function evaluateExamSubmission(
  exam: Pick<Exam, 'negative_marking_enabled' | 'negative_marks' | 'passing_percentage'>,
  questions: ExamQuestion[],
  submittedAnswers: { question_id: string; selected_option_id: string | null }[]
): EvaluationResult {
  const answersMap = new Map<string, string | null>();
  for (const ans of submittedAnswers) {
    answersMap.set(ans.question_id, ans.selected_option_id);
  }

  let totalMarks = 0;
  let rawObtainedMarks = 0;
  let attemptedCount = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const evaluatedAnswers: EvaluationResult['evaluated_answers'] = [];

  for (const q of questions) {
    const qMarks = Number(q.marks) || 1;
    totalMarks += qMarks;

    const selectedOptionId = answersMap.get(q.id) || null;
    const correctOption = q.options.find(o => o.is_correct);

    if (!selectedOptionId) {
      // Unanswered question
      unansweredCount++;
      evaluatedAnswers.push({
        question_id: q.id,
        selected_option_id: null,
        is_correct: false,
        marks_awarded: 0,
      });
    } else {
      attemptedCount++;
      const isCorrect = Boolean(correctOption && correctOption.id === selectedOptionId);

      if (isCorrect) {
        correctCount++;
        rawObtainedMarks += qMarks;
        evaluatedAnswers.push({
          question_id: q.id,
          selected_option_id: selectedOptionId,
          is_correct: true,
          marks_awarded: roundDecimal(qMarks),
        });
      } else {
        wrongCount++;
        let penalty = 0;
        if (exam.negative_marking_enabled && exam.negative_marks > 0) {
          penalty = Number(exam.negative_marks);
        }
        rawObtainedMarks -= penalty;
        evaluatedAnswers.push({
          question_id: q.id,
          selected_option_id: selectedOptionId,
          is_correct: false,
          marks_awarded: penalty > 0 ? -roundDecimal(penalty) : 0,
        });
      }
    }
  }

  // Final score cannot drop below zero
  const finalObtainedMarks = Math.max(0, roundDecimal(rawObtainedMarks));
  const finalTotalMarks = roundDecimal(totalMarks);

  let percentage = 0;
  if (finalTotalMarks > 0) {
    percentage = roundDecimal((finalObtainedMarks / finalTotalMarks) * 100);
  }

  const isPassed = percentage >= (exam.passing_percentage || 40);

  return {
    total_questions: questions.length,
    attempted_count: attemptedCount,
    correct_count: correctCount,
    wrong_count: wrongCount,
    unanswered_count: unansweredCount,
    total_marks: finalTotalMarks,
    obtained_marks: finalObtainedMarks,
    percentage,
    is_passed: isPassed,
    evaluated_answers: evaluatedAnswers,
  };
}

/**
 * Builds student-facing question breakdown honoring result visibility rules.
 */
export function buildStudentQuestionResults(
  questions: ExamQuestion[],
  answers: ExamAnswer[],
  canViewCorrectAnswers: boolean
): StudentQuestionResult[] {
  const answerMap = new Map<string, ExamAnswer>();
  for (const a of answers) {
    answerMap.set(a.question_id, a);
  }

  return questions
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(q => {
      const ans = answerMap.get(q.id);
      const selectedOption = q.options.find(o => o.id === ans?.selected_option_id);
      const correctOption = q.options.find(o => o.is_correct);

      return {
        question_id: q.id,
        position: q.position,
        question_text: q.question_text,
        marks: Number(q.marks),
        selected_option_id: selectedOption?.id || null,
        selected_option_text: selectedOption?.option_text || null,
        selected_option_key: selectedOption?.option_key || null,
        correct_option_id: canViewCorrectAnswers ? correctOption?.id || null : null,
        correct_option_text: canViewCorrectAnswers ? correctOption?.option_text || null : null,
        correct_option_key: canViewCorrectAnswers ? correctOption?.option_key || null : null,
        is_correct: Boolean(ans?.is_correct),
        marks_awarded: Number(ans?.marks_awarded ?? 0),
        explanation: canViewCorrectAnswers ? q.explanation || null : null,
      };
    });
}

/**
 * Calculates question-wise accuracy analytics across all student attempts.
 */
export function calculateQuestionAnalytics(
  questions: ExamQuestion[],
  allAnswers: ExamAnswer[]
): QuestionAnalyticsItem[] {
  // Group answers by question_id
  const statsMap = new Map<
    string,
    { totalAttempts: number; correctCount: number; wrongCount: number; unansweredCount: number }
  >();

  for (const q of questions) {
    statsMap.set(q.id, {
      totalAttempts: 0,
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: 0,
    });
  }

  for (const a of allAnswers) {
    const stat = statsMap.get(a.question_id);
    if (!stat) continue;

    if (!a.selected_option_id) {
      stat.unansweredCount++;
    } else {
      stat.totalAttempts++;
      if (a.is_correct) {
        stat.correctCount++;
      } else {
        stat.wrongCount++;
      }
    }
  }

  return questions
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(q => {
      const stat = statsMap.get(q.id) || {
        totalAttempts: 0,
        correctCount: 0,
        wrongCount: 0,
        unansweredCount: 0,
      };

      const accuracy =
        stat.totalAttempts > 0
          ? roundDecimal((stat.correctCount / stat.totalAttempts) * 100)
          : 0;

      return {
        question_id: q.id,
        position: q.position,
        question_text: q.question_text,
        difficulty: q.difficulty,
        marks: Number(q.marks),
        total_attempts: stat.totalAttempts,
        correct_count: stat.correctCount,
        wrong_count: stat.wrongCount,
        unanswered_count: stat.unansweredCount,
        accuracy_percentage: accuracy,
      };
    });
}
