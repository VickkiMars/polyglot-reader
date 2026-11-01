"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Download,
  Check,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  HardDrive,
  Headphones,
  BookOpen,
  WifiOff,
  AlertCircle,
  Laptop,
  Smartphone,
  Share2,
} from "lucide-react";
import {
  offlineDownloadManager,
  DownloadProgress,
  PackStatus,
  formatBytes,
  formatSpeed,
  formatEta,
} from "@/lib/offlineDownloadManager";
import { LanguageManifest } from "@/app/api/offline-manifest/route";

interface InstallOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: "mandarin" | "japanese";
  onLanguageChange?: (lang: "mandarin" | "japanese") => void;
  deferredPrompt: any;
  isAppInstalled: boolean;
  onAppInstalled: () => void;
}

export default function InstallOfflineModal({
  isOpen,
  onClose,
  currentLanguage,
  onLanguageChange,
  deferredPrompt,
  isAppInstalled,
  onAppInstalled,
}: InstallOfflineModalProps) {
  const [selectedLang, setSelectedLang] = useState<"mandarin" | "japanese">(currentLanguage);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [manifest, setManifest] = useState<LanguageManifest | null>(null);
  const [packStatus, setPackStatus] = useState<PackStatus | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<{ quota?: string; usage?: string }>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Sync selected language when prop changes
  useEffect(() => {
    setSelectedLang(currentLanguage);
  }, [currentLanguage]);

  // Online / offline listeners
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch manifest & pack status whenever selectedLang or modal open state changes
  const refreshStatus = useCallback(async (lang: "mandarin" | "japanese") => {
    try {
      const data = await offlineDownloadManager.getManifest(lang);
      setManifest(data);
      const status = await offlineDownloadManager.checkStatus(lang, data);
      setPackStatus(status);
    } catch (err) {
      console.error("Failed to load manifest or status:", err);
    }

    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (est.quota && est.usage) {
          setStorageEstimate({
            quota: formatBytes(est.quota),
            usage: formatBytes(est.usage),
          });
        }
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshStatus(selectedLang);
    }
  }, [isOpen, selectedLang, refreshStatus]);

  // Subscribe to download manager progress events
  useEffect(() => {
    const unsubscribe = offlineDownloadManager.subscribe((p) => {
      setProgress(p);
      if (p.stage === "completed" || p.stage === "error" || p.stage === "paused") {
        refreshStatus(p.language);
      }
    });
    return unsubscribe;
  }, [refreshStatus]);

  const isCurrentLangDownloading =
    Boolean(progress && progress.language === selectedLang && progress.stage === "downloading");
  const isCurrentLangPaused =
    Boolean(progress && progress.language === selectedLang && progress.stage === "paused");
  const isCurrentLangError =
    Boolean(progress && progress.language === selectedLang && progress.stage === "error");

  const progressRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to progress when downloading starts or errors occur
  useEffect(() => {
    if (isOpen && (isCurrentLangDownloading || isCurrentLangError)) {
      progressRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isOpen, isCurrentLangDownloading, isCurrentLangError]);

  if (!isOpen) return null;

  // Calculate target bytes and formatted strings based on user audio selection
  const audioBytes = manifest?.audio.totalBytes || 0;
  const audioBytesFormatted = manifest?.audio.totalFormatted || "0 MB";
  const audioBytesExact = manifest?.audio.totalBytesExact || "0 bytes";

  const textBytes = manifest?.text.totalBytes || 0;
  const textBytesFormatted = manifest?.text.totalFormatted || "0 MB";
  const textBytesExact = manifest?.text.totalBytesExact || "0 bytes";

  const totalTargetBytes = includeAudio ? textBytes + audioBytes : textBytes;
  const totalTargetFormatted = formatBytes(totalTargetBytes);
  const totalTargetExact = `${totalTargetBytes.toLocaleString()} bytes`;

  // Start download handler
  const handleStartDownload = async () => {
    if (!manifest) return;
    try {
      await offlineDownloadManager.startDownload({
        language: selectedLang,
        includeAudio,
      });
      await refreshStatus(selectedLang);
    } catch (err) {
      console.error("Download trigger failed:", err);
    }
  };

  // Pause handler
  const handlePause = () => {
    offlineDownloadManager.pause();
  };

  // Resume handler
  const handleResume = async () => {
    await handleStartDownload();
  };

  // Delete language pack handler
  const handleDeletePack = async () => {
    const langLabel = manifest?.languageLabel || "language";
    if (!confirm(`Remove offline files for ${langLabel}? You will need an internet connection to re-download.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await offlineDownloadManager.deleteLanguagePack(selectedLang);
      await refreshStatus(selectedLang);
    } catch (e) {
      console.error("Failed to delete pack:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle native PWA install button click
  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          onAppInstalled();
        }
      } catch (err) {
        console.debug("Native install prompt error:", err);
      }
    }
  };

  const isFullyInstalled =
    Boolean(packStatus?.isTextComplete && (!includeAudio || packStatus?.isAudioComplete));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col bg-[var(--md-sys-color-surface-container-lowest)] rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-[var(--md-sys-color-outline-variant)]/60 text-[var(--md-sys-color-on-surface)] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 sm:pt-5 sm:pb-4 border-b border-[var(--md-sys-color-outline-variant)]/40 shrink-0 safe-top">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center font-cjk font-bold text-base sm:text-lg shadow-xs shrink-0">
              語
            </div>
            <div>
              <h2 className="font-montserrat font-bold text-base sm:text-lg text-[var(--md-sys-color-on-surface)] leading-tight">
                Offline Access &amp; Downloads
              </h2>
              <p className="text-[11px] sm:text-xs text-[var(--md-sys-color-on-surface-variant)]">
                Download complete story packages with studio voice narrations for offline practice
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4 sm:space-y-5 text-xs text-[var(--md-sys-color-on-surface)]">
          {/* PWA Direct Installation Card */}
          {deferredPrompt && !isAppInstalled && (
            <div className="p-3.5 rounded-2xl bg-[var(--md-sys-color-primary-container)]/60 border border-[var(--md-sys-color-primary)]/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <Laptop className="w-5 h-5 text-[var(--md-sys-color-primary)] shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-[var(--md-sys-color-on-primary-container)]">
                    Install as Standalone App
                  </div>
                  <div className="text-[11px] text-[var(--md-sys-color-on-primary-container)]/80">
                    Add PolyglotReader to your home screen or desktop for a focused reading view
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleNativeInstall}
                className="px-4 py-2 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-semibold text-xs cursor-pointer shadow-xs hover:opacity-95 shrink-0 min-h-[38px] text-center"
              >
                Install App
              </button>
            </div>
          )}

          {/* Network Status Warning if Offline */}
          {!isOnline && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-amber-800 dark:text-amber-200">
              <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>You are currently offline. Downloaded lessons, vocabulary guides, and audio narrations remain fully accessible.</span>
            </div>
          )}

          {/* Language Selection Segmented Switcher */}
          <div>
            <div className="text-xs font-semibold text-[var(--md-sys-color-on-surface)] mb-2 flex items-center justify-between">
              <span>Select Language Pack</span>
              {packStatus && packStatus.totalCachedBytes > 0 && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {formatBytes(packStatus.totalCachedBytes)} saved offline
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 bg-[var(--md-sys-color-surface-container-high)] p-1.5 rounded-2xl border border-[var(--md-sys-color-outline-variant)]/40">
              <button
                type="button"
                onClick={() => {
                  setSelectedLang("mandarin");
                  onLanguageChange?.("mandarin");
                }}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2 sm:px-3 rounded-xl font-medium text-xs transition-all cursor-pointer min-h-[40px] text-center ${
                  selectedLang === "mandarin"
                    ? "bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-primary)] font-semibold shadow-xs"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
              >
                <span className="text-sm shrink-0">🇨🇳</span>
                <span className="hidden sm:inline">Mandarin Chinese (HSK 1–6)</span>
                <span className="sm:hidden">Mandarin (HSK)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedLang("japanese");
                  onLanguageChange?.("japanese");
                }}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2 sm:px-3 rounded-xl font-medium text-xs transition-all cursor-pointer min-h-[40px] text-center ${
                  selectedLang === "japanese"
                    ? "bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-primary)] font-semibold shadow-xs"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
              >
                <span className="text-sm shrink-0">🇯🇵</span>
                <span className="hidden sm:inline">Japanese (JLPT N5–N1)</span>
                <span className="sm:hidden">Japanese (JLPT)</span>
              </button>
            </div>
          </div>

          {/* Download Options Box */}
          <div className="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]/40 space-y-3.5">
            <div className="font-semibold text-xs text-[var(--md-sys-color-on-surface)] flex items-center justify-between">
              <span>Package Contents</span>
              <span className="text-[11px] font-normal text-[var(--md-sys-color-on-surface-variant)]">
                206 Graded Stories Available
              </span>
            </div>

            {/* 1. Text & Lexicon */}
            <div className="p-3 rounded-xl bg-[var(--md-sys-color-surface-container-lowest)] border border-[var(--md-sys-color-outline-variant)]/40 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <BookOpen className="w-4 h-4 text-[var(--md-sys-color-tertiary)] mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-[var(--md-sys-color-on-surface)]">
                    Story Texts, Vocabulary &amp; Reading Guides
                  </div>
                  <div className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5 leading-relaxed">
                    Complete text for all 206 lessons, including furigana or pinyin reading guides, line-by-line translations, and vocabulary breakdowns
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold text-[10px] mb-1">
                  Included
                </span>
                <div className="font-mono text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                  {textBytesFormatted}
                </div>
                <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]/70">
                  {textBytesExact}
                </div>
              </div>
            </div>

            {/* 2. Audio Narration Option */}
            <label
              htmlFor="include-audio-checkbox"
              className={`p-3 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition-all ${
                includeAudio
                  ? "bg-[var(--md-sys-color-surface-container-lowest)] border-[var(--md-sys-color-primary)]/50 shadow-xs"
                  : "bg-[var(--md-sys-color-surface-container-lowest)]/50 border-[var(--md-sys-color-outline-variant)]/40 opacity-75"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <input
                  id="include-audio-checkbox"
                  type="checkbox"
                  checked={includeAudio}
                  onChange={(e) => setIncludeAudio(e.target.checked)}
                  disabled={isCurrentLangDownloading}
                  className="w-4 h-4 mt-0.5 rounded accent-[var(--md-sys-color-primary)] cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--md-sys-color-on-surface)]">
                    <Headphones className="w-3.5 h-3.5 text-[var(--md-sys-color-primary)]" />
                    <span>Full Voice Audio Narrations</span>
                  </div>
                  <div className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] mt-0.5 leading-relaxed">
                    Natural native-speaker narrations for every story. Practice listening and pronunciation without an internet connection.
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[10px] mb-1 ${
                    includeAudio
                      ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {includeAudio ? "Included" : "Excluded"}
                </span>
                <div className="font-mono font-bold text-xs text-[var(--md-sys-color-primary)]">
                  {audioBytesFormatted}
                </div>
                <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">
                  {audioBytesExact}
                </div>
              </div>
            </label>

            {/* Total Size Summary */}
            <div className="pt-2 flex items-center justify-between border-t border-[var(--md-sys-color-outline-variant)]/30 text-xs">
              <span className="font-medium text-[var(--md-sys-color-on-surface-variant)]">
                Total download size:
              </span>
              <div className="text-right">
                <span className="font-bold text-sm text-[var(--md-sys-color-on-surface)]">
                  {totalTargetFormatted}
                </span>
                <span className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] ml-1.5">
                  ({totalTargetExact})
                </span>
              </div>
            </div>
          </div>

          {/* Precise Progress Bar & Live Status */}
          {(isCurrentLangDownloading || isCurrentLangPaused || isCurrentLangError) && progress && (
            <div
              ref={progressRef}
              className="p-4 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/60 space-y-2.5"
            >
              <div className="flex items-center justify-between font-semibold text-xs">
                <span className="flex items-center gap-1.5 text-[var(--md-sys-color-on-surface)]">
                  {isCurrentLangDownloading && (
                    <span className="w-2 h-2 rounded-full bg-[var(--md-sys-color-primary)] animate-pulse" />
                  )}
                  {isCurrentLangError && (
                    <span className="w-2 h-2 rounded-full bg-[var(--md-sys-color-error)]" />
                  )}
                  {isCurrentLangDownloading && "Downloading offline pack..."}
                  {isCurrentLangPaused && "Download paused"}
                  {isCurrentLangError && "Download paused — connection issue"}
                </span>
                <span
                  className={`font-mono text-sm font-bold ${
                    isCurrentLangError
                      ? "text-[var(--md-sys-color-error)]"
                      : "text-[var(--md-sys-color-primary)]"
                  }`}
                >
                  {progress.percentage.toFixed(1)}%
                </span>
              </div>

              {/* MD3 True Progress Bar Fill */}
              <div className="w-full h-3 rounded-full bg-[var(--md-sys-color-surface-container-lowest)] overflow-hidden p-0.5 border border-[var(--md-sys-color-outline-variant)]/30">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    isCurrentLangError
                      ? "bg-[var(--md-sys-color-error)]"
                      : "bg-gradient-to-r from-[var(--md-sys-color-primary)] to-[var(--md-sys-color-tertiary)]"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, progress.percentage))}%` }}
                />
              </div>

              {/* Exact Bytes and File Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                <div>
                  <span className="block text-[10px] text-[var(--md-sys-color-on-surface-variant)]/70">
                    Downloaded
                  </span>
                  <span className="font-mono font-medium text-[var(--md-sys-color-on-surface)]">
                    {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-[var(--md-sys-color-on-surface-variant)]/70">
                    Files saved
                  </span>
                  <span className="font-mono font-medium text-[var(--md-sys-color-on-surface)]">
                    {progress.completedFiles} / {progress.totalFiles}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-[var(--md-sys-color-on-surface-variant)]/70">
                    Transfer speed
                  </span>
                  <span className="font-mono font-medium text-[var(--md-sys-color-on-surface)]">
                    {isCurrentLangDownloading ? formatSpeed(progress.speedBps) : "--"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-[var(--md-sys-color-on-surface-variant)]/70">
                    Time remaining
                  </span>
                  <span className="font-mono font-medium text-[var(--md-sys-color-on-surface)]">
                    {isCurrentLangDownloading ? formatEta(progress.etaSeconds) : "--"}
                  </span>
                </div>
              </div>

              {/* Current File transferred label */}
              {progress.currentFileName && (
                <div className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] truncate pt-0.5">
                  <span className="font-medium text-[var(--md-sys-color-on-surface)]">Current file: </span>
                  <span className="font-mono">{progress.currentFileName}</span>
                </div>
              )}

              {/* Semantic MD3 Error alert banner */}
              {isCurrentLangError && progress.errorMessage && (
                <div className="p-3 rounded-2xl bg-[var(--md-sys-color-error-container)]/80 border border-[var(--md-sys-color-error)]/40 text-[var(--md-sys-color-on-error-container)] text-[11px] flex items-start gap-2.5 shadow-xs">
                  <AlertCircle className="w-4 h-4 text-[var(--md-sys-color-error)] mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <div className="font-semibold text-xs text-[var(--md-sys-color-on-error-container)]">
                      Connection Interrupted
                    </div>
                    <div className="text-[11px] text-[var(--md-sys-color-on-error-container)]/90 leading-relaxed">
                      {progress.errorMessage}
                    </div>
                    <div className="text-[10px] font-medium text-[var(--md-sys-color-error)] pt-1">
                      Tap Resume Download below to continue from where you left off.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success Banner if Completed */}
          {packStatus?.isTextComplete && (packStatus.isAudioComplete || !includeAudio) && !isCurrentLangDownloading && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-xs text-emerald-900 dark:text-emerald-200">
                    {manifest?.languageLabel} Pack Ready Offline
                  </div>
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    All {packStatus.textCachedFiles} lessons and {packStatus.audioCachedFiles} audio tracks are saved locally ({formatBytes(packStatus.totalCachedBytes)}). You can study offline anytime.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDeletePack}
                disabled={isDeleting}
                className="px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
                title="Remove saved offline files to free up device storage"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Offline Pack</span>
              </button>
            </div>
          )}

          {/* Device Specific Installation Instructions */}
          <div className="space-y-2 pt-1 border-t border-[var(--md-sys-color-outline-variant)]/30">
            <div className="text-xs font-semibold text-[var(--md-sys-color-on-surface)] mb-2">
              Installation Guide by Device
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]/40">
                <div className="flex items-center gap-1.5 font-semibold text-[11px] text-[var(--md-sys-color-on-surface)] mb-1">
                  <Laptop className="w-3.5 h-3.5 text-[var(--md-sys-color-primary)]" />
                  <span>Desktop (Chrome &amp; Edge)</span>
                </div>
                <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] leading-snug">
                  Click the install icon on the right side of the address bar.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]/40">
                <div className="flex items-center gap-1.5 font-semibold text-[11px] text-[var(--md-sys-color-on-surface)] mb-1">
                  <Smartphone className="w-3.5 h-3.5 text-[var(--md-sys-color-tertiary)]" />
                  <span>iPhone &amp; iPad (Safari)</span>
                </div>
                <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] leading-snug">
                  Tap Share <Share2 className="w-2.5 h-2.5 inline mx-0.5" /> then choose &quot;Add to Home Screen&quot;.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]/40">
                <div className="flex items-center gap-1.5 font-semibold text-[11px] text-[var(--md-sys-color-on-surface)] mb-1">
                  <Smartphone className="w-3.5 h-3.5 text-[var(--md-sys-color-primary)]" />
                  <span>Android (Chrome)</span>
                </div>
                <p className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] leading-snug">
                  Tap the menu icon (⋮) in the top-right corner, then select &quot;Install app&quot;.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 bg-[var(--md-sys-color-surface-container-low)] border-t border-[var(--md-sys-color-outline-variant)]/40 shrink-0 safe-bottom">
          <div className="text-[11px] text-[var(--md-sys-color-on-surface-variant)] flex items-center justify-center sm:justify-start gap-1.5">
            <HardDrive className="w-3.5 h-3.5" />
            <span>
              {storageEstimate.quota
                ? `Device storage: ${storageEstimate.usage} used of ${storageEstimate.quota} available`
                : "Saved in browser offline storage"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isCurrentLangDownloading ? (
              <button
                type="button"
                onClick={handlePause}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] font-semibold text-xs transition-colors cursor-pointer min-h-[44px] sm:min-h-[38px]"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Download</span>
              </button>
            ) : isCurrentLangPaused || isCurrentLangError ? (
              <button
                type="button"
                onClick={handleResume}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-semibold text-xs shadow-xs hover:opacity-95 transition-opacity cursor-pointer min-h-[44px] sm:min-h-[38px]"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume Download ({progress ? `${progress.percentage.toFixed(0)}%` : ""})</span>
              </button>
            ) : packStatus?.canResume ? (
              <button
                type="button"
                onClick={handleResume}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-semibold text-xs shadow-xs hover:opacity-95 transition-opacity cursor-pointer min-h-[44px] sm:min-h-[38px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Resume Download</span>
              </button>
            ) : isFullyInstalled ? (
              <button
                type="button"
                onClick={handleStartDownload}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] font-semibold text-xs transition-colors cursor-pointer min-h-[44px] sm:min-h-[38px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Check for Updates</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartDownload}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-semibold text-xs shadow-xs hover:opacity-95 transition-opacity cursor-pointer min-h-[44px] sm:min-h-[38px]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Language Pack ({totalTargetFormatted})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] hover:bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] font-semibold text-xs transition-colors cursor-pointer min-h-[44px] sm:min-h-[38px]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
