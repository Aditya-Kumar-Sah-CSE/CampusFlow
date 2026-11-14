export type WatermarkFormat =
  | 'diagonal_bands'
  | 'center_prominent'
  | 'full_grid'
  | 'top_bottom_banner';

export type WatermarkContentType = 'both' | 'text_only' | 'logo_only';

export type WatermarkPaymentPolicy =
  | 'auto' // Default: Hide watermark when college has active paid plan; show when unpaid/trial
  | 'always_show' // Superadmin force: always show watermark even if paid
  | 'always_hide'; // Superadmin waiver: never show watermark even if unpaid

export type WatermarkLogoSource = 'campusflow' | 'college' | 'custom';

export interface CollegeWatermarkConfig {
  collegeId: string;
  enabled: boolean; // Master toggle for this institution
  paymentPolicy: WatermarkPaymentPolicy;
  contentType: WatermarkContentType;
  format: WatermarkFormat;

  // Text options
  text: string; // e.g. "CampusFlow provides FREE TRIAL to {college_name}"
  subText: string; // e.g. "CampusFlow • 143campusflow.vercel.app"
  fontFamily: 'Helvetica-Bold' | 'Helvetica' | 'Times-Bold' | 'Courier-Bold';
  fontSize: number; // 8 - 28 pt
  textColor: string; // Hex color code

  // Logo options
  logoSource: WatermarkLogoSource;
  customLogoUrl?: string;
  logoSize: number; // 60 - 260 pt

  // Visual layout
  opacity: number; // 0.10 - 0.90
  rotationAngle: number; // -90 to 90 degrees
  repeatDensity: 'sparse' | 'normal' | 'dense';

  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_WATERMARK_CONFIG: Omit<CollegeWatermarkConfig, 'collegeId'> = {
  enabled: true,
  paymentPolicy: 'auto',
  contentType: 'both',
  format: 'diagonal_bands',
  text: 'CampusFlow provides FREE TRIAL to {college_name}',
  subText: 'CampusFlow • 143campusflow.vercel.app',
  fontFamily: 'Helvetica-Bold',
  fontSize: 13,
  textColor: '#64748B',
  logoSource: 'campusflow',
  customLogoUrl: '',
  logoSize: 150,
  opacity: 0.55,
  rotationAngle: -24,
  repeatDensity: 'normal',
};

/**
 * Replaces dynamic placeholders in watermark text:
 * {college_name} -> real institution name
 * {college_code} -> institution code
 * {date} -> current date
 */
export function formatWatermarkText(
  template: string,
  collegeName?: string | null,
  collegeCode?: string | null
): string {
  const effectiveCollege = collegeName && collegeName.trim() ? collegeName.trim() : 'Institution';
  const effectiveCode = collegeCode && collegeCode.trim() ? collegeCode.trim() : '';

  return (template || '')
    .replace(/{college_name}/gi, effectiveCollege)
    .replace(/{institution}/gi, effectiveCollege)
    .replace(/{college_code}/gi, effectiveCode)
    .replace(/{date}/gi, new Date().toLocaleDateString('en-IN'));
}
