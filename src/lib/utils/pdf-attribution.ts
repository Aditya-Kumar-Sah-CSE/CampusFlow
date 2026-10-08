import type PDFKit from 'pdfkit';

export const ADITYA_PORTFOLIO_URL = 'https://portfolio-two-ashen-zseywond41.vercel.app/';
export const DR_AVINAV_PORTFOLIO_URL = 'https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/';
export const DR_ABHINAV_KUMAR_PROFILE_URL = DR_AVINAV_PORTFOLIO_URL;

export interface PdfAttributionOptions {
  fontSize?: number;
  textColor?: string;
  linkColor?: string;
}

/**
 * Standard PDF Attribution Text:
 * "Designed and developed by Mr. Aditya Kumar Sah under the guidance of Dr. Avinav (Assistant Professor)"
 * Renders vector-sharp, clickable hyperlinks in PDFKit pointing to both respective portfolios/profiles.
 */
export function renderPdfAttributionFooter(
  doc: PDFKit.PDFDocument,
  y: number,
  options?: PdfAttributionOptions
) {
  const fontSize = options?.fontSize ?? 6.8;
  const textColor = options?.textColor ?? '#64748B';
  const linkColor = options?.linkColor ?? '#2563EB';

  const t1 = 'Designed and developed by ';
  const t2 = 'Mr. Aditya Kumar Sah';
  const t3 = ' under the guidance of ';
  const t4 = 'Dr. Avinav (Assistant Professor)';

  // Measure exact widths to center precisely
  doc.font('Helvetica').fontSize(fontSize);
  const w1 = doc.widthOfString(t1);
  doc.font('Helvetica-Bold');
  const w2 = doc.widthOfString(t2);
  doc.font('Helvetica');
  const w3 = doc.widthOfString(t3);
  doc.font('Helvetica-Bold');
  const w4 = doc.widthOfString(t4);

  const totalWidth = w1 + w2 + w3 + w4;
  const startX = Math.max(10, (doc.page.width - totalWidth) / 2);

  doc
    .font('Helvetica')
    .fontSize(fontSize)
    .fillColor(textColor)
    .text(t1, startX, y, { continued: true })
    .font('Helvetica-Bold')
    .fillColor(linkColor)
    .text(t2, {
      link: ADITYA_PORTFOLIO_URL,
      underline: true,
      continued: true,
    })
    .font('Helvetica')
    .fillColor(textColor)
    .text(t3, {
      link: null as unknown as string,
      underline: false,
      continued: true,
    })
    .font('Helvetica-Bold')
    .fillColor(linkColor)
    .text(t4, {
      link: DR_AVINAV_PORTFOLIO_URL,
      underline: true,
      continued: false,
    });
}
