'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { WifiOff, Wifi, RefreshCw, School, Calendar, ArrowLeft } from 'lucide-react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : false);

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-reload when connection is restored
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsChecking(true);
    if (typeof window !== 'undefined') {
      if (navigator.onLine) {
        window.location.reload();
      } else {
        setTimeout(() => {
          setIsChecking(false);
        }, 800);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-4 selection:bg-amber-400/30">
      <div className="max-w-md w-full bg-slate-800/95 backdrop-blur-md rounded-3xl border border-slate-700/80 p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-fade-in">
        {/* Branding Crest */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-900 text-amber-400 flex items-center justify-center shadow-lg border border-amber-400/30">
            <School className="w-8 h-8" />
          </div>
        </div>

        {/* Header */}
        <div className="space-y-2">
          {isOnline ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
              <Wifi className="w-3.5 h-3.5" />
              <span>Connection Restored! Reloading...</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-semibold border border-red-500/30">
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              <span>No Internet Connection</span>
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            You&apos;re offline
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            You can still view previously loaded CampusFlow information. Registration, payments, and other live actions require an internet connection.
          </p>
        </div>

        {/* Offline Guidance Info */}
        <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-700/60 text-xs text-slate-400 text-left space-y-2">
          <p className="font-semibold text-slate-200">Offline Availability:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Previously visited public events, schedules, and program overviews remain readable.</li>
            <li>Live actions (registrations, team invitations, feedback submissions, and payments) will resume once your device reconnects.</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRetry}
            disabled={isChecking}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : 'Retry Connection'}</span>
          </button>
          <Link
            href="/events"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 active:scale-98 text-slate-200 text-xs font-bold transition-all border border-slate-600"
          >
            <Calendar className="w-4 h-4 text-blue-400" />
            <span>Cached Events</span>
          </Link>
        </div>

        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to CampusFlow Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
