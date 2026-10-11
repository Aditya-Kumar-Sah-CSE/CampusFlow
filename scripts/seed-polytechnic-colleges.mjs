/**
 * seed-polytechnic-colleges.mjs
 * ─────────────────────────────────────────────────────────────
 * Bulk-create Bihar Government Polytechnic Colleges via Supabase Admin API.
 * Affiliation: State Board of Technical Education (SBTE), Bihar
 * Department: Dept. of Science, Technology & Technical Education, Govt. of Bihar
 *
 * For each institution:
 *   1. Insert into public.colleges
 *   2. Create a FREE billing account in college_billing_accounts
 *   3. Set show_feedbacks=true, show_events=true, is_active=true
 *
 * Usage:  node scripts/seed-polytechnic-colleges.mjs
 * ─────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';

// ── Supabase connection (service role = full admin) ──────────
const SUPABASE_URL  = 'https://txerarcajxjzxifanzxw.supabase.co';
const SERVICE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4ZXJhcmNhanhqenhpZmFuenh3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDAzNzg2MSwiZXhwIjoyMTA1NjEzODYxfQ.VzD6hoNi3Tm-ZOoo2nUzMB1eirQ8HMf45UmPP8F_FX8';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── All 46 Government Polytechnic Colleges in Bihar ──────────
const POLYTECHNIC_COLLEGES = [
  { name: 'Government Polytechnic, Barauni',                      code: 'GP-111',  slug: 'gp-barauni',         district: 'Begusarai',      year: 1982, website_url: 'https://gpbarauni.ac.in' },
  { name: 'Government Polytechnic, Bhagalpur',                    code: 'GP-112',  slug: 'gp-bhagalpur',       district: 'Bhagalpur',      year: 1955, website_url: 'https://gpbhagalpur.org' },
  { name: 'Government Polytechnic, Chapra',                       code: 'GP-113',  slug: 'gp-chapra',          district: 'Saran',          year: 1994, website_url: 'https://gpchapra.org.in' },
  { name: 'Government Polytechnic, Darbhanga',                    code: 'GP-114',  slug: 'gp-darbhanga',       district: 'Darbhanga',      year: 1959, website_url: 'https://gpdarbhanga.org.in' },
  { name: 'Government Polytechnic, Gaya',                         code: 'GP-115',  slug: 'gp-gaya',            district: 'Gaya',           year: 1960, website_url: 'https://gpgaya.ac.in' },
  { name: 'Government Polytechnic, Gopalganj',                    code: 'GP-116',  slug: 'gp-gopalganj',       district: 'Gopalganj',      year: 1994, website_url: 'https://gpgopalganj.ac.in' },
  { name: 'Government Polytechnic, Muzaffarpur',                  code: 'GP-117',  slug: 'gp-muzaffarpur',     district: 'Muzaffarpur',    year: 1960, website_url: 'https://gpmuzaffarpur.org' },
  { name: 'Government Polytechnic, Patna-7',                      code: 'GP-118',  slug: 'gp-patna-7',         district: 'Patna',          year: 1954, website_url: 'https://gpp7.org.in' },
  { name: 'Government Polytechnic, Purnea',                       code: 'GP-119',  slug: 'gp-purnea',          district: 'Purnia',         year: 1962, website_url: 'https://gppurnea.ac.in' },
  { name: 'Government Polytechnic, Saharsa',                      code: 'GP-120',  slug: 'gp-saharsa',         district: 'Saharsa',        year: 1962, website_url: 'https://gpsaharsa.ac.in' },
  { name: 'New Government Polytechnic, Patna-13',                 code: 'GP-121',  slug: 'ngp-patna-13',       district: 'Patna',          year: 1955, website_url: 'https://ngppatna13.org.in' },
  { name: "Government Women's Polytechnic, Muzaffarpur",          code: 'GWP-122', slug: 'gwp-muzaffarpur',    district: 'Muzaffarpur',    year: 1988, website_url: 'https://gwpmuz.ac.in' },
  { name: "Government Women's Polytechnic, Patna",                code: 'GWP-123', slug: 'gwp-patna',          district: 'Patna',          year: 1987, website_url: 'https://gwppatna.org.in' },
  { name: 'Government Polytechnic, Katihar',                      code: 'GP-124',  slug: 'gp-katihar',         district: 'Katihar',        year: 2016, website_url: 'https://gpkatihar.org.in' },
  { name: 'Government Polytechnic, Vaishali',                     code: 'GP-125',  slug: 'gp-vaishali',        district: 'Vaishali',       year: 2016, website_url: 'https://gpvaishali.ac.in' },
  { name: 'Government Polytechnic, Lakhisarai',                   code: 'GP-126',  slug: 'gp-lakhisarai',      district: 'Lakhisarai',     year: 2016, website_url: 'https://gplakhisarai.org.in' },
  { name: 'Government Polytechnic, Dehri-on-Sone',                code: 'GP-127',  slug: 'gp-dehri-on-sone',   district: 'Rohtas',         year: 2016, website_url: 'https://gpdehri.ac.in' },
  { name: 'Government Polytechnic, Asthawan',                     code: 'GP-128',  slug: 'gp-asthawan',        district: 'Nalanda',        year: 2016, website_url: 'https://gpasthawannalanda.org.in' },
  { name: 'Government Polytechnic, Sheohar',                      code: 'GP-129',  slug: 'gp-sheohar',         district: 'Sheohar',        year: 2016, website_url: 'https://gpsheohar.org.in' },
  { name: 'Government Polytechnic, Motihari',                     code: 'GP-130',  slug: 'gp-motihari',        district: 'East Champaran', year: 2016, website_url: 'https://gpmotihari.ac.in' },
  { name: 'Government Polytechnic, Madhubani',                    code: 'GP-131',  slug: 'gp-madhubani',       district: 'Madhubani',      year: 2016, website_url: 'https://gpmadhubani.org.in' },
  { name: 'B.K.P.I. (Ambedkar Polytechnic), Sitamarhi',           code: 'GP-132',  slug: 'bkpi-sitamarhi',     district: 'Sitamarhi',      year: 2016, website_url: 'https://bkpisitamarhi.org' },
  { name: 'Government Polytechnic, Raghopur',                     code: 'GP-134',  slug: 'gp-raghopur',        district: 'Supaul',         year: 2018, website_url: 'https://gpraghopur.org.in' },
  { name: 'K. N. S. Government Polytechnic, Samastipur',          code: 'GP-135',  slug: 'knsgp-samastipur',   district: 'Samastipur',     year: 2018, website_url: 'https://knsgpsamastipur.org.in' },
  { name: 'B. K. N. S. Government Polytechnic, Gopalganj',        code: 'GP-136',  slug: 'bknsgp-gopalganj',   district: 'Gopalganj',      year: 2018, website_url: 'https://bknsgpgopalganj.org' },
  { name: 'Government Polytechnic, Munger',                       code: 'GP-137',  slug: 'gp-munger',          district: 'Munger',         year: 2019, website_url: 'https://gpmunger.org.in' },
  { name: 'Government Polytechnic, Sheikhpura',                   code: 'GP-138',  slug: 'gp-sheikhpura',      district: 'Sheikhpura',     year: 2019, website_url: 'https://gpsheikhpura.org.in' },
  { name: 'Government Polytechnic, Jamui',                        code: 'GP-139',  slug: 'gp-jamui',           district: 'Jamui',          year: 2019, website_url: 'https://gpjamui.org.in' },
  { name: 'Government Polytechnic, Banka',                        code: 'GP-140',  slug: 'gp-banka',           district: 'Banka',          year: 2019, website_url: 'https://www.gpbanka.ac.in', logo_url: '/images/colleges/gp-banka.png' },
  { name: 'Government Polytechnic, Tekari',                       code: 'GP-141',  slug: 'gp-tekari',          district: 'Gaya',           year: 2019, website_url: 'https://gptekari.org.in' },
  { name: 'Government Polytechnic, Kaimur',                       code: 'GP-142',  slug: 'gp-kaimur',          district: 'Kaimur',         year: 2019, website_url: 'https://gpkaimur.org.in' },
  { name: 'Government Polytechnic, Buxar',                        code: 'GP-143',  slug: 'gp-buxar',           district: 'Buxar',          year: 2019, website_url: 'https://gpbuxar.ac.in' },
  { name: 'Government Polytechnic, Sitamarhi',                    code: 'GP-144',  slug: 'gp-sitamarhi',       district: 'Sitamarhi',      year: 2019, website_url: 'https://gpsitamarhi.org.in' },
  { name: 'Government Polytechnic, West Champaran',               code: 'GP-145',  slug: 'gp-west-champaran',  district: 'West Champaran', year: 2019, website_url: 'https://gpwestchamparan.org.in' },
  { name: 'Government Polytechnic, Kishanganj',                   code: 'GP-146',  slug: 'gp-kishanganj',      district: 'Kishanganj',     year: 2019, website_url: 'https://gpkishanganj.ac.in' },
  { name: 'Government Polytechnic, Araria',                       code: 'GP-147',  slug: 'gp-araria',          district: 'Araria',         year: 2019, website_url: 'https://gpararia.org.in' },
  { name: 'Government Polytechnic, Nawada',                       code: 'GP-148',  slug: 'gp-nawada',          district: 'Nawada',         year: 2019, website_url: 'https://gpnawada.ac.in' },
  { name: 'Government Polytechnic, Siwan',                        code: 'GP-149',  slug: 'gp-siwan',           district: 'Siwan',          year: 2019, website_url: 'https://gpsiwan.ac.in' },
  { name: 'Government Polytechnic, Arwal',                        code: 'GP-150',  slug: 'gp-arwal',           district: 'Arwal',          year: 2019, website_url: 'https://gparwal.org.in' },
  { name: 'Government Polytechnic, Aurangabad',                   code: 'GP-151',  slug: 'gp-aurangabad',      district: 'Aurangabad',     year: 2019, website_url: 'https://gpaurangabad.org.in' },
  { name: 'Government Polytechnic, Bhojpur',                      code: 'GP-152',  slug: 'gp-bhojpur',         district: 'Bhojpur',        year: 2019, website_url: 'https://gpbhojpur.org.in' },
  { name: 'Government Polytechnic, Jehanabad',                    code: 'GP-153',  slug: 'gp-jehanabad',       district: 'Jehanabad',      year: 2019, website_url: 'https://gpjehanabad.org.in' },
  { name: 'Government Polytechnic, Khagaria',                     code: 'GP-154',  slug: 'gp-khagaria',        district: 'Khagaria',       year: 2019, website_url: 'https://gpkhagaria.org.in' },
  { name: 'Government Polytechnic, Barh',                         code: 'GP-155',  slug: 'gp-barh',            district: 'Patna',          year: 2019, website_url: 'https://gpbarh.org.in' },
  { name: 'Government Polytechnic, Madhepura',                    code: 'GP-156',  slug: 'gp-madhepura',       district: 'Madhepura',      year: 2019, website_url: 'https://gpmadhepura.ac.in' },
  { name: 'Government Polytechnic, Supaul',                       code: 'GP-157',  slug: 'gp-supaul',          district: 'Supaul',         year: 2019, website_url: 'https://gpsupaul.org.in' },
];

async function main() {
  console.log(`\n🏫  Seeding ${POLYTECHNIC_COLLEGES.length} Bihar Government Polytechnic Colleges...\n`);

  let created = 0;
  let skipped = 0;
  let failed  = 0;

  for (const col of POLYTECHNIC_COLLEGES) {
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
        address:               `${col.district}, Bihar`,
        established_year:      col.year,
        is_active:             true,
        show_feedbacks:        true,
        show_events:           true,
        logo_url:              '/images/colleges/beu-bihar.png',
        contact_email:         `contact@${col.slug}.org`,
        contact_phone:         null,
        website_url:           col.website_url,
        tagline:               'Dept. of Science, Technology & Technical Education, Govt. of Bihar',
        affiliated_university: 'State Board of Technical Education (SBTE), Bihar',
        aicte_approved:        true,
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
      console.warn(`   ⚠️  Billing account creation note for ${col.code}: ${billingErr.message}`);
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
