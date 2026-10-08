import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GlobalNavigationProgress } from '@/components/ui/GlobalNavigationProgress';
import { GlobalInteractionEffects } from '@/components/ui/GlobalInteractionEffects';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';
import { NetworkStatusBanner } from '@/components/pwa/NetworkStatusBanner';
import { APP_URL } from '@/lib/config/app';
export const preferredRegion = 'bom1';

export const viewport: Viewport = {
  themeColor: '#0B192C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'CampusFlow',
    template: '%s | CampusFlow',
  },
  description: 'CampusFlow — Campus Management Platform for institutional feedback, events, programs, and registrations.',
  openGraph: { title: 'CampusFlow', description: 'CampusFlow — Campus Management Platform for institutional feedback, events, programs, and registrations.' },
  twitter: { title: 'CampusFlow', description: 'CampusFlow — Campus Management Platform for institutional feedback, events, programs, and registrations.' },
  keywords: ['CampusFlow', 'Campus Management Platform', 'Institutional Feedback', 'College Events', 'Student Registration', 'Faculty Evaluation', 'Program Management'],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CampusFlow',
  },
  applicationName: 'CampusFlow',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-screen flex flex-col antialiased bg-slate-50 text-slate-900 overflow-x-hidden selection:bg-amber-400/30 selection:text-slate-900">
        <GlobalNavigationProgress />
        <GlobalInteractionEffects />
        <ServiceWorkerRegister />
        <NetworkStatusBanner />
        <PwaInstallPrompt />
        {children}
      </body>
    </html>
  );
}
