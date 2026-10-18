"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Download, Check, X, Share2, Laptop, Smartphone } from "lucide-react";

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

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.debug("Install prompt error:", err);
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[var(--md-sys-color-surface-container-lowest)] border-b border-[var(--md-sys-color-outline-variant)]/60 transition-colors duration-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-3 sm:gap-4">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center font-cjk font-bold text-base shadow-xs group-hover:opacity-95 transition-opacity">
                語
              </div>
              <div className="flex flex-col">
                <span className="font-montserrat font-bold text-base sm:text-lg text-[var(--md-sys-color-on-surface)] tracking-tight leading-none">
                  Polyglot<span className="text-[var(--md-sys-color-primary)]">Reader</span>
                </span>
                <span className="text-[10px] font-medium text-[var(--md-sys-color-on-surface-variant)] leading-tight hidden sm:inline">
                  Graded East Asian Stories
                </span>
              </div>
            </Link>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* MD3 Language Segmented Switcher */}
            <div className="flex items-center bg-[var(--md-sys-color-surface-container-high)] p-1 rounded-full border border-[var(--md-sys-color-outline-variant)]/40 shadow-xs">
              <button
                onClick={() => onLanguageChange("mandarin")}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer min-h-[36px] ${
                  currentLanguage === "mandarin"
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
                aria-pressed={currentLanguage === "mandarin"}
              >
                <span>🇨🇳</span>
                <span className="hidden xs:inline sm:inline">Mandarin (HSK)</span>
                <span className="xs:hidden sm:hidden">HSK</span>
              </button>
              <button
                onClick={() => onLanguageChange("japanese")}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer min-h-[36px] ${
                  currentLanguage === "japanese"
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
                aria-pressed={currentLanguage === "japanese"}
              >
                <span>🇯🇵</span>
                <span className="hidden xs:inline sm:inline">Japanese (JLPT)</span>
                <span className="xs:hidden sm:hidden">JLPT</span>
              </button>
            </div>

            {/* Install Button */}
            <button
              type="button"
              onClick={handleInstallClick}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-200 cursor-pointer min-h-[36px] shadow-xs active:scale-95 border ${
                isInstalled
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
                  : "bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-surface)] hover:text-[var(--md-sys-color-on-primary-container)] border-[var(--md-sys-color-outline-variant)]/60"
              }`}
              aria-label={isInstalled ? "PolyglotReader is installed" : "Install PolyglotReader App"}
              title={isInstalled ? "App Installed" : "Install App for Offline Reading"}
            >
              {isInstalled ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="hidden xs:inline font-medium">Installed</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-[var(--md-sys-color-primary)] shrink-0" />
                  <span>Install<span className="hidden sm:inline"> App</span></span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Install Instructions Modal */}
      {showInstallModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowInstallModal(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--md-sys-color-surface-container-lowest)] rounded-3xl p-6 shadow-2xl border border-[var(--md-sys-color-outline-variant)]/60 text-[var(--md-sys-color-on-surface)] relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowInstallModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header info */}
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center font-cjk font-bold text-xl shadow-xs shrink-0">
                語
              </div>
              <div>
                <h3 className="font-montserrat font-bold text-lg text-[var(--md-sys-color-on-surface)] leading-snug">
                  Install PolyglotReader
                </h3>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  Fast, offline-ready East Asian graded reader
                </p>
              </div>
            </div>

            {/* Instructions list */}
            <div className="space-y-3.5 my-5 text-xs text-[var(--md-sys-color-on-surface)]">
              {deferredPrompt && (
                <div className="p-3 rounded-2xl bg-[var(--md-sys-color-primary-container)]/50 border border-[var(--md-sys-color-primary)]/20 flex items-center justify-between gap-3">
                  <span className="font-medium text-[var(--md-sys-color-on-primary-container)]">
                    Ready to install on this device
                  </span>
                  <button
                    onClick={handleInstallClick}
                    className="px-3.5 py-1.5 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-semibold text-xs cursor-pointer shadow-xs hover:opacity-95"
                  >
                    Install Now
                  </button>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]/40 flex items-start gap-3">
                <Laptop className="w-4 h-4 text-[var(--md-sys-color-primary)] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-[var(--md-sys-color-on-surface)] mb-1">
                    Chrome, Edge & Brave (Desktop)
                  </p>
                  <p className="text-[var(--md-sys-color-on-surface-variant)] leading-relaxed">
                    Click the <strong className="text-[var(--md-sys-color-on-surface)] font-medium">Install</strong> icon in the address bar (or menu ⋮ → <strong className="text-[var(--md-sys-color-on-surface)] font-medium">Install PolyglotReader</strong>).
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]/40 flex items-start gap-3">
                <Smartphone className="w-4 h-4 text-[var(--md-sys-color-tertiary)] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-[var(--md-sys-color-on-surface)] mb-1">
                    iOS Safari (iPhone / iPad)
                  </p>
                  <p className="text-[var(--md-sys-color-on-surface-variant)] leading-relaxed flex items-center flex-wrap gap-1">
                    Tap the Share icon <Share2 className="w-3.5 h-3.5 text-[var(--md-sys-color-primary)] inline mx-0.5" /> in the bottom bar, then tap <strong className="text-[var(--md-sys-color-on-surface)] font-medium">&quot;Add to Home Screen&quot;</strong>.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]/40 flex items-start gap-3">
                <Smartphone className="w-4 h-4 text-[var(--md-sys-color-primary)] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-[var(--md-sys-color-on-surface)] mb-1">
                    Android (Chrome)
                  </p>
                  <p className="text-[var(--md-sys-color-on-surface-variant)] leading-relaxed">
                    Tap the browser menu ⋮ and select <strong className="text-[var(--md-sys-color-on-surface)] font-medium">&quot;Install app&quot;</strong> or &quot;Add to Home Screen&quot;.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer action */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="px-5 py-2 rounded-full bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] font-semibold text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
