"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Download, Check } from "lucide-react";
import InstallOfflineModal from "./InstallOfflineModal";
import { offlineDownloadManager, DownloadProgress, PackStatus } from "@/lib/offlineDownloadManager";

interface HeaderProps {
  currentLanguage: "mandarin" | "japanese";
  onLanguageChange: (lang: "mandarin" | "japanese") => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function Header({ currentLanguage, onLanguageChange }: HeaderProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [packStatus, setPackStatus] = useState<PackStatus | null>(null);
  const [activeProgress, setActiveProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    // Register service worker for offline support & installability
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.debug("Service worker registration:", err));
    }

    // Check if already in standalone display mode
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      if (isStandalone) {
        setIsInstalled(true);
      }
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Check language pack status on mount and when language changes
  useEffect(() => {
    let mounted = true;
    offlineDownloadManager
      .checkStatus(currentLanguage)
      .then((status) => {
        if (mounted) setPackStatus(status);
      })
      .catch(() => {});

    const unsubscribe = offlineDownloadManager.subscribe((p) => {
      if (mounted) {
        setActiveProgress(p);
        if (p.stage === "completed" || p.stage === "error") {
          offlineDownloadManager.checkStatus(currentLanguage).then(setPackStatus).catch(() => {});
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [currentLanguage]);

  const handleInstallClick = () => {
    setShowInstallModal(true);
  };

  const isDownloading = activeProgress && activeProgress.stage === "downloading";
  const isOfflineReady = packStatus?.isTextComplete && packStatus?.isAudioComplete;

  return (
    <>
      <header className="sticky top-0 z-40 bg-[var(--md-sys-color-surface-container-lowest)] border-b border-[var(--md-sys-color-outline-variant)]/60 transition-colors duration-200">
        <div className="max-w-[1280px] mx-auto px-2.5 sm:px-6 h-14 sm:h-[72px] flex items-center justify-between gap-1 sm:gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-1.5 sm:gap-2.5 group min-w-0">
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center font-cjk font-bold text-xs sm:text-base shadow-xs group-hover:opacity-95 transition-opacity shrink-0">
                語
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-montserrat font-bold text-xs sm:text-lg text-[var(--md-sys-color-on-surface)] tracking-tight leading-none truncate">
                  Polyglot<span className="text-[var(--md-sys-color-primary)]">Reader</span>
                </span>
                <span className="text-[10px] font-medium text-[var(--md-sys-color-on-surface-variant)] leading-tight hidden md:inline">
                  Graded East Asian Stories
                </span>
              </div>
            </Link>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {/* MD3 Language Segmented Switcher */}
            <div className="flex items-center bg-[var(--md-sys-color-surface-container-high)] p-0.5 sm:p-1 rounded-full border border-[var(--md-sys-color-outline-variant)]/40 shadow-xs">
              <button
                onClick={() => onLanguageChange("mandarin")}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer min-h-[32px] sm:min-h-[36px] ${
                  currentLanguage === "mandarin"
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
                aria-pressed={currentLanguage === "mandarin"}
              >
                <span>🇨🇳</span>
                <span className="hidden sm:inline">Mandarin (HSK)</span>
                <span className="hidden min-[360px]:inline sm:hidden text-[11px]">HSK</span>
              </button>
              <button
                onClick={() => onLanguageChange("japanese")}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer min-h-[32px] sm:min-h-[36px] ${
                  currentLanguage === "japanese"
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
                aria-pressed={currentLanguage === "japanese"}
              >
                <span>🇯🇵</span>
                <span className="hidden sm:inline">Japanese (JLPT)</span>
                <span className="hidden min-[360px]:inline sm:hidden text-[11px]">JLPT</span>
              </button>
            </div>

            {/* Install & Offline Pack Button */}
            <button
              type="button"
              onClick={handleInstallClick}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-200 cursor-pointer min-h-[32px] sm:min-h-[36px] shadow-xs active:scale-95 border ${
                isDownloading
                  ? "bg-[var(--md-sys-color-primary-container)] border-[var(--md-sys-color-primary)]/40 text-[var(--md-sys-color-on-primary-container)]"
                  : isOfflineReady
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                  : isInstalled
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                  : "bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-surface)] hover:text-[var(--md-sys-color-on-primary-container)] border-[var(--md-sys-color-outline-variant)]/60"
              }`}
              aria-label="Install App and Offline Audio"
              title="Install App & Download Offline Audio"
            >
              {isDownloading ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--md-sys-color-primary)] animate-ping shrink-0" />
                  <span className="hidden min-[360px]:inline text-[11px]">
                    {activeProgress ? `${activeProgress.percentage.toFixed(0)}%` : "Downloading"}
                  </span>
                </>
              ) : isOfflineReady ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="hidden sm:inline font-medium">Offline Ready</span>
                  <span className="hidden min-[360px]:inline sm:hidden text-[11px]">Ready</span>
                </>
              ) : isInstalled ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="hidden sm:inline font-medium">Installed</span>
                  <span className="hidden min-[360px]:inline sm:hidden text-[11px]">App</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-[var(--md-sys-color-primary)] shrink-0" />
                  <span className="hidden sm:inline">Install App</span>
                  <span className="hidden min-[360px]:inline sm:hidden text-[11px]">Install</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Comprehensive Install & Offline Audio Management Modal */}
      <InstallOfflineModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        currentLanguage={currentLanguage}
        onLanguageChange={onLanguageChange}
        deferredPrompt={deferredPrompt}
        isAppInstalled={isInstalled}
        onAppInstalled={() => setIsInstalled(true)}
      />
    </>
  );
}
