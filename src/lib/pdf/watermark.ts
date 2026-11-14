import type PDFKit from 'pdfkit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { CollegeBranding } from '@/lib/tenant/branding';
import { getAppIconBuffer, resolvePdfLogoBuffer } from './pdf-logo';
export * from './watermark-types';
import {
  type CollegeWatermarkConfig,
  DEFAULT_WATERMARK_CONFIG,
  formatWatermarkText,
} from './watermark-types';

// In-memory fast cache with 60-second TTL for watermark configs
const memoryCache = new Map<string, { config: CollegeWatermarkConfig; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000;

/**
 * Checks whether an institution has an active, unexpired paid subscription.
 * When active, watermarking is automatically removed during the allowed paid period.
 * When on free trial, unpaid, or expired, watermarking is rendered (unless waived by superadmin).
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

/**
 * Retrieves the persisted watermark configuration for an institution.
 * Merges with DEFAULT_WATERMARK_CONFIG and substitutes fallback dynamic tokens.
 */
export async function getCollegeWatermarkConfig(
  collegeId: string,
  fallbackCollegeName?: string,
  _fallbackCollegeCode?: string
): Promise<CollegeWatermarkConfig> {
  const normalizedId = collegeId || 'default';
  const now = Date.now();

  const cached = memoryCache.get(normalizedId);
  if (cached && cached.expiresAt > now) {
    return cached.config;
  }

  const baseConfig: CollegeWatermarkConfig = {
    collegeId: normalizedId,
    ...DEFAULT_WATERMARK_CONFIG,
    text: fallbackCollegeName
      ? `CampusFlow provides FREE TRIAL to ${fallbackCollegeName}`
      : DEFAULT_WATERMARK_CONFIG.text,
  };

  if (!collegeId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collegeId)) {
    return baseConfig;
  }

  try {
    const adminDb = createAdminClient() || (await createClient());
    const { data: auditRecord } = await adminDb
      .from('audit_logs')
      .select('metadata, created_at')
      .eq('college_id', collegeId)
      .eq('action', 'COLLEGE_WATERMARK_CONFIG_UPDATED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (auditRecord?.metadata) {
      const meta = auditRecord.metadata as Partial<CollegeWatermarkConfig>;
      const merged: CollegeWatermarkConfig = {
        ...baseConfig,
        ...meta,
        collegeId,
        updatedAt: auditRecord.created_at || meta.updatedAt,
      };
      memoryCache.set(normalizedId, { config: merged, expiresAt: now + CACHE_TTL_MS });
      return merged;
    }
  } catch (err) {
    console.warn(`[GET_WATERMARK_CONFIG_ERR] College ${collegeId}:`, err);
  }

  memoryCache.set(normalizedId, { config: baseConfig, expiresAt: now + CACHE_TTL_MS });
  return baseConfig;
}

/**
 * Persists watermark configuration for an institution with guaranteed audit trail.
 */
export async function saveCollegeWatermarkConfig(
  config: CollegeWatermarkConfig,
  actor?: { userId?: string; email?: string } | string
): Promise<{ success: boolean; config?: CollegeWatermarkConfig; error?: string }> {
  try {
    const adminDb = createAdminClient() || (await createClient());

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let actorUserId: string | null = null;
    let actorEmail = 'superadmin@campusflow.in';

    if (actor) {
      if (typeof actor === 'object') {
        if (actor.userId && uuidRegex.test(actor.userId)) {
          actorUserId = actor.userId;
        }
        if (actor.email) {
          actorEmail = actor.email;
        }
      } else if (typeof actor === 'string') {
        actorEmail = actor;
      }
    }

    const payload: CollegeWatermarkConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: actorEmail,
    };

    const { error: auditError } = await adminDb.from('audit_logs').insert({
      college_id: config.collegeId,
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action: 'COLLEGE_WATERMARK_CONFIG_UPDATED',
      entity_type: 'college_watermark',
      entity_id: config.collegeId,
      details: `Watermark configured: enabled=${payload.enabled}, format=${payload.format}, type=${payload.contentType}, policy=${payload.paymentPolicy}`,
      metadata: payload,
    });

    if (auditError) {
      console.error('[SAVE_WATERMARK_AUDIT_ERR]', auditError);
      return { success: false, error: auditError.message };
    }

    // Update memory cache immediately
    memoryCache.set(config.collegeId, {
      config: payload,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return { success: true, config: payload };
  } catch (err: any) {
    console.error('[SAVE_WATERMARK_CONFIG_EX]', err);
    return { success: false, error: err?.message || 'Failed to save watermark settings' };
  }
}

/**
 * Resets watermark configuration for an institution back to standard defaults.
 */
export async function resetCollegeWatermarkConfig(
  collegeId: string,
  actor?: { userId?: string; email?: string } | string,
  collegeName?: string
): Promise<{ success: boolean; config?: CollegeWatermarkConfig; error?: string }> {
  const defaultConfig: CollegeWatermarkConfig = {
    collegeId,
    ...DEFAULT_WATERMARK_CONFIG,
    text: collegeName
      ? `CampusFlow provides FREE TRIAL to ${collegeName}`
      : DEFAULT_WATERMARK_CONFIG.text,
  };

  return await saveCollegeWatermarkConfig(defaultConfig, actor);
}

function getCampusFlowLogoBuffer(): Buffer | null {
  return getAppIconBuffer();
}

/**
 * Renders watermark on a single PDFKit page according to the specified configuration.
 */
export function renderWatermark(
  doc: PDFKit.PDFDocument,
  config: CollegeWatermarkConfig,
  collegeName?: string | null,
  collegeLogoBuffer?: Buffer | null
) {
  const pageWidth = doc.page.width || 595.28;
  const pageHeight = doc.page.height || 841.89;

  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  const rawLogoBuf =
    config.logoSource === 'college' && collegeLogoBuffer
      ? collegeLogoBuffer
      : getCampusFlowLogoBuffer();

  const includeLogo = config.contentType !== 'text_only' && Boolean(rawLogoBuf);
  const includeText = config.contentType !== 'logo_only';

  const primaryText = formatWatermarkText(config.text, collegeName);
  const secondaryText = config.subText || 'CampusFlow • 143campusflow.vercel.app';
  const textColor = config.textColor || '#64748B';
  const fontFamily = config.fontFamily || 'Helvetica-Bold';
  const fontSize = config.fontSize || 13;
  const opacity = Math.min(Math.max(config.opacity ?? 0.14, 0.05), 0.95);
  const rotationAngle = typeof config.rotationAngle === 'number' ? config.rotationAngle : -24;

  // -------------------------------------------------------------
  // FORMAT 1: DIAGONAL BANDS (Multi-band diagonal coverage)
  // -------------------------------------------------------------
  if (config.format === 'diagonal_bands') {
    // 1. Center large logo (if logo is included)
    if (includeLogo && rawLogoBuf) {
      const centerLogoSize = config.logoSize || 150;
      const centerLogoX = (pageWidth - centerLogoSize) / 2;
      const centerLogoY = (pageHeight - centerLogoSize) / 2;

      doc.save();
      doc.opacity(Math.max(0.04, opacity * 0.7));
      try {
        doc.image(rawLogoBuf, centerLogoX, centerLogoY, {
          width: centerLogoSize,
          height: centerLogoSize,
        });
      } catch {}
      doc.restore();
    }

    // 2. Diagonal watermark bands
    let yPositions = [185, 370, 550, 725];
    if (config.repeatDensity === 'sparse') {
      yPositions = [260, 520];
    } else if (config.repeatDensity === 'dense') {
      yPositions = [140, 280, 420, 560, 700];
    }

    for (const yCenter of yPositions) {
      doc.save();
      doc.rotate(rotationAngle, { origin: [pageWidth / 2, yCenter] });
      doc.opacity(opacity);

      const iconSize = 18;
      const gap = 8;
      let brandW = 0;
      let dotUrlW = 0;

      if (includeText) {
        doc.font(fontFamily).fontSize(fontSize);
        brandW = doc.widthOfString(primaryText);
        doc.font('Helvetica').fontSize(Math.max(8, fontSize * 0.72));
        dotUrlW = doc.widthOfString('   \u2022   ' + secondaryText);
      }

      const hasLogoInBand = includeLogo && Boolean(rawLogoBuf);
      const totalBandW = (hasLogoInBand ? iconSize + gap : 0) + brandW + (includeText ? dotUrlW : 0);
      const startX = Math.max(10, (pageWidth - Math.max(totalBandW, 100)) / 2);

      let curX = startX;
      if (hasLogoInBand && rawLogoBuf) {
        try {
          doc.image(rawLogoBuf, curX, yCenter - 11, { width: iconSize, height: iconSize });
        } catch {}
        curX += iconSize + gap;
      }

      if (includeText) {
        doc
          .font(fontFamily)
          .fontSize(fontSize)
          .fillColor(textColor)
          .text(primaryText, curX, yCenter - 9, { continued: Boolean(secondaryText) });

        if (secondaryText) {
          doc
            .font('Helvetica')
            .fontSize(Math.max(8, fontSize * 0.72))
            .fillColor(textColor)
            .text('   \u2022   ' + secondaryText);
        }
      }

      doc.restore();
    }
  }

  // -------------------------------------------------------------
  // FORMAT 2: CENTER PROMINENT (Large Center Stamp)
  // -------------------------------------------------------------
  else if (config.format === 'center_prominent') {
    const centerY = pageHeight / 2;
    const centerX = pageWidth / 2;

    doc.save();
    doc.opacity(opacity);

    // Large center logo underneath text
    if (includeLogo && rawLogoBuf) {
      const centerLogoSize = Math.max(120, config.logoSize || 180);
      doc.save();
      doc.opacity(Math.max(0.08, opacity * 0.85));
      try {
        doc.image(rawLogoBuf, (pageWidth - centerLogoSize) / 2, (pageHeight - centerLogoSize) / 2, {
          width: centerLogoSize,
          height: centerLogoSize,
        });
      } catch {}
      doc.restore();
    }

    if (includeText) {
      doc.rotate(rotationAngle, { origin: [centerX, centerY] });

      const stampFontSize = Math.max(16, fontSize * 1.3);
      doc.font(fontFamily).fontSize(stampFontSize);
      const mainW = doc.widthOfString(primaryText);

      doc.font('Helvetica-Bold').fontSize(Math.max(9, fontSize * 0.7));
      const subW = doc.widthOfString(secondaryText);

      const stampWidth = Math.min(pageWidth - 60, Math.max(mainW, subW) + 40);
      const stampHeight = 68;
      const boxX = (pageWidth - stampWidth) / 2;
      const boxY = centerY - stampHeight / 2;

      // Draw subtle stamp outline box
      doc
        .strokeColor(textColor)
        .lineWidth(1.8)
        .rect(boxX, boxY, stampWidth, stampHeight)
        .stroke();

      doc
        .strokeColor(textColor)
        .lineWidth(0.8)
        .rect(boxX + 3, boxY + 3, stampWidth - 6, stampHeight - 6)
        .stroke();

      doc
        .font(fontFamily)
        .fontSize(stampFontSize)
        .fillColor(textColor)
        .text(primaryText, boxX, boxY + 12, {
          width: stampWidth,
          align: 'center',
        });

      if (secondaryText) {
        doc
          .font('Helvetica-Bold')
          .fontSize(Math.max(9, fontSize * 0.7))
          .fillColor(textColor)
          .text(secondaryText.toUpperCase(), boxX, boxY + 14 + stampFontSize, {
            width: stampWidth,
            align: 'center',
          });
      }
    }

    doc.restore();
  }

  // -------------------------------------------------------------
  // FORMAT 3: FULL GRID (Matrix of Watermarks across the Page)
  // -------------------------------------------------------------
  else if (config.format === 'full_grid') {
    const rows = config.repeatDensity === 'sparse' ? 3 : config.repeatDensity === 'dense' ? 5 : 4;
    const cols = config.repeatDensity === 'sparse' ? 2 : 3;

    const rowSpacing = pageHeight / (rows + 1);
    const colSpacing = pageWidth / (cols + 1);

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        const xPos = c * colSpacing;
        const yPos = r * rowSpacing;

        doc.save();
        doc.opacity(Math.max(0.08, opacity * 0.75));
        doc.rotate(rotationAngle, { origin: [xPos, yPos] });

        if (includeLogo && rawLogoBuf) {
          const miniSize = 22;
          try {
            doc.image(rawLogoBuf, xPos - miniSize / 2, yPos - 22, {
              width: miniSize,
              height: miniSize,
            });
          } catch {}
        }

        if (includeText) {
          const gridFontSize = Math.max(9, fontSize * 0.75);
          doc.font(fontFamily).fontSize(gridFontSize).fillColor(textColor);
          const w = doc.widthOfString(primaryText);
          doc.text(primaryText, xPos - w / 2, yPos + 3);

          if (secondaryText) {
            doc.font('Helvetica').fontSize(Math.max(7, gridFontSize * 0.75));
            const subW = doc.widthOfString(secondaryText);
            doc.text(secondaryText, xPos - subW / 2, yPos + 4 + gridFontSize);
          }
        }

        doc.restore();
      }
    }
  }

  // -------------------------------------------------------------
  // FORMAT 4: TOP & BOTTOM BANNER (Header & Footer Security Bands)
  // -------------------------------------------------------------
  else if (config.format === 'top_bottom_banner') {
    doc.save();
    doc.opacity(opacity);

    // Subtle center faint watermark
    if (includeLogo && rawLogoBuf) {
      const centerSize = 120;
      doc.save();
      doc.opacity(Math.max(0.05, opacity * 0.45));
      try {
        doc.image(rawLogoBuf, (pageWidth - centerSize) / 2, (pageHeight - centerSize) / 2, {
          width: centerSize,
          height: centerSize,
        });
      } catch {}
      doc.restore();
    }

    const bannerH = 26;
    const bannerMargin = 16;
    const bannerW = pageWidth - bannerMargin * 2;

    const renderBanner = (y: number, label: string) => {
      doc
        .save()
        .strokeColor(textColor)
        .lineWidth(0.8)
        .rect(bannerMargin, y, bannerW, bannerH)
        .stroke()
        .restore();

      const bannerFontSize = Math.max(8.5, fontSize * 0.75);
      doc
        .font(fontFamily)
        .fontSize(bannerFontSize)
        .fillColor(textColor)
        .text(label, bannerMargin, y + 8, {
          width: bannerW,
          align: 'center',
        });
    };

    const bannerText = `${primaryText}   \u2022   ${secondaryText}`;
    renderBanner(16, bannerText);
    renderBanner(pageHeight - 42, bannerText);

    doc.restore();
  }

  doc.page.margins.bottom = originalBottomMargin;
}

/**
 * Backwards-compatible legacy function.
 */
export function renderTrialWatermarks(doc: PDFKit.PDFDocument, collegeName?: string | null) {
  renderWatermark(
    doc,
    {
      collegeId: 'legacy',
      ...DEFAULT_WATERMARK_CONFIG,
      text: collegeName ? `CampusFlow provides FREE TRIAL to ${collegeName}` : DEFAULT_WATERMARK_CONFIG.text,
    },
    collegeName
  );
}

/**
 * Applies watermarks across all buffered pages in a PDFKit document based on:
 * 1. College billing / payment status (Paid accounts have watermark removed by default)
 * 2. Superadmin configuration for the college (enabled toggle, format, custom text & logo)
 * 3. Superadmin override policy (auto / always_show / always_hide)
 */
export async function applyTrialWatermarksIfRequired(
  doc: PDFKit.PDFDocument,
  brandingOrCollegeName?: CollegeBranding | string | null,
  overrideIsPaid?: boolean,
  forcedConfig?: CollegeWatermarkConfig | null
): Promise<boolean> {
  let isPaid = false;
  let collegeName = 'Institution';
  let collegeId: string | undefined;
  let collegeLogoUrl: string | undefined;

  if (typeof overrideIsPaid === 'boolean') {
    isPaid = overrideIsPaid;
  }

  if (typeof brandingOrCollegeName === 'string') {
    collegeName = brandingOrCollegeName;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brandingOrCollegeName)) {
      collegeId = brandingOrCollegeName;
    } else {
      // Look up college by name, code, or slug to resolve ID and logo
      try {
        const supabase = createAdminClient();
        if (supabase) {
          const { data: matched } = await supabase
            .from('colleges')
            .select('id, name, logo_url')
            .or(`name.ilike.%${brandingOrCollegeName}%,code.eq.${brandingOrCollegeName},slug.eq.${brandingOrCollegeName}`)
            .limit(1)
            .maybeSingle();

          if (matched) {
            collegeId = matched.id;
            collegeName = matched.name;
            collegeLogoUrl = matched.logo_url || undefined;
          }
        }
      } catch {}
    }

    if (typeof overrideIsPaid !== 'boolean') {
      isPaid = await isCollegePaidSubscriptionActive(collegeId || brandingOrCollegeName);
    }
  } else if (brandingOrCollegeName && typeof brandingOrCollegeName === 'object') {
    collegeId = brandingOrCollegeName.id;
    collegeName = brandingOrCollegeName.name || 'Institution';
    collegeLogoUrl = brandingOrCollegeName.logoUrl;
    if (typeof overrideIsPaid !== 'boolean') {
      if (typeof brandingOrCollegeName.isPaidActive === 'boolean') {
        isPaid = brandingOrCollegeName.isPaidActive;
      } else if (brandingOrCollegeName.id) {
        isPaid = await isCollegePaidSubscriptionActive(brandingOrCollegeName.id);
      }
    }
  }

  // Load watermark configuration
  let config: CollegeWatermarkConfig;
  if (forcedConfig) {
    config = forcedConfig;
  } else if (collegeId) {
    config = await getCollegeWatermarkConfig(collegeId, collegeName);
  } else {
    config = {
      collegeId: 'default',
      ...DEFAULT_WATERMARK_CONFIG,
      text: formatWatermarkText(DEFAULT_WATERMARK_CONFIG.text, collegeName),
    };
  }

  // Evaluate Superadmin Payment & Watermark Logic
  // 1. If policy is always_hide: Never watermark (waived by superadmin)
  if (config.paymentPolicy === 'always_hide') {
    return false;
  }

  // 2. If policy is auto:
  //    - If paid active -> NO watermark (paid subscription removes watermark)
  //    - If unpaid/trial -> Superadmin controls via config.enabled
  if (config.paymentPolicy === 'auto') {
    if (isPaid) {
      return false; // Paid subscription active -> no watermark
    }
    if (!config.enabled) {
      return false; // Superadmin turned off watermark for this unpaid college
    }
  }

  // 3. If policy is always_show:
  //    - Superadmin force: watermarks will be applied regardless of payment status
  if (config.paymentPolicy === 'always_show' && !config.enabled) {
    return false;
  }

  // Resolve logo buffer if needed
  let logoBuffer: Buffer | null = null;
  if (config.logoSource === 'college' && collegeLogoUrl) {
    try {
      logoBuffer = await resolvePdfLogoBuffer({ url: collegeLogoUrl, name: collegeName });
    } catch {}
  } else if (config.logoSource === 'custom' && config.customLogoUrl) {
    try {
      logoBuffer = await resolvePdfLogoBuffer({ url: config.customLogoUrl });
    } catch {}
  }

  // Apply watermark to all buffered pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    renderWatermark(doc, config, collegeName, logoBuffer);
  }

  return true;
}
