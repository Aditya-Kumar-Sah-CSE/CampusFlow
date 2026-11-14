import type PDFKit from 'pdfkit';

export const ADITYA_PORTFOLIO_URL = 'https://portfolio-two-ashen-zseywond41.vercel.app/';
export const DR_AVINAV_PORTFOLIO_URL = 'https://www.bcebhagalpur.ac.in/faculty/abhinav-kumar/';
export const DR_ABHINAV_KUMAR_PROFILE_URL = DR_AVINAV_PORTFOLIO_URL;
export const OFFICIAL_ORDER_URL = 'https://drive.google.com/file/d/1UO0h626GIZf9KES1pGr7t1S-vnCu0eSo/view';

export interface PdfAttributionOptions {
  fontSize?: number;
  textColor?: string;
  linkColor?: string;
  showDivider?: boolean;
}

/**
 * Standard PDF Attribution Text:
 * "Designed and developed by Mr. Aditya Kumar Sah • Developer Portfolio under the guidance of Dr. Abhinav Kumar (Assistant Professor; BCE, Bhagalpur) (Official Order)"
 *
 * Renders vector-sharp, clickable hyperlinks in PDFKit pointing to both portfolios and the official order.
 * Strictly avoids printing raw URLs as text ("link show nhi krna bhut footer me se line krna"),
 * keeping the text cleanly aligned on a single centered footer line.
 */
export function renderPdfAttributionFooter(
  doc: PDFKit.PDFDocument,
  y: number,
  options?: PdfAttributionOptions
) {
  let fontSize = options?.fontSize ?? 6.0;
  const textColor = options?.textColor ?? '#64748B';
  const linkColor = options?.linkColor ?? '#2563EB';

  const t1 = 'Designed and developed by ';
  const t2 = 'Mr. Aditya Kumar Sah';
  const t3 = ' \u2022 ';
  const t4 = 'Developer Portfolio';
  const t5 = ' under the guidance of ';
  const t6 = 'Dr. Abhinav Kumar';
  const t7 = ' (Assistant Professor; BCE, Bhagalpur) ';
  const t8 = '(Official Order)';

  // Measure exact widths to ensure it fits on a single line
  const measureTotal = (fs: number) => {
    doc.fontSize(fs);
    doc.font('Helvetica');
    const w1 = doc.widthOfString(t1);
    doc.font('Helvetica-Bold');
    const w2 = doc.widthOfString(t2);
    doc.font('Helvetica');
    const w3 = doc.widthOfString(t3);
    doc.font('Helvetica-Bold');
    const w4 = doc.widthOfString(t4);
    doc.font('Helvetica');
    const w5 = doc.widthOfString(t5);
    doc.font('Helvetica-Bold');
    const w6 = doc.widthOfString(t6);
    doc.font('Helvetica');
    const w7 = doc.widthOfString(t7);
    doc.font('Helvetica-Bold');
    const w8 = doc.widthOfString(t8);

    return { total: w1 + w2 + w3 + w4 + w5 + w6 + w7 + w8, w1, w2, w3, w4, w5, w6, w7, w8 };
  };

  const pageWidth = doc.page.width || 595.28;
  const maxAvailableWidth = pageWidth - 24;

  let measured = measureTotal(fontSize);
  if (measured.total > maxAvailableWidth && measured.total > 0) {
    fontSize = Math.max(4.6, (fontSize * maxAvailableWidth) / measured.total);
    measured = measureTotal(fontSize);
  }

  const startX = Math.max(10, (pageWidth - measured.total) / 2);

  // Optional subtle divider line above footer if requested
  if (options?.showDivider) {
    doc
      .save()
      .strokeColor(textColor)
      .lineWidth(0.4)
      .opacity(0.3)
      .moveTo(startX, y - 5)
      .lineTo(startX + measured.total, y - 5)
      .stroke()
      .restore();
  }

  doc
    .font('Helvetica')
    .fontSize(fontSize)
    .fillColor(textColor)
    .text(t1, startX, y, {
      link: undefined,
      underline: false,
      continued: true,
    })
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
      link: undefined,
      underline: false,
      continued: true,
    })
    .font('Helvetica-Bold')
    .fillColor(linkColor)
    .text(t4, {
      link: ADITYA_PORTFOLIO_URL,
      underline: true,
      continued: true,
    })
    .font('Helvetica')
    .fillColor(textColor)
    .text(t5, {
      link: undefined,
      underline: false,
      continued: true,
    })
    .font('Helvetica-Bold')
    .fillColor(linkColor)
    .text(t6, {
      link: DR_ABHINAV_KUMAR_PROFILE_URL,
      underline: true,
      continued: true,
    })
    .font('Helvetica')
    .fillColor(textColor)
    .text(t7, {
      link: undefined,
      underline: false,
      continued: true,
    })
    .font('Helvetica-Bold')
    .fillColor(linkColor)
    .text(t8, {
      link: OFFICIAL_ORDER_URL,
      underline: true,
      continued: false,
    });
}
