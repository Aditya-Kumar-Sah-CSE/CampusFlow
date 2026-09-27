'use client';

import { useEffect } from 'react';
import type { AdminCollegeMembership } from '@/types/auth';

interface Props {
  college: AdminCollegeMembership | null;
}

export function AdminTitleSync({ college }: Props) {
  const collegeCode = college?.code;
  const collegeSlug = college?.slug;

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const expectedTitle = collegeCode
      ? `${collegeCode} Feedback | Admin Dashboard | Feedback Management System`
      : 'Feedback Management System';

    // Synchronize document.title immediately on client mount and tenant switch
    document.title = expectedTitle;

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

      // Synchronize meta tags for application-name and apple-mobile-web-app-title
      const appName = `${collegeCode} Feedback`;
      const appNameMeta = document.querySelector('meta[name="application-name"]') as HTMLMetaElement | null;
      if (appNameMeta) {
        appNameMeta.content = appName;
      }

      const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
      if (appleMeta) {
        appleMeta.content = appName;
      }
    }
  }, [collegeCode, collegeSlug]);

  return null;
}
