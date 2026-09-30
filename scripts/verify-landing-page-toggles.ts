import fs from 'fs';
import path from 'path';

// Parse .env.local if present
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
  console.warn('Could not load .env.local directly:', e);
}

import { getCollegeLandingSettings, saveCollegeLandingSettings } from '../src/lib/tenant/landing-settings';
import { getTenantBySlug } from '../src/lib/tenant/resolver';
import { createAdminClient } from '../src/lib/supabase/admin';

async function runVerification() {
  console.log('=====================================================');
  console.log('VERIFYING PUBLIC LANDING PAGE TOGGLES (FEEDBACKS & EVENTS)');
  console.log('=====================================================\n');

  const supabase = createAdminClient();
  if (!supabase) {
    console.error('Failed to create admin client - SUPABASE_SERVICE_ROLE_KEY missing');
    process.exit(1);
  }
  const { data: colleges, error: collegesError } = await supabase
    .from('colleges')
    .select('id, name, slug')
    .limit(2);

  if (collegesError || !colleges || colleges.length === 0) {
    console.error('Failed to fetch test colleges:', collegesError);
    process.exit(1);
  }

  const primaryCollege = colleges[0];
  const secondaryCollege = colleges[1] || null;

  console.log(`Primary Test College: ${primaryCollege.name} (${primaryCollege.slug}, ID: ${primaryCollege.id})`);
  if (secondaryCollege) {
    console.log(`Secondary Test College: ${secondaryCollege.name} (${secondaryCollege.slug}, ID: ${secondaryCollege.id})`);
  }
  console.log('');

  // Save initial settings to restore later
  const initialSettings = await getCollegeLandingSettings(primaryCollege.id);
  console.log(`Initial settings for ${primaryCollege.slug}: Feedbacks=${initialSettings.showFeedbacks}, Events=${initialSettings.showEvents}\n`);

  let allPassed = true;

  const testPermutation = async (
    name: string,
    showFeedbacks: boolean,
    showEvents: boolean
  ) => {
    console.log(`--- Testing Permutation: ${name} (Feedbacks=${showFeedbacks}, Events=${showEvents}) ---`);
    
    // 1. Save settings
    const saveResult = await saveCollegeLandingSettings(
      primaryCollege.id,
      { showFeedbacks, showEvents },
      'test-verification-script',
      primaryCollege.slug
    );
    if (!saveResult.success) {
      console.error(`❌ Failed to save settings: ${saveResult.error}`);
      allPassed = false;
      return false;
    }

    // 2. Fetch via getCollegeLandingSettings
    const fetched = await getCollegeLandingSettings(primaryCollege.id);
    const fetchPassed = fetched.showFeedbacks === showFeedbacks && fetched.showEvents === showEvents;
    console.log(`  [getCollegeLandingSettings]: showFeedbacks=${fetched.showFeedbacks}, showEvents=${fetched.showEvents} -> ${fetchPassed ? '✅ PASS' : '❌ FAIL'}`);
    if (!fetchPassed) allPassed = false;

    // 3. Fetch via getTenantBySlug (which the public landing page calls server-side)
    const tenantCtx = await getTenantBySlug(primaryCollege.slug);
    const tenantPassed = tenantCtx !== null && tenantCtx.showFeedbacks === showFeedbacks && tenantCtx.showEvents === showEvents;
    console.log(`  [getTenantBySlug]: showFeedbacks=${tenantCtx?.showFeedbacks}, showEvents=${tenantCtx?.showEvents} -> ${tenantPassed ? '✅ PASS' : '❌ FAIL'}`);
    if (!tenantPassed) allPassed = false;

    // 4. Verify Server Render Semantics
    const renderFeedbackSection = tenantCtx?.showFeedbacks === true;
    const renderEventsSection = tenantCtx?.showEvents === true;
    const renderBothOffPlaceholder = !tenantCtx?.showFeedbacks && !tenantCtx?.showEvents;

    console.log(`  [Render Conditions]: FeedbackSection=${renderFeedbackSection}, EventsSection=${renderEventsSection}, BothOffPlaceholder=${renderBothOffPlaceholder}`);
    if (showFeedbacks !== renderFeedbackSection || showEvents !== renderEventsSection) {
      console.error('❌ Render condition mismatch!');
      allPassed = false;
    } else {
      console.log('  ✅ Render conditions match expected output');
    }

    console.log('');
    return fetchPassed && tenantPassed;
  };

  // Test 1: Feedback ON + Events ON
  await testPermutation('Permutation 1: Feedback ON + Events ON', true, true);

  // Test 2: Feedback ON + Events OFF
  await testPermutation('Permutation 2: Feedback ON + Events OFF', true, false);

  // Test 3: Feedback OFF + Events ON
  await testPermutation('Permutation 3: Feedback OFF + Events ON', false, true);

  // Test 4: Feedback OFF + Events OFF
  await testPermutation('Permutation 4: Feedback OFF + Events OFF', false, false);

  // Test Multi-Tenant Isolation (if secondary college exists)
  if (secondaryCollege) {
    console.log('--- Testing Multi-Tenant Isolation ---');
    // Set primary to OFF / OFF
    await saveCollegeLandingSettings(primaryCollege.id, { showFeedbacks: false, showEvents: false });
    // Set secondary to ON / ON
    await saveCollegeLandingSettings(secondaryCollege.id, { showFeedbacks: true, showEvents: true });

    const primaryCheck = await getCollegeLandingSettings(primaryCollege.id);
    const secondaryCheck = await getCollegeLandingSettings(secondaryCollege.id);

    const isolationPassed = 
      primaryCheck.showFeedbacks === false && primaryCheck.showEvents === false &&
      secondaryCheck.showFeedbacks === true && secondaryCheck.showEvents === true;

    console.log(`  Primary (${primaryCollege.slug}): Feedbacks=${primaryCheck.showFeedbacks}, Events=${primaryCheck.showEvents}`);
    console.log(`  Secondary (${secondaryCollege.slug}): Feedbacks=${secondaryCheck.showFeedbacks}, Events=${secondaryCheck.showEvents}`);
    console.log(`  Multi-Tenant Isolation Result: ${isolationPassed ? '✅ PASS' : '❌ FAIL'}\n`);
    if (!isolationPassed) allPassed = false;
  }

  // Restore initial settings
  console.log(`Restoring initial settings for ${primaryCollege.slug}...`);
  await saveCollegeLandingSettings(primaryCollege.id, initialSettings, 'test-restore', primaryCollege.slug);
  console.log('Initial settings restored.\n');

  console.log('=====================================================');
  if (allPassed) {
    console.log('🎉 ALL 4 PERMUTATIONS & TENANT ISOLATION PASSED PERFECTLY!');
  } else {
    console.error('⚠️ SOME TESTS FAILED. CHECK LOGS ABOVE.');
    process.exit(1);
  }
  console.log('=====================================================');
}

runVerification().catch(err => {
  console.error('Unhandled error during verification:', err);
  process.exit(1);
});
