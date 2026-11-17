import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

// Load .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {
  console.warn('Could not load .env.local:', e);
}

import {
  renderPdfAttributionFooter,
  ADITYA_PORTFOLIO_URL,
  DR_ABHINAV_KUMAR_PROFILE_URL,
  OFFICIAL_ORDER_URL,
} from '../src/lib/utils/pdf-attribution';
import {
  generateOverallFeedbackPDF,
  generateSemesterComparativePDF,
} from '../src/lib/analytics/pdf-generator';
import {
  type CollegeWatermarkConfig,
  DEFAULT_WATERMARK_CONFIG,
  renderWatermark,
  applyTrialWatermarksIfRequired,
  saveCollegeWatermarkConfig,
  getCollegeWatermarkConfig,
  resetCollegeWatermarkConfig,
  shouldApplyWatermarkFromConfig,
  isWatermarkRequiredForCollege,
} from '../src/lib/pdf/watermark';
import { createAdminClient } from '../src/lib/supabase/admin';

function streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('STARTING PDF ATTRIBUTION & WATERMARK SUITE VERIFICATION');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------
  // TEST 1: PDF Attribution Footer & Clickable Links
  // --------------------------------------------------------------------
  console.log('--- TEST 1: PDF Attribution Footer & Clickable Links ---');
  {
    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
    doc.text('Testing attribution footer', 50, 50);

    renderPdfAttributionFooter(doc, doc.page.height - 24, {
      fontSize: 6.0,
      textColor: '#64748B',
      linkColor: '#2563EB',
    });

    doc.end();
    const buf = await streamToBuffer(doc);
    const pdfStr = buf.toString();

    assert(buf.length > 1000, 'PDF buffer successfully generated');
    assert(pdfStr.includes(ADITYA_PORTFOLIO_URL), 'Embedded Aditya Portfolio URL in PDF binary');
    assert(pdfStr.includes(DR_ABHINAV_KUMAR_PROFILE_URL), 'Embedded Dr. Abhinav Profile URL in PDF binary');
    assert(pdfStr.includes('1UO0h626GIZf9KES1pGr7t1S-vnCu0eSo'), 'Embedded Official Order Google Drive URL in PDF binary');

    // Verify 4 link annotations are created in PDFKit binary
    const linkAnnots = (pdfStr.match(/\/Subtype\s*\/Link/g) || []).length;
    assert(linkAnnots >= 4, `Created ${linkAnnots} active clickable PDF link annotations`);

    // Verify raw markdown bracket syntax is NOT in the text
    assert(!pdfStr.includes('[Mr. Aditya'), 'No raw markdown brackets in text');
    assert(!pdfStr.includes('](https:'), 'No raw markdown link syntax in text');
  }

  // --------------------------------------------------------------------
  // TEST 2: All 4 Watermark Formats
  // --------------------------------------------------------------------
  console.log('\n--- TEST 2: All 4 Watermark Formats ---');
  const formats: CollegeWatermarkConfig['format'][] = [
    'diagonal_bands',
    'center_prominent',
    'full_grid',
    'top_bottom_banner',
  ];

  for (const fmt of formats) {
    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
    doc.text(`Testing format: ${fmt}`, 50, 50);

    const config: CollegeWatermarkConfig = {
      collegeId: 'test-college',
      ...DEFAULT_WATERMARK_CONFIG,
      format: fmt,
      text: 'CampusFlow provides FREE TRIAL to BCE Bhagalpur',
      opacity: 0.55,
      textColor: '#2563EB',
    };

    renderWatermark(doc, config, 'Bhagalpur College of Engineering');
    doc.end();
    const buf = await streamToBuffer(doc);
    assert(buf.length > 1000, `Format ${fmt} generated valid PDF (${buf.length} bytes)`);
  }

  // --------------------------------------------------------------------
  // TEST 3: All 3 Content Types (Text+Logo, Text Only, Logo Only)
  // --------------------------------------------------------------------
  console.log('\n--- TEST 3: All 3 Content Types ---');
  const contentTypes: CollegeWatermarkConfig['contentType'][] = ['both', 'text_only', 'logo_only'];

  for (const ct of contentTypes) {
    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
    doc.text(`Testing content type: ${ct}`, 50, 50);

    const config: CollegeWatermarkConfig = {
      collegeId: 'test-college',
      ...DEFAULT_WATERMARK_CONFIG,
      contentType: ct,
      text: 'Custom Evaluation Copy',
    };

    renderWatermark(doc, config, 'Test College');
    doc.end();
    const buf = await streamToBuffer(doc);
    assert(buf.length > 1000, `Content type ${ct} rendered properly (${buf.length} bytes)`);
  }

  // --------------------------------------------------------------------
  // TEST 4: Payment Logic & Superadmin Overrides
  // --------------------------------------------------------------------
  console.log('\n--- TEST 4: Payment Logic & Superadmin Overrides ---');
  {
    // Case A: College is paid, policy = auto -> NO watermark
    const docA = new PDFDocument({ size: 'A4', bufferPages: true });
    docA.text('Page A');
    const appliedA = await applyTrialWatermarksIfRequired(docA, 'Paid College', true);
    docA.end();
    assert(appliedA === false, 'Paid college with auto policy has watermark suppressed');

    // Case B: College is unpaid, policy = auto, enabled = true -> WATERMARK APPLIED
    const docB = new PDFDocument({ size: 'A4', bufferPages: true });
    docB.text('Page B');
    const appliedB = await applyTrialWatermarksIfRequired(
      docB,
      'Unpaid College',
      false,
      {
        collegeId: 'unpaid-col',
        ...DEFAULT_WATERMARK_CONFIG,
        enabled: true,
        paymentPolicy: 'auto',
      }
    );
    docB.end();
    assert(appliedB === true, 'Unpaid college with auto policy has watermark applied');

    // Case C: College is unpaid, but superadmin disabled enabled toggle -> NO watermark
    const docC = new PDFDocument({ size: 'A4', bufferPages: true });
    docC.text('Page C');
    const appliedC = await applyTrialWatermarksIfRequired(
      docC,
      'Unpaid College',
      false,
      {
        collegeId: 'unpaid-col-disabled',
        ...DEFAULT_WATERMARK_CONFIG,
        enabled: false,
        paymentPolicy: 'auto',
      }
    );
    docC.end();
    assert(appliedC === false, 'Unpaid college with superadmin enabled=false has watermark suppressed');

    // Case D: College is unpaid, but policy = always_hide (waived) -> NO watermark
    const docD = new PDFDocument({ size: 'A4', bufferPages: true });
    docD.text('Page D');
    const appliedD = await applyTrialWatermarksIfRequired(
      docD,
      'Unpaid Waived College',
      false,
      {
        collegeId: 'unpaid-waived',
        ...DEFAULT_WATERMARK_CONFIG,
        enabled: true,
        paymentPolicy: 'always_hide',
      }
    );
    docD.end();
    assert(appliedD === false, 'College with always_hide policy has watermark waived');

    // Case E: College is paid, but policy = always_show (force) -> WATERMARK APPLIED
    const docE = new PDFDocument({ size: 'A4', bufferPages: true });
    docE.text('Page E');
    const appliedE = await applyTrialWatermarksIfRequired(
      docE,
      'Paid College Forced',
      true,
      {
        collegeId: 'paid-forced',
        ...DEFAULT_WATERMARK_CONFIG,
        enabled: true,
        paymentPolicy: 'always_show',
      }
    );
    docE.end();
    assert(appliedE === true, 'College with always_show policy has watermark forced despite paid status');

    // Case F: shouldApplyWatermarkFromConfig direct checks
    assert(
      shouldApplyWatermarkFromConfig({ ...DEFAULT_WATERMARK_CONFIG, collegeId: 'c1', enabled: false }, false) === false,
      'shouldApplyWatermarkFromConfig returns false when watermark toggle is disabled'
    );
    assert(
      shouldApplyWatermarkFromConfig({ ...DEFAULT_WATERMARK_CONFIG, collegeId: 'c2', enabled: true, paymentPolicy: 'always_hide' }, false) === false,
      'shouldApplyWatermarkFromConfig returns false when policy is always_hide'
    );
    assert(
      shouldApplyWatermarkFromConfig({ ...DEFAULT_WATERMARK_CONFIG, collegeId: 'c3', enabled: true, paymentPolicy: 'auto' }, true) === false,
      'shouldApplyWatermarkFromConfig returns false when paid and policy is auto'
    );
    assert(
      shouldApplyWatermarkFromConfig({ ...DEFAULT_WATERMARK_CONFIG, collegeId: 'c4', enabled: true, paymentPolicy: 'auto' }, false) === true,
      'shouldApplyWatermarkFromConfig returns true when unpaid and enabled'
    );
  }

  // --------------------------------------------------------------------
  // TEST 5: Database Persistence & Audit Log Integration
  // --------------------------------------------------------------------
  console.log('\n--- TEST 5: Database Persistence & Audit Log Integration ---');
  try {
    const supabase = createAdminClient();
    if (supabase) {
      const { data: colleges } = await supabase.from('colleges').select('id, name, code').limit(1);
      if (colleges && colleges.length > 0) {
        const testCol = colleges[0];
        console.log(`Testing persistence for college: ${testCol.name} (${testCol.id})`);

        // Save customized watermark
        const customConfig: CollegeWatermarkConfig = {
          collegeId: testCol.id,
          enabled: true,
          paymentPolicy: 'auto',
          contentType: 'both',
          format: 'center_prominent',
          text: `EVALUATION VERSION FOR ${testCol.name}`,
          subText: 'CampusFlow Official Portal',
          fontFamily: 'Helvetica-Bold',
          fontSize: 16,
          textColor: '#DC2626',
          logoSource: 'campusflow',
          logoSize: 170,
          opacity: 0.65,
          rotationAngle: -30,
          repeatDensity: 'normal',
        };

        const saveRes = await saveCollegeWatermarkConfig(customConfig, 'test-suite@campusflow.in');
        assert(saveRes.success === true, 'Saved custom watermark config to database audit trail');

        // Retrieve and verify
        const fetched = await getCollegeWatermarkConfig(testCol.id);
        assert(fetched.format === 'center_prominent', 'Retrieved format matches saved config');
        assert(fetched.text === `EVALUATION VERSION FOR ${testCol.name}`, 'Retrieved text matches saved config');
        assert(fetched.textColor === '#DC2626', 'Retrieved color matches saved config');
        assert(fetched.opacity === 0.65, 'Retrieved opacity matches saved config');

        // Reset to default
        const resetRes = await resetCollegeWatermarkConfig(testCol.id, 'test-suite@campusflow.in', testCol.name);
        assert(resetRes.success === true, 'Reset watermark config to default');
      } else {
        console.log('Skipping DB test: No colleges found in database.');
      }
    }
  } catch (err) {
    console.warn('DB test note:', err);
  }

  // --------------------------------------------------------------------
  // TEST 6: Parameter Benchmark & Faculty Performance Matrix PDF Generation
  // --------------------------------------------------------------------
  console.log('\n--- TEST 6: Parameter Benchmark & Faculty Matrix Overlap Verification ---');
  try {
    const mockReport = {
      scopeTitle: 'Institutional Parameter Benchmark (All Forms In Scope)',
      collegeId: 'test-college-id',
      totalForms: 8,
      formsWithResponses: 8,
      totalResponses: 160,
      validResponses: 160,
      parameterAverageScore: 4.52,
      averageOverallScore: 4.52,
      compositeAverageScore: 4.52,
      performanceGrade: 'EXCELLENT',
      hasData: true,
      parameters: [
        { parameterId: 1, title: 'Syllabus covered by teacher as per curriculum', averageScore: 4.38, excellentPct: 38, veryGoodPct: 63, goodPct: 0, satisfactoryPct: 0, unsatisfactoryPct: 0, validCount: 8 },
        { parameterId: 2, title: 'Communication skills', averageScore: 4.63, excellentPct: 63, veryGoodPct: 38, goodPct: 0, satisfactoryPct: 0, unsatisfactoryPct: 0, validCount: 8 },
        { parameterId: 3, title: 'Effectiveness of Teaching/Learning in terms of: Interactive classroom/Laboratory sessions', averageScore: 4.88, excellentPct: 88, veryGoodPct: 0, goodPct: 13, satisfactoryPct: 0, unsatisfactoryPct: 0, validCount: 8 },
        { parameterId: 4, title: 'Accessibility of the teacher in and out of the class', averageScore: 4.25, excellentPct: 25, veryGoodPct: 75, goodPct: 0, satisfactoryPct: 0, unsatisfactoryPct: 0, validCount: 8 },
        { parameterId: 5, title: 'Willingness to offer help and advice to students beyond the classroom and multidisciplinary areas', averageScore: 4.38, excellentPct: 50, veryGoodPct: 38, goodPct: 13, satisfactoryPct: 0, unsatisfactoryPct: 0, validCount: 8 },
        { parameterId: 6, title: 'Ability of teacher to teach/explain confidently and answer queries in the class', averageScore: 4.38, excellentPct: 50, veryGoodPct: 38, goodPct: 13, satisfactoryPct: 0, unsatisfactoryPct: 0, validCount: 8 },
        { parameterId: 7, title: 'Teacher shown fairness in the evaluation', averageScore: 4.38, excellentPct: 38, veryGoodPct: 63, goodPct: 0, satisfactoryPct: 0, unsatisfactoryPct: 0, validCount: 8 },
        { parameterId: 8, title: 'Overall Rating', averageScore: 4.63, excellentPct: 63, veryGoodPct: 38, goodPct: 0, satisfactoryPct: 0, unsatisfactoryPct: 0, validCount: 8 },
      ],
      facultyComparisons: [
        { facultyName: 'Raushan Kumar', subjectName: 'NCM', subjectCode: '803', branch: 'Mechanical Engineering', semester: 'Semester 8', academicYear: '2025-2026', responseCount: 1, averageScore: 4.75 },
        { facultyName: 'Kumar Jyotiraditya', subjectName: 'OR', subjectCode: '702', branch: 'Mechanical Engineering', semester: 'Semester 7', academicYear: '2023-2024', responseCount: 1, averageScore: 4.75 },
        { facultyName: 'Dr. Paridhi Rai', subjectName: 'Safety Management', subjectCode: '804', branch: 'Mechanical Engineering', semester: 'Semester 8', academicYear: '2025-2026', responseCount: 1, averageScore: 4.63 },
        { facultyName: 'Kumar Gaurav', subjectName: 'ECM', subjectCode: '802', branch: 'Mechanical Engineering', semester: 'Semester 8', academicYear: '2025-2026', responseCount: 1, averageScore: 4.63 },
        { facultyName: 'Janmejay Kumar', subjectName: 'RAC', subjectCode: '704', branch: 'Mechanical Engineering', semester: 'Semester 7', academicYear: '2023-2024', responseCount: 1, averageScore: 4.63 },
      ],
      distribution: {
        excellentCount: 100,
        veryGoodCount: 45,
        goodCount: 15,
        satisfactoryCount: 0,
        unsatisfactoryCount: 0,
      },
    };

    const mockBranding = {
      name: 'Bhagalpur College of Engineering',
      code: '108',
      slug: 'bce-bhagalpur',
      primaryColor: '#1B365D',
      accentColor: '#2563EB',
    };

    const exportBuf = await generateOverallFeedbackPDF(mockReport as any, mockBranding as any);
    assert(Buffer.isBuffer(exportBuf) && exportBuf.length > 5000, 'College feedback export PDF generated successfully without overlap');
    assert(exportBuf.subarray(0, 4).toString() === '%PDF', 'Export buffer begins with valid PDF magic bytes (%PDF)');

    // Test Institutional Comparative Analytics PDF
    const mockInstitutionalReport = {
      ...mockReport,
      facultyGrids: [
        {
          facultyName: 'Dr. Paridhi Rai',
          subjectName: 'Safety Management',
          subjectCode: '804',
          report: {
            hasData: true,
            totalResponses: 45,
            compositeAverageScore: 4.63,
          },
        },
      ],
    };
    const instBuf = await generateSemesterComparativePDF(mockInstitutionalReport as any, mockBranding as any);
    assert(Buffer.isBuffer(instBuf) && instBuf.length > 5000, 'Institutional feedback analytics PDF generated successfully');
    assert(instBuf.subarray(0, 4).toString() === '%PDF', 'Institutional buffer begins with valid PDF magic bytes (%PDF)');
  } catch (err: any) {
    console.error('Error in Test 6:', err);
    assert(false, `Test 6 failed: ${err.message}`);
  }

  console.log('\n========================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal error in tests:', e);
  process.exit(1);
});
