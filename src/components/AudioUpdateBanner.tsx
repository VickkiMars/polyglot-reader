"use client";

import React, { useState, useEffect } from "react";
import { Headphones, Sparkles, ArrowRight, X, RotateCcw } from "lucide-react";
import { offlineDownloadManager, PackStatus } from "@/lib/offlineDownloadManager";

interface AudioUpdateBannerProps {
  currentLanguage: "mandarin" | "japanese";
  onOpenUpdateModal: (lang: "mandarin" | "japanese") => void;
}

export default function AudioUpdateBanner({
  currentLanguage,
  onOpenUpdateModal,
}: AudioUpdateBannerProps) {
  const [jaStatus, setJaStatus] = useState<PackStatus | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session
    try {
      if (sessionStorage.getItem("polyglot_audio_update_dismissed_japanese") === "true") {
        setIsDismissed(true);
      }
    } catch (e) {}

    let mounted = true;
    const inspect = () => {
      offlineDownloadManager
        .checkStatus("japanese")
        .then((status) => {
          if (mounted) setJaStatus(status);
        })
        .catch(() => {});
    };

    inspect();

    const unsubscribe = offlineDownloadManager.subscribe((p) => {
      if (p.stage === "completed" || p.stage === "error") {
        inspect();
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Show if Japanese audio has an update available and hasn't been dismissed in this session
  const showBanner = Boolean(jaStatus?.hasAudioUpdate && !isDismissed);

  if (!showBanner) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("polyglot_audio_update_dismissed_japanese", "true");
    } catch (e) {}
  };

  const handleUpdateClick = () => {
    onOpenUpdateModal("japanese");
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="w-full bg-gradient-to-r from-[var(--md-sys-color-secondary-container)]/60 via-[var(--md-sys-color-surface-container-high)] to-[var(--md-sys-color-secondary-container)]/60 border-b border-[var(--md-sys-color-secondary)]/30 text-[var(--md-sys-color-on-surface)] transition-all duration-300 animate-in slide-in-from-top-2"
    >
      <div className="max-w-[1280px] mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Icon & Description */}
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-secondary)] border border-[var(--md-sys-color-secondary)]/30 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
            <Headphones className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--md-sys-color-secondary)]" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[var(--md-sys-color-secondary)] flex items-center justify-center">
              <Sparkles className="w-2 h-2 text-[var(--md-sys-color-on-secondary)]" />
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-montserrat font-bold text-xs sm:text-sm text-[var(--md-sys-color-on-surface)] tracking-tight">
                New Japanese Neural Audio Available
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] border border-[var(--md-sys-color-secondary)]/30">
                <RotateCcw className="w-2.5 h-2.5" />
                Action Required
              </span>
            </div>
            <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] leading-snug mt-0.5">
              You have the older Japanese audio pack installed offline. We&apos;ve upgraded all 206 stories to crystal-clear native neural audio (Nanami). Update to delete the old audio and download the new pack (69.8 MB).
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={handleUpdateClick}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--md-sys-color-primary)] hover:opacity-90 text-[var(--md-sys-color-on-primary)] shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <span>Update Audio Pack</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Dismiss audio update alert"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
