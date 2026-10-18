'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, AlertTriangle, X, Loader2 } from 'lucide-react';

export interface SignOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  userType?: 'admin' | 'student';
}

export function SignOutConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title = 'Sign Out Confirmation',
  description,
  confirmText = 'Sign Out',
  cancelText = 'Cancel',
  userType = 'admin',
}: SignOutConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const defaultDescription =
    userType === 'admin'
      ? 'Are you sure you want to sign out of the Admin Console? Any unsaved edits or active sessions will be closed.'
      : 'Are you sure you want to sign out of your student account? You will need to sign in again to access your registrations and forms.';

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-modal-title"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#1a1209] rounded-xl border border-slate-200 dark:border-[#4d3817] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-rose-950/90 via-slate-900 to-rose-900/80 dark:from-[#2e0e0e] dark:via-[#1c1209] dark:to-[#2e1208] text-white p-5 sm:p-6 border-b border-rose-800/40 dark:border-rose-900/60 relative">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 shadow-inner">
              <LogOut className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 mb-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>Confirm Action</span>
              </div>
              <h3 id="signout-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                {title}
              </h3>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#c4a97d] leading-relaxed">
            {description || defaultDescription}
          </p>

          <div className="p-3 rounded-lg bg-amber-50 dark:bg-[#25180c] border border-amber-200 dark:border-[#4d3817] text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>You can sign back in at any time with your credentials.</span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 dark:border-[#4d3817] text-slate-700 dark:text-[#faebd0] bg-white dark:bg-[#1f150c] hover:bg-slate-100 dark:hover:bg-[#2a1d10] text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs text-center"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer text-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Signing out...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 text-white" />
                  <span>{confirmText}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
