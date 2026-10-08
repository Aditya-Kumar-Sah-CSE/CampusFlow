/**
 * CampusFlow Synthetic Staging Dataset Seeder
 * ===========================================
 * Generates a realistic, fully populated synthetic dataset for staging load testing.
 * 
 * CRITICAL SAFETY RULES:
 * 1. ZERO PRODUCTION MUTATIONS: Refuses execution if SUPABASE_URL contains txerarcajxjzxifanzxw.
 * 2. ZERO REAL PII: Uses synthetic names, emails, and identifiers exclusively.
 * 3. REALISTIC DATA VOLUME: Creates academic entities, published events, exams, and feedback forms.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  console.error('Usage: $env:SUPABASE_URL="https://<staging>.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="<key>"; node scripts/seed-staging-synthetic.mjs');
  process.exit(1);
}

// Production safety circuit breaker
if (SUPABASE_URL.includes('txerarcajxjzxifanzxw')) {
  console.error('FATAL SAFETY VIOLATION: Target SUPABASE_URL is the LIVE PRODUCTION instance (txerarcajxjzxifanzxw)!');
  console.error('This script must NEVER be executed against production. Execution terminated.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`Starting synthetic staging seeding against: ${SUPABASE_URL}`);

  // 1. College Tenant: BCE Bhagalpur (bce-bgp)
  const collegeId = 'bce00000-0000-0000-0000-000000000001';
  console.log('Seeding college tenant...');
  const { error: collegeErr } = await supabase.from('colleges').upsert({
    id: collegeId,
    name: 'Bhagalpur College of Engineering (Staging)',
    code: 'BCE-BGP',
    slug: 'bce-bgp',
    tagline: 'Govt. of Bihar | Staging Environment',
    established_year: 1960,
    aicte_approved: true,
    affiliated_university: 'Bihar Engineering University, Patna',
    primary_color: '#0B192C',
    secondary_color: '#1E3E62',
    accent_color: '#F6995C',
    is_active: true,
  }, { onConflict: 'code' });
  if (collegeErr) console.warn('College upsert note:', collegeErr.message);

  // 2. Academic Years
  console.log('Seeding academic years...');
  const years = [
    { id: 'a1000000-0000-0000-0000-000000000001', college_id: collegeId, name: '2024-2025', is_active: true },
    { id: 'a1000000-0000-0000-0000-000000000002', college_id: collegeId, name: '2025-2026', is_active: true },
    { id: 'a1000000-0000-0000-0000-000000000003', college_id: collegeId, name: '2026-2027', is_active: true },
  ];
  const { error: yrErr } = await supabase.from('academic_years').upsert(years, { onConflict: 'id' });
  if (yrErr) console.warn('Academic years note:', yrErr.message);

  // 3. Branches
  console.log('Seeding academic branches...');
  const branches = [
    { id: 'b1000000-0000-0000-0000-000000000001', college_id: collegeId, name: 'Computer Science & Engineering', code: 'CSE', is_active: true },
    { id: 'b1000000-0000-0000-0000-000000000002', college_id: collegeId, name: 'Electronics & Communication Engineering', code: 'ECE', is_active: true },
    { id: 'b1000000-0000-0000-0000-000000000003', college_id: collegeId, name: 'Mechanical Engineering', code: 'ME', is_active: true },
    { id: 'b1000000-0000-0000-0000-000000000004', college_id: collegeId, name: 'Civil Engineering', code: 'CE', is_active: true },
    { id: 'b1000000-0000-0000-0000-000000000005', college_id: collegeId, name: 'Electrical Engineering', code: 'EE', is_active: true },
  ];
  const { error: brErr } = await supabase.from('branches').upsert(branches, { onConflict: 'id' });
  if (brErr) console.warn('Branches note:', brErr.message);

  // 4. Semesters
  console.log('Seeding semesters...');
  const semesters = [];
  for (let s = 1; s <= 8; s++) {
    semesters.push({
      id: `c1000000-0000-0000-0000-00000000000${s}`,
      college_id: collegeId,
      name: `Semester ${s}`,
      semester_number: s,
      is_active: true,
    });
  }
  const { error: semErr } = await supabase.from('semesters').upsert(semesters, { onConflict: 'id' });
  if (semErr) console.warn('Semesters note:', semErr.message);

  // 5. Published Events
  console.log('Seeding published events...');
  const now = new Date();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const events = [
    {
      college_id: collegeId,
      title: 'TechnoSphere 2026 Annual Tech Fest',
      slug: 'technosphere-2026',
      description: 'The premier national technical symposium of BCE Bhagalpur featuring hackathons and tech talks.',
      venue: 'Main College Auditorium & Labs',
      start_at: now.toISOString(),
      end_at: future.toISOString(),
      registration_start: now.toISOString(),
      registration_end: future.toISOString(),
      status: 'PUBLISHED',
      registration_enabled: true,
      max_capacity: 500,
    },
    {
      college_id: collegeId,
      title: 'AI & Machine Learning Boot Camp',
      slug: 'ai-ml-bootcamp-2026',
      description: 'Hands-on workshop on deep learning, neural networks, and model deployment.',
      venue: 'CSE Department Lab 3',
      start_at: now.toISOString(),
      end_at: future.toISOString(),
      registration_start: now.toISOString(),
      registration_end: future.toISOString(),
      status: 'PUBLISHED',
      registration_enabled: true,
      max_capacity: 200,
    },
    {
      college_id: collegeId,
      title: 'Robotics Design Challenge 2026',
      slug: 'robotics-challenge-2026',
      description: 'Autonomous rover challenge and line follower competition.',
      venue: 'Mechanical Workshop Arena',
      start_at: now.toISOString(),
      end_at: future.toISOString(),
      registration_start: now.toISOString(),
      registration_end: future.toISOString(),
      status: 'PUBLISHED',
      registration_enabled: true,
      max_capacity: 150,
    },
  ];
  for (const ev of events) {
    const { error: evErr } = await supabase.from('events').upsert(ev, { onConflict: 'college_id,slug' });
    if (evErr) console.warn(`Event ${ev.slug} note:`, evErr.message);
  }

  // 6. Published Exams
  console.log('Seeding published exams...');
  const exams = [
    {
      id: 'e1000000-0000-0000-0000-000000000001',
      college_id: collegeId,
      academic_session_id: 'a1000000-0000-0000-0000-000000000002',
      semester_id: 'c1000000-0000-0000-0000-000000000005',
      title: 'Design & Analysis of Algorithms (Mid-Term)',
      exam_code: 'CSE-501-DAA',
      description: 'Comprehensive mid-term examination covering asymptotic analysis, dynamic programming, and greedy methods.',
      instructions: 'Total 20 MCQ questions. 45 minutes duration. No calculators allowed.',
      duration_minutes: 45,
      passing_percentage: 40.0,
      status: 'PUBLISHED',
      total_marks: 50,
      total_questions: 10,
    },
    {
      id: 'e1000000-0000-0000-0000-000000000002',
      college_id: collegeId,
      academic_session_id: 'a1000000-0000-0000-0000-000000000002',
      semester_id: 'c1000000-0000-0000-0000-000000000005',
      title: 'Database Management Systems Assessment',
      exam_code: 'CSE-502-DBMS',
      description: 'Relational algebra, SQL query optimization, normalization, and ACID properties.',
      instructions: 'Total 15 questions. 30 minutes duration.',
      duration_minutes: 30,
      passing_percentage: 40.0,
      status: 'PUBLISHED',
      total_marks: 30,
      total_questions: 10,
    },
  ];
  for (const ex of exams) {
    const { error: exErr } = await supabase.from('exams').upsert(ex, { onConflict: 'id' });
    if (exErr) console.warn(`Exam ${ex.exam_code} note:`, exErr.message);
  }

  // 7. Published Feedback Forms
  console.log('Seeding feedback forms...');
  const feedbackForms = [
    {
      college_id: collegeId,
      title: 'Semester 5 Faculty Performance & Course Feedback',
      slug: 'sem5-faculty-feedback-2026',
      description: 'Anonymous academic feedback regarding course delivery and laboratory guidance.',
      academic_year_id: 'a1000000-0000-0000-0000-000000000002',
      branch_id: 'b1000000-0000-0000-0000-000000000001',
      semester_id: 'c1000000-0000-0000-0000-000000000005',
      form_type: 'SEMESTER_FEEDBACK',
      status: 'PUBLISHED',
      response_count: 42,
    },
    {
      college_id: collegeId,
      title: 'Institutional Infrastructure & Library Facilities Survey',
      slug: 'institutional-infrastructure-2026',
      description: 'Campus facility evaluation including Wi-Fi, digital library, and classroom acoustics.',
      academic_year_id: 'a1000000-0000-0000-0000-000000000002',
      branch_id: 'b1000000-0000-0000-0000-000000000001',
      semester_id: 'c1000000-0000-0000-0000-000000000005',
      form_type: 'SEMESTER_FEEDBACK',
      status: 'PUBLISHED',
      response_count: 88,
    },
  ];
  for (const ff of feedbackForms) {
    const { error: ffErr } = await supabase.from('feedback_forms').upsert(ff, { onConflict: 'college_id,slug' });
    if (ffErr) console.warn(`Feedback form ${ff.slug} note:`, ffErr.message);
  }

  // 8. PWA Installation Baseline Counter
  console.log('Seeding PWA installation record...');
  const { error: pwaErr } = await supabase.from('pwa_installations').upsert({
    id: 'd1000000-0000-0000-0000-000000000001',
    college_id: collegeId,
    installation_id: 'bce00000-0000-0000-0000-000000000099',
    device_type: 'android',
    user_agent: 'CampusFlow Staging Agent',
    installed_at: new Date().toISOString(),
  }, { onConflict: 'college_id,installation_id' });
  if (pwaErr) console.warn('PWA installation note:', pwaErr.message);

  // 9. Exam Questions & Options (Realistic Assessment Workload)
  console.log('Seeding exam questions and options...');
  const examId = 'e1000000-0000-0000-0000-000000000001';
  const questions = [
    { id: 'f1000000-0000-0000-0000-000000000001', exam_id: examId, college_id: collegeId, question_text: 'What is the average time complexity of QuickSort?', marks: 5.0, position: 1 },
    { id: 'f1000000-0000-0000-0000-000000000002', exam_id: examId, college_id: collegeId, question_text: 'Which data structure is primarily used to implement Breadth-First Search (BFS)?', marks: 5.0, position: 2 },
    { id: 'f1000000-0000-0000-0000-000000000003', exam_id: examId, college_id: collegeId, question_text: 'Dynamic Programming solves problems using which foundational approach?', marks: 5.0, position: 3 },
    { id: 'f1000000-0000-0000-0000-000000000004', exam_id: examId, college_id: collegeId, question_text: 'Dijkstras algorithm cannot be safely used when graphs have:', marks: 5.0, position: 4 },
  ];
  for (const q of questions) {
    const { error: qErr } = await supabase.from('exam_questions').upsert(q, { onConflict: 'id' });
    if (qErr) console.warn('Question note:', qErr.message);
  }

  const options = [
    { question_id: 'f1000000-0000-0000-0000-000000000001', option_key: 'A', option_text: 'O(n log n)', is_correct: true, position: 1 },
    { question_id: 'f1000000-0000-0000-0000-000000000001', option_key: 'B', option_text: 'O(n^2)', is_correct: false, position: 2 },
    { question_id: 'f1000000-0000-0000-0000-000000000001', option_key: 'C', option_text: 'O(log n)', is_correct: false, position: 3 },
    { question_id: 'f1000000-0000-0000-0000-000000000001', option_key: 'D', option_text: 'O(n)', is_correct: false, position: 4 },
    { question_id: 'f1000000-0000-0000-0000-000000000002', option_key: 'A', option_text: 'Queue', is_correct: true, position: 1 },
    { question_id: 'f1000000-0000-0000-0000-000000000002', option_key: 'B', option_text: 'Stack', is_correct: false, position: 2 },
    { question_id: 'f1000000-0000-0000-0000-000000000002', option_key: 'C', option_text: 'Heap', is_correct: false, position: 3 },
    { question_id: 'f1000000-0000-0000-0000-000000000002', option_key: 'D', option_text: 'Linked List', is_correct: false, position: 4 },
    { question_id: 'f1000000-0000-0000-0000-000000000003', option_key: 'A', option_text: 'Optimal substructure and overlapping subproblems', is_correct: true, position: 1 },
    { question_id: 'f1000000-0000-0000-0000-000000000003', option_key: 'B', option_text: 'Divide and conquer without memoization', is_correct: false, position: 2 },
    { question_id: 'f1000000-0000-0000-0000-000000000003', option_key: 'C', option_text: 'Greedy choice at every local step', is_correct: false, position: 3 },
    { question_id: 'f1000000-0000-0000-0000-000000000003', option_key: 'D', option_text: 'Randomized pivot elimination', is_correct: false, position: 4 },
    { question_id: 'f1000000-0000-0000-0000-000000000004', option_key: 'A', option_text: 'Negative edge weights', is_correct: true, position: 1 },
    { question_id: 'f1000000-0000-0000-0000-000000000004', option_key: 'B', option_text: 'Directed cycles', is_correct: false, position: 2 },
    { question_id: 'f1000000-0000-0000-0000-000000000004', option_key: 'C', option_text: 'Multiple components', is_correct: false, position: 3 },
    { question_id: 'f1000000-0000-0000-0000-000000000004', option_key: 'D', option_text: 'Dense edges', is_correct: false, position: 4 },
  ];
  for (const opt of options) {
    const { error: optErr } = await supabase.from('exam_question_options').upsert(opt, { onConflict: 'question_id,option_key' });
    if (optErr) console.warn('Option note:', optErr.message);
  }

  console.log('Synthetic staging seeding completed successfully!');
}

main().catch((err) => {
  console.error('Unhandled seeding error:', err);
  process.exit(1);
});
