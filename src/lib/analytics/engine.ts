/**
 * Unified Analytics Engine for Faculty Feedback
 * Single Source of Truth for Dashboard, Charts, and PDF Reports.
 */

import { BCE_FEEDBACK_PARAMETERS } from '@/lib/google/template';
import {
  CanonicalResponseRow,
  FormAnalyticsReport,
  AggregatedAnalyticsReport,
  ParameterMetrics,
  OverallDistribution,
  FacultyComparisonItem,
  PerformanceGrade,
  PerformanceGradeInfo,
  RATING_WEIGHTS,
} from './types';

/**
 * Institutional Performance Grading Rubric:
 * Evaluated on a 5.00-point scale:
 * >= 4.50: EXCELLENT
 * >= 3.75: VERY GOOD
 * >= 3.00: GOOD
 * >= 2.00: SATISFACTORY
 * < 2.00: NEEDS ATTENTION
 * No valid data: NO DATA
 */
export function calculatePerformanceGrade(
  score: number | null | undefined,
  hasData: boolean
): PerformanceGrade {
  if (!hasData || score === null || score === undefined || isNaN(score) || score <= 0) {
    return 'NO DATA';
  }
  if (score >= 4.5) return 'EXCELLENT';
  if (score >= 3.75) return 'VERY GOOD';
  if (score >= 3.0) return 'GOOD';
  if (score >= 2.0) return 'SATISFACTORY';
  return 'NEEDS ATTENTION';
}

/**
 * Returns canonical badge styling and label for a performance grade
 */
export function getPerformanceGradeInfo(
  score: number | null | undefined,
  hasData: boolean
): PerformanceGradeInfo {
  const grade = calculatePerformanceGrade(score, hasData);
  switch (grade) {
    case 'EXCELLENT':
      return {
        grade,
        label: 'EXCELLENT',
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-300',
      };
    case 'VERY GOOD':
      return {
        grade,
        label: 'VERY GOOD',
        color: 'text-indigo-700',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-300',
      };
    case 'GOOD':
      return {
        grade,
        label: 'GOOD',
        color: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300',
      };
    case 'SATISFACTORY':
      return {
        grade,
        label: 'SATISFACTORY',
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-300',
      };
    case 'NEEDS ATTENTION':
      return {
        grade,
        label: 'NEEDS ATTENTION',
        color: 'text-red-700',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-300',
      };
    case 'NO DATA':
    default:
      return {
        grade: 'NO DATA',
        label: 'NO DATA',
        color: 'text-slate-400',
        bgColor: 'bg-slate-100',
        borderColor: 'border-slate-300',
      };
  }
}

/**
 * Shared helper to count unique student submissions deduplicating by authoritative Google Forms response ID.
 * One Google Forms submission represents ONE student response, regardless of how many faculty grids exist.
 */
export function countUniqueStudentResponses(responses: CanonicalResponseRow[]): number {
  if (!responses || responses.length === 0) return 0;
  const uniqueIds = new Set<string>();

  for (const r of responses) {
    // 1. Authoritative responseId if present and not generic fallback
    if (r.responseId && !r.responseId.startsWith('row-')) {
      uniqueIds.add(r.responseId.trim());
      continue;
    }

    // 2. Stable identifier from registrationNumber or studentName
    const reg = (r.registrationNumber || '').trim().toLowerCase();
    const name = (r.studentName || '').trim().toLowerCase();
    if (reg) {
      uniqueIds.add(`reg_${reg}`);
      continue;
    }
    if (name) {
      uniqueIds.add(`name_${name}`);
      continue;
    }

    // 3. Fallback to responseId or timestamp
    const fallback = (r.responseId || r.timestamp || '').trim();
    if (fallback) {
      uniqueIds.add(fallback);
    }
  }

  return uniqueIds.size;
}

/**
 * Normalizes 5-tier rating counts into 1-decimal percentages such that
 * their sum never exceeds 100% due to independent float rounding, and
 * calculates the true positive rating index strictly bounded between 0 and 100%.
 */
export function calculateDistributionPercentages(
  counts: [number, number, number, number, number],
  total: number
): {
  excellentPct: number;
  veryGoodPct: number;
  goodPct: number;
  satisfactoryPct: number;
  unsatisfactoryPct: number;
  positivePct: number;
} {
  if (total <= 0) {
    return {
      excellentPct: 0,
      veryGoodPct: 0,
      goodPct: 0,
      satisfactoryPct: 0,
      unsatisfactoryPct: 0,
      positivePct: 0,
    };
  }

  const pcts = counts.map(c => Number(((c / total) * 100).toFixed(1)));
  const sum = Number((pcts[0] + pcts[1] + pcts[2] + pcts[3] + pcts[4]).toFixed(1));

  // If counts add up to total, normalize sum to exactly 100.0% if there is rounding drift
  if (sum !== 100 && counts.reduce((a, b) => a + b, 0) === total) {
    const diff = Number((100 - sum).toFixed(1));
    let maxIdx = 0;
    let maxCount = -1;
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] > maxCount) {
        maxCount = counts[i];
        maxIdx = i;
      }
    }
    if (maxCount > 0) {
      pcts[maxIdx] = Number((pcts[maxIdx] + diff).toFixed(1));
    }
  }

  // Calculate positive percentage directly from counts (Excellent + Very Good + Good)
  const positiveCount = counts[0] + counts[1] + counts[2];
  const positivePct = Number(
    Math.min(100, Math.max(0, (positiveCount / total) * 100)).toFixed(1)
  );

  return {
    excellentPct: pcts[0],
    veryGoodPct: pcts[1],
    goodPct: pcts[2],
    satisfactoryPct: pcts[3],
    unsatisfactoryPct: pcts[4],
    positivePct,
  };
}

/**
 * Computes analytics for a single feedback form from normalized canonical responses.
 */
export function calculateFormAnalytics(params: {
  formId: string;
  title: string;
  academicYear: string;
  branch: string;
  semester: string;
  facultyName: string;
  subjectName: string;
  subjectCode: string;
  formType: string;
  status: string;
  lastSyncedAt: string | null;
  googleSheetUrl?: string;
  googleFormUrl?: string;
  responses: CanonicalResponseRow[];
}): FormAnalyticsReport {
  const { responses } = params;

  const isValidRow = (r: CanonicalResponseRow) =>
    r.isValid ?? Object.values(r.ratings || {}).some(v => v !== null && v !== undefined);

  // Authoritative student count: COUNT(DISTINCT response_id)
  const totalStudents = countUniqueStudentResponses(responses);
  const validStudents = countUniqueStudentResponses(responses.filter(isValidRow));
  const evaluatedItems = responses.filter(isValidRow).length;
  
  // For semester forms: totalResponses = unique students, validResponses = evaluated items
  const totalResponses = totalStudents;
  const validResponses = evaluatedItems;
  const unansweredResponses = Math.max(0, totalStudents - validStudents);
  const hasData = evaluatedItems > 0;

  let totalAllScores = 0;
  let totalAllRatingsCount = 0;

  // Track global rating counts across all questions
  let globalExcellent = 0;
  let globalVeryGood = 0;
  let globalGood = 0;
  let globalSatisfactory = 0;
  let globalUnsatisfactory = 0;

  // Compute metrics for each of the 8 canonical parameters
  const parameters: ParameterMetrics[] = BCE_FEEDBACK_PARAMETERS.map(param => {
    const pId = param.id;
    let exCount = 0;
    let vgCount = 0;
    let gCount = 0;
    let sCount = 0;
    let uCount = 0;

    for (const resp of responses) {
      const rating = resp.ratings[pId];
      if (rating === 'Excellent') exCount++;
      else if (rating === 'Very Good') vgCount++;
      else if (rating === 'Good') gCount++;
      else if (rating === 'Satisfactory') sCount++;
      else if (rating === 'Unsatisfactory') uCount++;
    }

    const validCount = exCount + vgCount + gCount + sCount + uCount;
    const unansweredCount = responses.length - validCount;

    // Accumulate global counts
    globalExcellent += exCount;
    globalVeryGood += vgCount;
    globalGood += gCount;
    globalSatisfactory += sCount;
    globalUnsatisfactory += uCount;

    const pDist = calculateDistributionPercentages(
      [exCount, vgCount, gCount, sCount, uCount],
      validCount
    );

    const excellentPct = pDist.excellentPct;
    const veryGoodPct = pDist.veryGoodPct;
    const goodPct = pDist.goodPct;
    const satisfactoryPct = pDist.satisfactoryPct;
    const unsatisfactoryPct = pDist.unsatisfactoryPct;

    // Weighted average: (EX*5 + VG*4 + G*3 + S*2 + U*1) / validCount
    let averageScore = 0;
    if (validCount > 0) {
      const scoreSum =
        exCount * RATING_WEIGHTS['Excellent'] +
        vgCount * RATING_WEIGHTS['Very Good'] +
        gCount * RATING_WEIGHTS['Good'] +
        sCount * RATING_WEIGHTS['Satisfactory'] +
        uCount * RATING_WEIGHTS['Unsatisfactory'];

      averageScore = Number((scoreSum / validCount).toFixed(2));
      totalAllScores += scoreSum;
      totalAllRatingsCount += validCount;
    }

    // Factual interpretation strictly derived from data
    const interpretation =
      validCount > 0
        ? `${param.title} received an average score of ${averageScore.toFixed(2)}/5.00 based on ${validCount} valid response${
            validCount > 1 ? 's' : ''
          }.`
        : `No valid response data recorded for ${param.title}.`;

    return {
      parameterId: pId,
      title: param.title,
      description: param.description || '',
      excellentCount: exCount,
      veryGoodCount: vgCount,
      goodCount: gCount,
      satisfactoryCount: sCount,
      unsatisfactoryCount: uCount,
      validCount,
      unansweredCount,
      excellentPct,
      veryGoodPct,
      goodPct,
      satisfactoryPct,
      unsatisfactoryPct,
      averageScore,
      interpretation,
    };
  });

  // Overall distribution across all 8 parameters
  const totalValidRatings =
    globalExcellent + globalVeryGood + globalGood + globalSatisfactory + globalUnsatisfactory;

  const globalDist = calculateDistributionPercentages(
    [globalExcellent, globalVeryGood, globalGood, globalSatisfactory, globalUnsatisfactory],
    totalValidRatings
  );

  const distribution: OverallDistribution = {
    excellentCount: globalExcellent,
    veryGoodCount: globalVeryGood,
    goodCount: globalGood,
    satisfactoryCount: globalSatisfactory,
    unsatisfactoryCount: globalUnsatisfactory,
    totalValidRatings,
    excellentPct: globalDist.excellentPct,
    veryGoodPct: globalDist.veryGoodPct,
    goodPct: globalDist.goodPct,
    satisfactoryPct: globalDist.satisfactoryPct,
    unsatisfactoryPct: globalDist.unsatisfactoryPct,
    positivePct: globalDist.positivePct,
  };

  // Evaluation Parameters (Q1 to Q7) metrics & distribution
  let paramScoresSum = 0;
  let paramRatingsCount = 0;
  let paramExcellent = 0;
  let paramVeryGood = 0;
  let paramGood = 0;
  let paramSatisfactory = 0;
  let paramUnsatisfactory = 0;

  for (const param of parameters) {
    if (param.parameterId >= 1 && param.parameterId <= 7) {
      paramExcellent += param.excellentCount;
      paramVeryGood += param.veryGoodCount;
      paramGood += param.goodCount;
      paramSatisfactory += param.satisfactoryCount;
      paramUnsatisfactory += param.unsatisfactoryCount;

      const scoreSum =
        param.excellentCount * RATING_WEIGHTS['Excellent'] +
        param.veryGoodCount * RATING_WEIGHTS['Very Good'] +
        param.goodCount * RATING_WEIGHTS['Good'] +
        param.satisfactoryCount * RATING_WEIGHTS['Satisfactory'] +
        param.unsatisfactoryCount * RATING_WEIGHTS['Unsatisfactory'];

      paramScoresSum += scoreSum;
      paramRatingsCount += param.validCount;
    }
  }

  const parameterAverageScore =
    paramRatingsCount > 0 ? Number((paramScoresSum / paramRatingsCount).toFixed(2)) : 0;

  const totalValidParamRatings =
    paramExcellent + paramVeryGood + paramGood + paramSatisfactory + paramUnsatisfactory;

  const paramDist = calculateDistributionPercentages(
    [paramExcellent, paramVeryGood, paramGood, paramSatisfactory, paramUnsatisfactory],
    totalValidParamRatings
  );

  const parameterDistribution: OverallDistribution = {
    excellentCount: paramExcellent,
    veryGoodCount: paramVeryGood,
    goodCount: paramGood,
    satisfactoryCount: paramSatisfactory,
    unsatisfactoryCount: paramUnsatisfactory,
    totalValidRatings: totalValidParamRatings,
    excellentPct: paramDist.excellentPct,
    veryGoodPct: paramDist.veryGoodPct,
    goodPct: paramDist.goodPct,
    satisfactoryPct: paramDist.satisfactoryPct,
    unsatisfactoryPct: paramDist.unsatisfactoryPct,
    positivePct: paramDist.positivePct,
  };

  // Question 8 Standalone Overall Rating distribution
  const param8 = parameters.find(p => p.parameterId === 8);
  const p8Counts: [number, number, number, number, number] = [
    param8?.excellentCount || 0,
    param8?.veryGoodCount || 0,
    param8?.goodCount || 0,
    param8?.satisfactoryCount || 0,
    param8?.unsatisfactoryCount || 0,
  ];
  const p8Dist = calculateDistributionPercentages(p8Counts, param8?.validCount || 0);

  const overallRatingDistribution: OverallDistribution = {
    excellentCount: p8Counts[0],
    veryGoodCount: p8Counts[1],
    goodCount: p8Counts[2],
    satisfactoryCount: p8Counts[3],
    unsatisfactoryCount: p8Counts[4],
    totalValidRatings: param8?.validCount || 0,
    excellentPct: p8Dist.excellentPct,
    veryGoodPct: p8Dist.veryGoodPct,
    goodPct: p8Dist.goodPct,
    satisfactoryPct: p8Dist.satisfactoryPct,
    unsatisfactoryPct: p8Dist.unsatisfactoryPct,
    positivePct: p8Dist.positivePct,
  };

  // Composite average across all parameters: strictly SUM(weights) / COUNT(ratings)
  const compositeAverageScore =
    totalAllRatingsCount > 0 ? Number((totalAllScores / totalAllRatingsCount).toFixed(2)) : 0;

  // Percentage on 5-point scale: (average / 5.0) * 100
  const percentage =
    totalAllRatingsCount > 0 ? Number(((compositeAverageScore / 5) * 100).toFixed(2)) : 0;

  // Canonical Overall Rating:
  // Strictly the composite average across all evaluated parameters (e.g. 20 / 8 = 2.50)
  const averageOverallScore = compositeAverageScore;

  const performanceGrade = calculatePerformanceGrade(averageOverallScore, hasData);
  const performanceGradeInfo = getPerformanceGradeInfo(averageOverallScore, hasData);

  return {
    formId: params.formId,
    title: params.title,
    academicYear: params.academicYear,
    branch: params.branch,
    semester: params.semester,
    facultyName: params.facultyName,
    subjectName: params.subjectName,
    subjectCode: params.subjectCode,
    formType: params.formType,
    status: params.status,
    lastSyncedAt: params.lastSyncedAt,
    googleSheetUrl: params.googleSheetUrl,
    googleFormUrl: params.googleFormUrl,
    totalResponses,
    totalStudents,
    evaluatedItems,
    percentage,
    validResponses,
    unansweredResponses,
    parameterAverageScore,
    averageOverallScore,
    compositeAverageScore,
    performanceGrade,
    performanceGradeInfo,
    parameters,
    distribution,
    parameterDistribution,
    overallRatingDistribution,
    hasData,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Aggregates multiple form analytics reports into a unified scope analysis.
 * Uses the exact same formula to guarantee consistency.
 */
export function aggregateAnalytics(
  formReports: FormAnalyticsReport[],
  scopeTitle: string,
  filters: AggregatedAnalyticsReport['filters']
): AggregatedAnalyticsReport {
  const totalForms = formReports.length;
  const formsWithData = formReports.filter(f => f.hasData);
  const formsWithResponses = formsWithData.length;

  let totalResponses = 0;
  let validResponses = 0;

  // Sum up raw parameter metrics
  const paramAccumulators: Record<
    number,
    { ex: number; vg: number; g: number; s: number; u: number; unanswered: number }
  > = {};

  for (let i = 1; i <= 8; i++) {
    paramAccumulators[i] = { ex: 0, vg: 0, g: 0, s: 0, u: 0, unanswered: 0 };
  }

  for (const report of formReports) {
    totalResponses += report.totalResponses;
    validResponses += report.validResponses;

    for (const p of report.parameters) {
      if (paramAccumulators[p.parameterId]) {
        paramAccumulators[p.parameterId].ex += p.excellentCount || 0;
        paramAccumulators[p.parameterId].vg += p.veryGoodCount;
        paramAccumulators[p.parameterId].g += p.goodCount;
        paramAccumulators[p.parameterId].s += p.satisfactoryCount;
        paramAccumulators[p.parameterId].u += p.unsatisfactoryCount;
        paramAccumulators[p.parameterId].unanswered += p.unansweredCount;
      }
    }
  }

  let totalAllScores = 0;
  let totalAllRatings = 0;
  let globalExcellent = 0;
  let globalVeryGood = 0;
  let globalGood = 0;
  let globalSatisfactory = 0;
  let globalUnsatisfactory = 0;

  const parameters: ParameterMetrics[] = BCE_FEEDBACK_PARAMETERS.map(param => {
    const pId = param.id;
    const acc = paramAccumulators[pId] || { ex: 0, vg: 0, g: 0, s: 0, u: 0, unanswered: 0 };
    const validCount = acc.ex + acc.vg + acc.g + acc.s + acc.u;

    globalExcellent += acc.ex;
    globalVeryGood += acc.vg;
    globalGood += acc.g;
    globalSatisfactory += acc.s;
    globalUnsatisfactory += acc.u;

    const pDist = calculateDistributionPercentages(
      [acc.ex, acc.vg, acc.g, acc.s, acc.u],
      validCount
    );

    let averageScore = 0;
    if (validCount > 0) {
      const scoreSum =
        acc.ex * RATING_WEIGHTS['Excellent'] +
        acc.vg * RATING_WEIGHTS['Very Good'] +
        acc.g * RATING_WEIGHTS['Good'] +
        acc.s * RATING_WEIGHTS['Satisfactory'] +
        acc.u * RATING_WEIGHTS['Unsatisfactory'];

      averageScore = Number((scoreSum / validCount).toFixed(2));
      totalAllScores += scoreSum;
      totalAllRatings += validCount;
    }

    const interpretation =
      validCount > 0
        ? `${param.title} achieved an institutional average of ${averageScore.toFixed(2)}/5.00 across ${validCount} valid responses.`
        : `No valid response data recorded for ${param.title}.`;

    return {
      parameterId: pId,
      title: param.title,
      description: param.description || '',
      excellentCount: acc.ex,
      veryGoodCount: acc.vg,
      goodCount: acc.g,
      satisfactoryCount: acc.s,
      unsatisfactoryCount: acc.u,
      validCount,
      unansweredCount: acc.unanswered,
      excellentPct: pDist.excellentPct,
      veryGoodPct: pDist.veryGoodPct,
      goodPct: pDist.goodPct,
      satisfactoryPct: pDist.satisfactoryPct,
      unsatisfactoryPct: pDist.unsatisfactoryPct,
      averageScore,
      interpretation,
    };
  });

  const totalValidRatings =
    globalExcellent + globalVeryGood + globalGood + globalSatisfactory + globalUnsatisfactory;

  const globalDistPcts = calculateDistributionPercentages(
    [globalExcellent, globalVeryGood, globalGood, globalSatisfactory, globalUnsatisfactory],
    totalValidRatings
  );

  const distribution: OverallDistribution = {
    excellentCount: globalExcellent,
    veryGoodCount: globalVeryGood,
    goodCount: globalGood,
    satisfactoryCount: globalSatisfactory,
    unsatisfactoryCount: globalUnsatisfactory,
    totalValidRatings,
    excellentPct: globalDistPcts.excellentPct,
    veryGoodPct: globalDistPcts.veryGoodPct,
    goodPct: globalDistPcts.goodPct,
    satisfactoryPct: globalDistPcts.satisfactoryPct,
    unsatisfactoryPct: globalDistPcts.unsatisfactoryPct,
    positivePct: globalDistPcts.positivePct,
  };

  // Evaluation Parameters (Q1 to Q7) metrics & distribution
  let paramScoresSum = 0;
  let paramRatingsCount = 0;
  let paramExcellent = 0;
  let paramVeryGood = 0;
  let paramGood = 0;
  let paramSatisfactory = 0;
  let paramUnsatisfactory = 0;

  for (const param of parameters) {
    if (param.parameterId >= 1 && param.parameterId <= 7) {
      paramExcellent += param.excellentCount;
      paramVeryGood += param.veryGoodCount;
      paramGood += param.goodCount;
      paramSatisfactory += param.satisfactoryCount;
      paramUnsatisfactory += param.unsatisfactoryCount;

      const scoreSum =
        param.excellentCount * RATING_WEIGHTS['Excellent'] +
        param.veryGoodCount * RATING_WEIGHTS['Very Good'] +
        param.goodCount * RATING_WEIGHTS['Good'] +
        param.satisfactoryCount * RATING_WEIGHTS['Satisfactory'] +
        param.unsatisfactoryCount * RATING_WEIGHTS['Unsatisfactory'];

      paramScoresSum += scoreSum;
      paramRatingsCount += param.validCount;
    }
  }

  const parameterAverageScore =
    paramRatingsCount > 0 ? Number((paramScoresSum / paramRatingsCount).toFixed(2)) : 0;

  const totalValidParamRatings =
    paramExcellent + paramVeryGood + paramGood + paramSatisfactory + paramUnsatisfactory;

  const paramDistPcts = calculateDistributionPercentages(
    [paramExcellent, paramVeryGood, paramGood, paramSatisfactory, paramUnsatisfactory],
    totalValidParamRatings
  );

  const parameterDistribution: OverallDistribution = {
    excellentCount: paramExcellent,
    veryGoodCount: paramVeryGood,
    goodCount: paramGood,
    satisfactoryCount: paramSatisfactory,
    unsatisfactoryCount: paramUnsatisfactory,
    totalValidRatings: totalValidParamRatings,
    excellentPct: paramDistPcts.excellentPct,
    veryGoodPct: paramDistPcts.veryGoodPct,
    goodPct: paramDistPcts.goodPct,
    satisfactoryPct: paramDistPcts.satisfactoryPct,
    unsatisfactoryPct: paramDistPcts.unsatisfactoryPct,
    positivePct: paramDistPcts.positivePct,
  };

  // Question 8 Standalone Overall Rating distribution
  const param8 = parameters.find(p => p.parameterId === 8);
  const param8Valid = param8?.validCount || 0;
  const param8DistPcts = calculateDistributionPercentages(
    [
      param8?.excellentCount || 0,
      param8?.veryGoodCount || 0,
      param8?.goodCount || 0,
      param8?.satisfactoryCount || 0,
      param8?.unsatisfactoryCount || 0,
    ],
    param8Valid
  );

  const overallRatingDistribution: OverallDistribution = {
    excellentCount: param8?.excellentCount || 0,
    veryGoodCount: param8?.veryGoodCount || 0,
    goodCount: param8?.goodCount || 0,
    satisfactoryCount: param8?.satisfactoryCount || 0,
    unsatisfactoryCount: param8?.unsatisfactoryCount || 0,
    totalValidRatings: param8Valid,
    excellentPct: param8DistPcts.excellentPct,
    veryGoodPct: param8DistPcts.veryGoodPct,
    goodPct: param8DistPcts.goodPct,
    satisfactoryPct: param8DistPcts.satisfactoryPct,
    unsatisfactoryPct: param8DistPcts.unsatisfactoryPct,
    positivePct: param8DistPcts.positivePct,
  };

  const compositeAverageScore =
    totalAllRatings > 0 ? Number((totalAllScores / totalAllRatings).toFixed(2)) : 0;

  // Canonical Overall Rating:
  // Strictly the composite average across all evaluated parameters
  const averageOverallScore = compositeAverageScore;

  let totalStudents = 0;
  let evaluatedItems = 0;
  let totalSubmissions = 0;
  let includedCount = 0;
  let excludedCount = 0;
  for (const report of formReports) {
    totalStudents += report.totalStudents ?? report.totalResponses;
    evaluatedItems += report.evaluatedItems ?? report.validResponses;
    totalSubmissions += report.totalSubmissions ?? report.totalResponses;
    includedCount += report.includedCount ?? report.totalResponses;
    excludedCount += report.excludedCount ?? 0;
  }

  const percentage =
    totalAllRatings > 0 ? Number(((compositeAverageScore / 5) * 100).toFixed(2)) : 0;

  const hasData = validResponses > 0;
  const performanceGrade = calculatePerformanceGrade(averageOverallScore, hasData);
  const performanceGradeInfo = getPerformanceGradeInfo(averageOverallScore, hasData);

  // Build faculty comparison array for forms with responses
  const facultyComparisons: FacultyComparisonItem[] = [];
  for (const f of formsWithData) {
    if (f.facultyGrids && f.facultyGrids.length > 0) {
      for (const grid of f.facultyGrids) {
        facultyComparisons.push({
          formId: f.formId,
          facultyName: grid.facultyName || f.facultyName,
          subjectName: grid.subjectName || f.subjectName,
          subjectCode: grid.subjectCode || f.subjectCode,
          branch: f.branch,
          semester: f.semester,
          academicYear: f.academicYear,
          responseCount: grid.report?.totalStudents ?? grid.report?.totalResponses ?? (f.totalStudents ?? f.totalResponses),
          averageScore: grid.report?.averageOverallScore || grid.report?.compositeAverageScore || f.averageOverallScore,
        });
      }
    } else {
      facultyComparisons.push({
        formId: f.formId,
        facultyName: f.facultyName,
        subjectName: f.subjectName,
        subjectCode: f.subjectCode,
        branch: f.branch,
        semester: f.semester,
        academicYear: f.academicYear,
        responseCount: f.totalStudents ?? f.totalResponses,
        averageScore: f.averageOverallScore || f.compositeAverageScore,
      });
    }
  }
  facultyComparisons.sort((a, b) => b.averageScore - a.averageScore);

  return {
    scopeTitle,
    filters,
    totalForms,
    formsWithResponses,
    totalResponses,
    totalStudents,
    totalSubmissions,
    includedCount,
    excludedCount,
    evaluatedItems,
    percentage,
    validResponses,
    parameterAverageScore,
    averageOverallScore,
    compositeAverageScore,
    performanceGrade,
    performanceGradeInfo,
    parameters,
    distribution,
    parameterDistribution,
    overallRatingDistribution,
    facultyComparisons,
    hasData,
    generatedAt: new Date().toISOString(),
  };
}
