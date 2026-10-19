'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, X, Share, PlusSquare, School, Check, Monitor, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'fms_global_pwa_install_dismissed_at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const RESERVED_PREFIXES = [
  'admin',
  'api',
  'auth',
  'offline',
  'favicon.ico',
  'privacy-policy',
  'terms-of-service',
  'google63a0b427ff26a6fc.html',
];

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const segments = (pathname || '').split('/').filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase();
  const isTenantRoute = Boolean(firstSegment && !RESERVED_PREFIXES.includes(firstSegment));
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [isInstalledJustNow, setIsInstalledJustNow] = useState(false);

  useEffect(() => {
    // Check if already running standalone PWA or Android TWA app
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://') ||
      sessionStorage.getItem('cf_twa_session') === '1' ||
      document.cookie.includes('cf_admin_platform=ANDROID') ||
      window.location.search.includes('app_platform=android');

    if (checkStandalone) {
      setIsStandalone(true);
      return;
    }

    // Check dismissal cooldown
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const diff = Date.now() - parseInt(dismissedAt, 10);
      if (diff < DISMISS_COOLDOWN_MS) {
        return;
      }
    }

    // Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|chrome/.test(ua);

    if (isIosDevice && isSafari) {
      setIsIos(true);
      const timer = setTimeout(() => setShowPrompt(true), 3500);
      return () => clearTimeout(timer);
    }

    // Standard Android / Chrome / Edge beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleDesktopInstall = async () => {
    if (isIos) {
      setShowIosInstructions(true);
      return;
    }

    if (!deferredPrompt) {
      alert(
        'To install CampusFlow Web App on PC:\n\n' +
        '• On Chrome/Edge Desktop: Click the Install icon (⊕) in the browser address bar (top right)\n' +
        '• Keyboard shortcut: In Chrome, click ⠇ Menu → "Install CampusFlow"'
      );
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalledJustNow(true);
        setTimeout(() => setShowPrompt(false), 2000);
      }
    } catch (err) {
      console.warn('[PWA] Installation prompt error:', err);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIosInstructions(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  if (isStandalone || !showPrompt) {
    return null;
  }

  const tenantSlug = isTenantRoute ? firstSegment : null;
  const isBce = tenantSlug === 'bce-bhagalpur' || tenantSlug === 'bce-bgp';
  const isGec = tenantSlug === 'gec-gaya';

  const appDisplayName = isBce
    ? 'BCE Bhagalpur'
    : isGec
    ? 'GEC Gaya'
    : 'CampusFlow';

  const apkDownloadUrl = isBce
    ? '/downloads/CampusFlow-BCE-BGP.apk'
    : isGec
    ? '/downloads/CampusFlow-GEC-GAYA.apk'
    : '/downloads/CampusFlow.apk';

  const apkFilename = isBce
    ? 'CampusFlow-BCE-BGP.apk'
    : isGec
    ? 'CampusFlow-GEC-GAYA.apk'
    : 'CampusFlow.apk';

  return (
    <aside
      role="region"
      aria-label={`Install ${appDisplayName} notification`}
      className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 animate-fade-in"
    >
      <div className="bg-white/95 dark:bg-[#18110b]/95 backdrop-blur-md text-slate-900 dark:text-[#faebd0] p-4 rounded-2xl border border-slate-200/90 dark:border-amber-900/50 shadow-2xl shadow-black/30 dark:shadow-black/70 flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-amber-950/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 dark:bg-amber-500/30 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold shadow-xs shrink-0 border border-amber-500/30">
              <School className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#faebd0] tracking-tight truncate">
                Install {appDisplayName}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-amber-200/70">
                Choose installation method
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-amber-100 hover:bg-slate-100 dark:hover:bg-[#251a11] transition-colors shrink-0 cursor-pointer"
            aria-label="Dismiss installation banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Feedback state */}
        {isInstalledJustNow ? (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{appDisplayName} installed successfully!</span>
          </div>
        ) : showIosInstructions ? (
          /* iOS Step-by-Step Instructions Drawer */
          <div className="p-3 bg-amber-50/80 dark:bg-[#251a11] rounded-xl border border-amber-200 dark:border-amber-950/70 text-xs space-y-2 text-slate-700 dark:text-amber-100">
            <p className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 text-[11px]">
              <Share className="w-3.5 h-3.5" /> Install on Apple iPhone/iPad:
            </p>
            <ol className="list-decimal list-inside text-[11px] space-y-1.5 text-slate-600 dark:text-amber-200/80 leading-relaxed">
              <li>Tap the <strong className="text-slate-900 dark:text-white">Share</strong> button in Safari&apos;s bottom toolbar (<Share className="w-3 h-3 inline text-amber-600 dark:text-amber-400" />).</li>
              <li>Scroll down and select <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong> (<PlusSquare className="w-3 h-3 inline text-amber-600 dark:text-amber-400" />).</li>
              <li>Tap <strong className="text-slate-900 dark:text-white">Add</strong> in the top-right corner.</li>
            </ol>
            <button
              onClick={() => setShowIosInstructions(false)}
              className="w-full mt-2 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
            >
              Done / Close Instructions
            </button>
          </div>
        ) : (
          /* 2 Installation Options: Web App for Desktop OR Android App for Mobile */
          <div className="space-y-2 pt-0.5">
            {/* Option 1: Desktop Web App */}
            <button
              type="button"
              onClick={handleDesktopInstall}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 dark:bg-[#251a11] dark:hover:bg-[#342417] border border-amber-200/90 dark:border-amber-950/80 text-slate-900 dark:text-[#faebd0] transition-all group cursor-pointer text-left shadow-2xs active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-[#3a2818] flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0 group-hover:scale-105 transition-transform">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#faebd0]">
                      Install Web App
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                      Desktop
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-amber-200/60">
                    For Windows, Mac &amp; PC Browsers
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:translate-y-0.5 transition-transform shrink-0" />
            </button>

            {/* Option 2: Android Native APK App */}
            <a
              href={apkDownloadUrl}
              download={apkFilename}
              onClick={() => {
                setTimeout(() => setShowPrompt(false), 2000);
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-[#1a2c17] dark:hover:bg-[#233d20] border border-emerald-200/90 dark:border-emerald-900/60 text-slate-900 dark:text-[#faebd0] transition-all group cursor-pointer text-left shadow-2xs active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-[#274322] flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0 group-hover:scale-105 transition-transform">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#faebd0]">
                      Download Android App
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                      Mobile APK
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-emerald-200/60">
                    Official App for Android Phones
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-y-0.5 transition-transform shrink-0" />
            </a>

            {/* Subtle Not Now button */}
            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-amber-200/80 transition-colors cursor-pointer px-2 py-1"
              >
                Not now
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
