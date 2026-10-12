import fs from 'fs';
import path from 'path';
import type PDFKit from 'pdfkit';
import { BCE_BGP_LOGO_DATA_URI } from '@/lib/events/college-logos';

const logoCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cachedAppIconBuffer: Buffer | null = null;
let cachedBceLogoBuffer: Buffer | null = null;

/**
 * Checks whether an image buffer has valid JPEG or PNG magic header bytes
 * supported natively by PDFKit (PDFKit throws "Unknown image format" on GIF, SVG, WebP, etc.).
 */
export function isPdfKitCompatible(buffer?: Buffer | null): boolean {
  if (!buffer || buffer.length < 4) return false;
  // JPEG magic: FF D8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return true;
  // PNG magic: 89 50 4E 47 (\x89PNG)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  return false;
}

/**
 * Dynamically converts GIF or other non-PDFKit image formats into a PNG buffer using sharp if available.
 */
async function tryConvertToPng(buffer: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default;
    const converted = await sharp(buffer).png().toBuffer();
    if (isPdfKitCompatible(converted)) return converted;
  } catch {
    // Non-fatal if sharp is not supported in current environment
  }
  return null;
}

/**
 * Resolves the primary CampusFlow App Icon / Meta Icon buffer (icon-192.png, apple-touch-icon.png, etc.).
 */
export function getAppIconBuffer(): Buffer | null {
  if (cachedAppIconBuffer && isPdfKitCompatible(cachedAppIconBuffer)) {
    return cachedAppIconBuffer;
  }

  const candidatePaths = [
    path.join(process.cwd(), 'public', 'icon-192.png'),
    path.join(process.cwd(), 'public', 'apple-touch-icon.png'),
    path.join(process.cwd(), 'public', 'icon-512.png'),
  ];

  for (const cPath of candidatePaths) {
    if (fs.existsSync(cPath)) {
      try {
        const buf = fs.readFileSync(cPath);
        if (isPdfKitCompatible(buf)) {
          cachedAppIconBuffer = buf;
          return buf;
        }
      } catch {}
    }
  }

  // Built-in data URI fallback
  try {
    const base64 = BCE_BGP_LOGO_DATA_URI.split(',')[1];
    if (base64) {
      const buf = Buffer.from(base64, 'base64');
      if (isPdfKitCompatible(buf)) {
        cachedAppIconBuffer = buf;
        return buf;
      }
    }
  } catch {}

  return null;
}

/**
 * Resolves the official Bhagalpur College of Engineering PNG logo buffer.
 */
export function getBceLogoBuffer(): Buffer | null {
  if (cachedBceLogoBuffer && isPdfKitCompatible(cachedBceLogoBuffer)) {
    return cachedBceLogoBuffer;
  }

  const candidatePaths = [
    path.join(process.cwd(), 'public', 'images', 'colleges', 'bhce-logo.png'),
    path.join(process.cwd(), 'public', 'images', 'colleges', 'bce-bgp.png'),
    path.join(process.cwd(), 'public', 'logos', 'bhce-logo.png'),
    path.join(process.cwd(), 'public', 'logos', 'bce-bgp.png'),
  ];

  for (const cPath of candidatePaths) {
    if (fs.existsSync(cPath)) {
      try {
        const buf = fs.readFileSync(cPath);
        if (isPdfKitCompatible(buf)) {
          cachedBceLogoBuffer = buf;
          return buf;
        }
      } catch {}
    }
  }

  // Built-in BCE base64 PNG data URI
  try {
    const base64 = BCE_BGP_LOGO_DATA_URI.split(',')[1];
    if (base64) {
      const buf = Buffer.from(base64, 'base64');
      if (isPdfKitCompatible(buf)) {
        cachedBceLogoBuffer = buf;
        return buf;
      }
    }
  } catch {}

  return getAppIconBuffer();
}

export interface ResolvePdfLogoOptions {
  url?: string | null;
  slug?: string | null;
  code?: string | null;
  name?: string | null;
}

/**
 * Authoritatively resolves an image buffer guaranteed to be valid PNG/JPEG for PDFKit.
 * Automatically converts or maps .gif/.svg files (such as bhce-logo.gif) to their .png equivalents.
 * Falls back to College Logo -> App Icon / Meta Icons, NEVER returning plain text code.
 */
export async function resolvePdfLogoBuffer(
  options?: ResolvePdfLogoOptions | null
): Promise<Buffer | null> {
  const url = options?.url?.trim();
  const slug = options?.slug?.trim().toLowerCase();
  const code = options?.code?.trim().toLowerCase();
  const name = options?.name?.trim().toLowerCase();

  // 1. Direct check for BCE Bhagalpur / Code 108
  const isBce =
    code === '108' ||
    code === 'bce' ||
    slug === 'bce-bgp' ||
    slug === 'bce' ||
    (name && name.includes('bhagalpur')) ||
    (url && (url.includes('bhce') || url.includes('bce-bgp')));

  if (isBce) {
    const bceBuf = getBceLogoBuffer();
    if (bceBuf) return bceBuf;
  }

  // 2. Data URI
  if (url && url.startsWith('data:image/')) {
    try {
      const base64Data = url.split(',')[1];
      if (base64Data) {
        const buf = Buffer.from(base64Data, 'base64');
        if (isPdfKitCompatible(buf)) return buf;
        const converted = await tryConvertToPng(buf);
        if (converted) return converted;
      }
    } catch (e) {
      console.warn('[PDF-LOGO] Failed parsing data URI:', e);
    }
  }

  // 3. Local relative static file
  if (url && url.startsWith('/')) {
    const cleanPath = url.replace(/^\//, '');

    // If path points to GIF, SVG, WebP, check if PNG / JPG equivalent exists
    const pngCleanPath = cleanPath.replace(/\.(gif|svg|webp)$/i, '.png');
    const jpgCleanPath = cleanPath.replace(/\.(gif|svg|webp)$/i, '.jpg');

    const pathsToTry = [
      path.join(process.cwd(), 'public', pngCleanPath),
      path.join(process.cwd(), 'public', jpgCleanPath),
      path.join(process.cwd(), 'public', cleanPath),
    ];

    for (const testPath of pathsToTry) {
      if (fs.existsSync(testPath)) {
        try {
          const buf = fs.readFileSync(testPath);
          if (isPdfKitCompatible(buf)) return buf;
          const converted = await tryConvertToPng(buf);
          if (converted) return converted;
        } catch {}
      }
    }
  }

  // 4. Remote HTTP/S URL
  if (url && url.startsWith('http')) {
    const cached = logoCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.buffer;
    }

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const ab = await res.arrayBuffer();
        let buf: Buffer | null = Buffer.from(ab);
        if (!isPdfKitCompatible(buf)) {
          buf = await tryConvertToPng(buf);
        }
        if (buf && isPdfKitCompatible(buf)) {
          logoCache.set(url, { buffer: buf, timestamp: Date.now() });
          return buf;
        }
      }
    } catch (err) {
      console.warn('[PDF-LOGO] Failed loading logo from URL:', url, err);
    }
  }

  // 5. College slug / code resolution from public/images/colleges
  if (slug) {
    const candidatePaths = [
      path.join(process.cwd(), 'public', 'images', 'colleges', `${slug}.png`),
      path.join(process.cwd(), 'public', 'images', 'colleges', `${slug}.jpg`),
      path.join(process.cwd(), 'public', 'logos', `${slug}.png`),
      path.join(process.cwd(), 'public', 'logos', `${slug}.jpg`),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const buf = fs.readFileSync(p);
          if (isPdfKitCompatible(buf)) return buf;
        } catch {}
      }
    }
  }

  // 6. Name-based heuristics for other Bihar colleges
  if (name) {
    const collegeSlugMap: Record<string, string> = {
      bakhtiyarpur: 'bce-bakhtiyarpur',
      gaya: 'gec-gaya',
      muzaffarpur: 'mit-muzaffarpur',
      mit: 'mit-muzaffarpur',
      motihari: 'mce-motihari',
      darbhanga: 'dce-darbhanga',
      nalanda: 'nce-chandi',
      chandi: 'nce-chandi',
      banka: 'gp-banka',
      beu: 'beu-bihar',
      bihar: 'beu-bihar',
    };

    for (const [key, cSlug] of Object.entries(collegeSlugMap)) {
      if (name.includes(key)) {
        const pPng = path.join(process.cwd(), 'public', 'images', 'colleges', `${cSlug}.png`);
        const pJpg = path.join(process.cwd(), 'public', 'images', 'colleges', `${cSlug}.jpg`);
        if (fs.existsSync(pPng)) {
          try {
            const buf = fs.readFileSync(pPng);
            if (isPdfKitCompatible(buf)) return buf;
          } catch {}
        }
        if (fs.existsSync(pJpg)) {
          try {
            const buf = fs.readFileSync(pJpg);
            if (isPdfKitCompatible(buf)) return buf;
          } catch {}
        }
      }
    }
  }

  // 7. Fallback: App Icon / Meta Icons (icon-192.png, apple-touch-icon.png)
  const appIcon = getAppIconBuffer();
  if (appIcon) return appIcon;

  // 8. Final fallback: BCE built-in logo
  return getBceLogoBuffer();
}

/**
 * Draws the logo image into the PDFKit document.
 * If the primary logoBuffer fails or is unavailable, immediately falls back to
 * drawing the CampusFlow App Icon / Meta Icon.
 * Under no circumstances does this function draw the raw institution code text ("108", "COL").
 */
export function drawPdfHeaderLogo(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  size: number,
  logoBuffer?: Buffer | null
): boolean {
  // 1. Try provided logo buffer
  if (logoBuffer && isPdfKitCompatible(logoBuffer)) {
    try {
      doc.image(logoBuffer, x, y, {
        fit: [size, size],
        align: 'center',
        valign: 'center',
      });
      return true;
    } catch (e) {
      console.warn('[PDF-LOGO] doc.image() failed on primary logoBuffer:', e);
    }
  }

  // 2. Try App Icon / Meta Icon buffer
  const appIcon = getAppIconBuffer();
  if (appIcon && isPdfKitCompatible(appIcon)) {
    try {
      doc.image(appIcon, x, y, {
        fit: [size, size],
        align: 'center',
        valign: 'center',
      });
      return true;
    } catch (e) {
      console.warn('[PDF-LOGO] doc.image() failed on app icon fallback:', e);
    }
  }

  // 3. Try BCE logo buffer
  const bceBuf = getBceLogoBuffer();
  if (bceBuf && isPdfKitCompatible(bceBuf)) {
    try {
      doc.image(bceBuf, x, y, {
        fit: [size, size],
        align: 'center',
        valign: 'center',
      });
      return true;
    } catch (e) {
      console.warn('[PDF-LOGO] doc.image() failed on BCE logo fallback:', e);
    }
  }

  return false;
}
