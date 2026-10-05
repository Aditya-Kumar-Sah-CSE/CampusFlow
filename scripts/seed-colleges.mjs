/**
 * seed-colleges.mjs
 * ─────────────────────────────────────────────────────────────
 * Bulk-create Bihar Engineering Colleges via Supabase Admin API.
 * Mirrors exactly what createInstitutionAction() does:
 *   1. Insert into public.colleges
 *   2. Create a FREE billing account in college_billing_accounts
 *   3. Set show_feedbacks=true, show_events=true on the college row
 *
 * Usage:  node scripts/seed-colleges.mjs
 * ─────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';

// ── Supabase connection (service role = full admin) ──────────
const SUPABASE_URL  = 'https://txerarcajxjzxifanzxw.supabase.co';
const SERVICE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4ZXJhcmNhanhqenhpZmFuenh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDAzNzg2MSwiZXhwIjoyMTA1NjEzODYxfQ.VzD6hoNi3Tm-ZOoo2nUzMB1eirQ8HMf45UmPP8F_FX8';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── All 37 colleges from the user-provided table ─────────────
const COLLEGES = [
  { name: 'Muzaffarpur Institute of Technology',                      code: '107', slug: 'mit-muzaffarpur',            district: 'Muzaffarpur',    year: 1954 },
  { name: 'Motihari College of Engineering',                          code: '113', slug: 'mce-motihari',               district: 'East Champaran', year: 1980 },
  { name: 'Darbhanga College of Engineering',                         code: '111', slug: 'dce-darbhanga',              district: 'Darbhanga',      year: 1982 },
  { name: 'Nalanda College of Engineering',                           code: '109', slug: 'nce-chandi',                 district: 'Nalanda',        year: 2008 },
  { name: 'Lok Nayak Jai Prakash Institute of Technology',            code: '117', slug: 'ljpiet-chapra',              district: 'Saran',          year: 2012 },
  { name: 'Sitamarhi Institute of Technology',                        code: '127', slug: 'sit-sitamarhi',              district: 'Sitamarhi',      year: 2016 },
  { name: 'Bakhtiyarpur College of Engineering',                      code: '126', slug: 'bce-bakhtiyarpur',           district: 'Patna',          year: 2016 },
  { name: 'Rashtrakavi Ramdhari Singh Dinkar College of Engineering', code: '125', slug: 'rrsdce-begusarai',           district: 'Begusarai',      year: 2016 },
  { name: 'Katihar Engineering College',                              code: '129', slug: 'kec-katihar',                district: 'Katihar',        year: 2016 },
  { name: 'Shershah Engineering College',                             code: '124', slug: 'sec-sasaram',                district: 'Rohtas',         year: 2016 },
  { name: 'B. P. Mandal College of Engineering',                      code: '128', slug: 'bpmce-madhepura',            district: 'Madhepura',      year: 2016 },
  { name: 'Saharsa College of Engineering',                           code: '132', slug: 'sce-saharsa',                district: 'Saharsa',        year: 2017 },
  { name: 'Supaul College of Engineering',                            code: '130', slug: 'supaul-engineering-college', district: 'Supaul',         year: 2017 },
  { name: 'Purnea College of Engineering',                            code: '131', slug: 'pce-purnea',                 district: 'Purnia',         year: 2017 },
  { name: 'Government Engineering College, Vaishali',                 code: '135', slug: 'gec-vaishali',               district: 'Vaishali',       year: 2018 },
  { name: 'Government Engineering College, Banka',                    code: '134', slug: 'gec-banka',                  district: 'Banka',          year: 2018 },
  { name: 'Government Engineering College, Jamui',                    code: '133', slug: 'gec-jamui',                  district: 'Jamui',          year: 2018 },
  { name: 'Government Engineering College, Bhojpur',                  code: '156', slug: 'gec-bhojpur',                district: 'Bhojpur',        year: 2018 },
  { name: 'Government Engineering College, Siwan',                    code: '151', slug: 'gec-siwan',                  district: 'Siwan',          year: 2018 },
  { name: 'Government Engineering College, Madhubani',                code: '150', slug: 'gec-madhubani',              district: 'Madhubani',      year: 2019 },
  { name: 'Government Engineering College, Arwal',                    code: '153', slug: 'gec-arwal',                  district: 'Arwal',          year: 2019 },
  { name: 'Government Engineering College, Aurangabad',               code: '147', slug: 'gec-aurangabad',             district: 'Aurangabad',     year: 2019 },
  { name: 'Government Engineering College, Jehanabad',                code: '152', slug: 'gec-jehanabad',              district: 'Jehanabad',      year: 2019 },
  { name: 'Government Engineering College, Khagaria',                 code: '154', slug: 'gec-khagaria',               district: 'Khagaria',       year: 2019 },
  { name: 'Government Engineering College, Buxar',                    code: '155', slug: 'gec-buxar',                  district: 'Buxar',          year: 2019 },
  { name: 'Government Engineering College, Sheikhpura',               code: '157', slug: 'gec-sheikhpura',             district: 'Sheikhpura',     year: 2019 },
  { name: 'Government Engineering College, Lakhisarai',               code: '158', slug: 'gec-lakhisarai',             district: 'Lakhisarai',     year: 2019 },
  { name: 'Government Engineering College, Kishanganj',               code: '142', slug: 'gec-kishanganj',             district: 'Kishanganj',     year: 2019 },
  { name: 'Government Engineering College, Sheohar',                  code: '145', slug: 'gec-sheohar',                district: 'Sheohar',        year: 2019 },
  { name: 'Government Engineering College, Kaimur',                   code: '148', slug: 'gec-kaimur',                 district: 'Kaimur',         year: 2019 },
  { name: 'Government Engineering College, Gopalganj',                code: '149', slug: 'gec-gopalganj',              district: 'Gopalganj',      year: 2019 },
  { name: 'Government Engineering College, Munger',                   code: '144', slug: 'gec-munger',                 district: 'Munger',         year: 2019 },
  { name: 'Government Engineering College, West Champaran',           code: '146', slug: 'gec-west-champaran',         district: 'West Champaran', year: 2019 },
  { name: 'Government Engineering College, Nawada',                   code: '141', slug: 'gec-nawada',                 district: 'Nawada',         year: 2019 },
  { name: 'Government Engineering College, Samastipur',               code: '159', slug: 'gec-samastipur',             district: 'Samastipur',     year: 2019 },
  { name: 'Shri Phanishwar Nath Renu Engineering College',            code: '165', slug: 'spfnec-araria',              district: 'Araria',         year: 2019 },
];

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log(`\n🏫  Seeding ${COLLEGES.length} colleges into Supabase...\n`);

  let created = 0;
  let skipped = 0;
  let failed  = 0;

  for (const col of COLLEGES) {
    // 1. Check if slug or code already exists
    const { data: existingSlug } = await supabase
      .from('colleges')
      .select('id, name')
      .eq('slug', col.slug)
      .maybeSingle();

    if (existingSlug) {
      console.log(`⏭️  SKIP  "${col.name}" — slug /${col.slug} already exists (${existingSlug.name})`);
      skipped++;
      continue;
    }

    const { data: existingCode } = await supabase
      .from('colleges')
      .select('id, name')
      .ilike('code', col.code)
      .maybeSingle();

    if (existingCode) {
      console.log(`⏭️  SKIP  "${col.name}" — code ${col.code} already exists (${existingCode.name})`);
      skipped++;
      continue;
    }

    // 2. Insert into public.colleges
    const { data: newCollege, error: insertErr } = await supabase
      .from('colleges')
      .insert({
        name:                  col.name,
        code:                  col.code,
        slug:                  col.slug,
        address:               col.district,
        established_year:      col.year,
        is_active:             true,
        show_feedbacks:        true,
        show_events:           true,
        logo_url:              null,
        contact_email:         null,
        contact_phone:         null,
        website_url:           null,
        tagline:               null,
        affiliated_university: null,
      })
      .select('id, name, code, slug')
      .single();

    if (insertErr || !newCollege) {
      console.error(`❌  FAIL  "${col.name}" — ${insertErr?.message || 'unknown error'}`);
      failed++;
      continue;
    }

    // 3. Create FREE billing account
    const { error: billingErr } = await supabase
      .from('college_billing_accounts')
      .insert({
        college_id:          newCollege.id,
        plan_type:           'FREE',
        access_status:       'UNLOCKED',
        subscription_status: 'ACTIVE',
        started_at:          new Date().toISOString(),
      });

    if (billingErr) {
      console.warn(`   ⚠️  Billing account creation failed for ${col.code}: ${billingErr.message}`);
    }

    console.log(`✅  OK    [${col.code}] ${newCollege.name}  →  /${newCollege.slug}`);
    created++;
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📊  Done!  Created: ${created}  |  Skipped: ${skipped}  |  Failed: ${failed}`);
  console.log(`${'─'.repeat(60)}\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
