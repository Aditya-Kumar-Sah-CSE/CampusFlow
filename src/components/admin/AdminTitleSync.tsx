'use client';

import { useEffect } from 'react';
import type { AdminCollegeMembership } from '@/types/auth';
import { getCampusFlowBrand, getCampusFlowDescription } from '@/lib/tenant/campusflow-brand';

interface Props {
  college: AdminCollegeMembership | null;
}

export function AdminTitleSync({ college }: Props) {
  const collegeCode = college?.code;
  const collegeSlug = college?.slug;
  const brand = getCampusFlowBrand({ code: collegeCode });

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const expectedTitle = collegeCode ? `${brand.displayName} | Admin Dashboard` : brand.displayName;

    // Synchronize document.title immediately on client mount and tenant switch
    document.title = expectedTitle;

    const brandDescription = getCampusFlowDescription({ code: collegeCode });
    for (const [selector, content] of [
      ['meta[name="application-name"]', brand.displayName],
      ['meta[name="apple-mobile-web-app-title"]', brand.displayName],
      ['meta[property="og:title"]', brand.displayName],
      ['meta[name="twitter:title"]', brand.displayName],
      ['meta[name="description"]', brandDescription],
      ['meta[property="og:description"]', brandDescription],
      ['meta[name="twitter:description"]', brandDescription],
    ] as const) {
      const meta = document.querySelector(selector) as HTMLMetaElement | null;
      if (meta) meta.content = content;
    }

    // Dynamically update manifest link in <head> to match active college
    if (collegeSlug) {
      const manifestUrl = `/manifest.webmanifest?college=${collegeSlug}`;
      const manifestEl = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (manifestEl) {
        manifestEl.setAttribute('href', manifestUrl);
      } else {
        const newManifest = document.createElement('link');
        newManifest.rel = 'manifest';
        newManifest.href = manifestUrl;
        document.head.appendChild(newManifest);
      }
    } else {
      const manifestEl = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      manifestEl?.setAttribute('href', '/manifest.webmanifest');
    }
  }, [brand.displayName, collegeCode, collegeSlug]);

  return null;
}
