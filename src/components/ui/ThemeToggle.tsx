'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDark =
      document.documentElement.classList.contains('dark') ||
      localStorage.getItem('campusflow_theme') === 'dark' ||
      (!localStorage.getItem('campusflow_theme') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);

    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('campusflow_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('campusflow_theme', 'light');
    }
  };

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle day/night theme"
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-[3px] flex items-center justify-center text-slate-400 bg-slate-800/80 border border-slate-700 transition-colors ${className}`}
      >
        <Moon className="w-4 h-4 opacity-50" />
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Day mode' : 'Switch to Night mode'}
      title={isDark ? 'Switch to Day mode' : 'Switch to Night mode'}
      className={`relative inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-[3px] transition-all duration-200 focus:outline-hidden focus:ring-1 focus:ring-amber-500/50 cursor-pointer text-xs font-semibold select-none ${
        isDark
          ? 'bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-slate-700 shadow-2xs'
          : 'bg-white/90 hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs'
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
        <Sun
          className={`w-4 h-4 text-amber-500 absolute transition-all duration-300 transform ${
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
        />
        <Moon
          className={`w-4 h-4 text-indigo-300 absolute transition-all duration-300 transform ${
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          }`}
        />
      </div>

      {showLabel && (
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {isDark ? 'Night' : 'Day'}
        </span>
      )}
    </button>
  );
}
