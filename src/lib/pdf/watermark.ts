import fs from 'fs';
import path from 'path';
import type PDFKit from 'pdfkit';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CollegeBranding } from '@/lib/tenant/branding';

/**
 * Checks whether an institution has an active, unexpired paid subscription.
 * When active, watermarking is automatically removed during the allowed paid period.
 * When on free trial, unpaid, or expired, watermarking is rendered.
 */
export async function isCollegePaidSubscriptionActive(
  collegeIdOrBranding?: string | CollegeBranding | null
): Promise<boolean> {
  if (!collegeIdOrBranding) return false;

  let collegeId: string | undefined;

  if (typeof collegeIdOrBranding === 'object') {
    if (typeof collegeIdOrBranding.isPaidActive === 'boolean') {
      return collegeIdOrBranding.isPaidActive;
    }
    collegeId = collegeIdOrBranding.id;
  } else if (typeof collegeIdOrBranding === 'string') {
    // If it's a UUID, look it up; otherwise not a college ID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collegeIdOrBranding)) {
      collegeId = collegeIdOrBranding;
    }
  }

  if (!collegeId) return false;

  try {
    const supabase = createAdminClient();
    if (!supabase) return false;

    const { data: billing, error } = await supabase
      .from('college_billing_accounts')
      .select('plan_type, access_status, expires_at')
      .eq('college_id', collegeId)
      .maybeSingle();

    if (error || !billing) return false;

    const now = new Date();
    const rawPlan = (billing.plan_type || 'FREE').toUpperCase();
    const isPaid = rawPlan !== 'FREE';
    const isUnlocked = billing.access_status === 'UNLOCKED';
    const isExpired = Boolean(
      isPaid && billing.expires_at && new Date(billing.expires_at) <= now
    );

    return Boolean(isPaid && !isExpired && isUnlocked);
  } catch (err) {
    console.error('[isCollegePaidSubscriptionActive_ERR]', err);
    return false;
  }
}

/** Cache logo buffer in memory to avoid reading disk repeatedly */
let cachedLogoBuffer: Buffer | null = null;
let logoLoadAttempted = false;

function getCampusFlowLogoBuffer(): Buffer | null {
  if (logoLoadAttempted) return cachedLogoBuffer;
  logoLoadAttempted = true;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'icon-192.png');
    if (fs.existsSync(logoPath)) {
      cachedLogoBuffer = fs.readFileSync(logoPath);
    }
  } catch {
    cachedLogoBuffer = null;
  }
  return cachedLogoBuffer;
}

/**
 * Renders multiple diagonal watermark bands across a single PDFKit page.
 * Requirements:
 * - Full page coverage ("pure pdf me")
 * - Opacity 50% - 70% (configured to 60%)
 * - CampusFlow Logo, Name ("CampusFlow"), URL ("https://campusflow.in")
 * - Text: "CampusFlow provides FREE TRIAL to [College Name]"
 */
export function renderTrialWatermarks(doc: PDFKit.PDFDocument, collegeName?: string | null) {
  const pageWidth = doc.page.width || 595.28;
  const pageHeight = doc.page.height || 841.89;

  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  const logoBuf = getCampusFlowLogoBuffer();
  const brandName = 'CampusFlow';
  const urlDisplay = '143campusflow.vercel.app';
  const fullUrl = 'https://143campusflow.vercel.app';
  const effectiveCollege = collegeName && collegeName.trim() ? collegeName.trim() : 'Institution';
  const trialText = `CampusFlow provides FREE TRIAL to ${effectiveCollege}`;

  // 4 evenly spaced diagonal bands covering the entire page from top to bottom
  const yPositions = [185, 370, 550, 725];

  for (const yCenter of yPositions) {
    doc.save();
    // Rotate diagonally at -24 degrees around the page horizontal center
    doc.rotate(-24, { origin: [pageWidth / 2, yCenter] });
    // Opacity: strictly between 50% - 70%
    doc.opacity(0.60);

    doc.font('Helvetica-Bold').fontSize(14);
    const brandW = doc.widthOfString(brandName);
    doc.font('Helvetica').fontSize(9.5);
    const dotUrlW = doc.widthOfString('   •   ' + urlDisplay);

    const iconSize = 17;
    const gap = 7;
    const hasLogo = Boolean(logoBuf);
    const headerTotalW = (hasLogo ? iconSize + gap : 0) + brandW + dotUrlW;
    const headerStartX = (pageWidth - headerTotalW) / 2;

    let curX = headerStartX;
    if (hasLogo && logoBuf) {
      try {
        doc.image(logoBuf, curX, yCenter - 12, { width: iconSize, height: iconSize });
      } catch {
        // Fallback gracefully if image render fails
      }
      curX += iconSize + gap;
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#334155')
      .text(brandName, curX, yCenter - 10, { continued: true })
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor('#2563EB')
      .text('   •   ' + urlDisplay, {
        link: fullUrl,
      });

    doc.font('Helvetica-Bold').fontSize(9);
    const trialW = doc.widthOfString(trialText);
    const trialStartX = (pageWidth - trialW) / 2;

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#64748B')
      .text(trialText, trialStartX, yCenter + 7);

    doc.restore();
  }

  doc.page.margins.bottom = originalBottomMargin;
}

/**
 * Applies trial watermarks to all buffered pages in doc if the college does not have an active paid subscription.
 * When paid subscription is active, watermark is automatically skipped / removed until expiration.
 */
export async function applyTrialWatermarksIfRequired(
  doc: PDFKit.PDFDocument,
  brandingOrCollegeName?: CollegeBranding | string | null,
  overrideIsPaid?: boolean
): Promise<boolean> {
  let isPaid = false;
  let collegeName = 'Institution';

  if (typeof overrideIsPaid === 'boolean') {
    isPaid = overrideIsPaid;
  }

  if (typeof brandingOrCollegeName === 'string') {
    collegeName = brandingOrCollegeName;
    if (typeof overrideIsPaid !== 'boolean') {
      isPaid = await isCollegePaidSubscriptionActive(brandingOrCollegeName);
    }
  } else if (brandingOrCollegeName && typeof brandingOrCollegeName === 'object') {
    collegeName = brandingOrCollegeName.name || 'Institution';
    if (typeof overrideIsPaid !== 'boolean') {
      if (typeof brandingOrCollegeName.isPaidActive === 'boolean') {
        isPaid = brandingOrCollegeName.isPaidActive;
      } else if (brandingOrCollegeName.id) {
        isPaid = await isCollegePaidSubscriptionActive(brandingOrCollegeName.id);
      }
    }
  }

  // Automatic removal during paid time
  if (isPaid) {
    return false;
  }

  // Watermark applied on all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    renderTrialWatermarks(doc, collegeName);
  }

  return true;
}
