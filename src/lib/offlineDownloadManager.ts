/**
 * Offline Download Manager
 *
 * Implements byte-accurate streaming downloads with real-time non-fake progress,
 * full resumability in case of network drop or user pause, and storage status inspection.
 */

import { LanguageManifest, AudioManifestItem, TextManifestItem } from "@/app/api/offline-manifest/route";

export const CACHE_NAME = "polyglot-reader-v2";

export interface DownloadProgress {
  stage: "idle" | "inspecting" | "downloading" | "paused" | "error" | "completed";
  language: "mandarin" | "japanese";
  includeAudio: boolean;
  currentFileName: string;
  currentFileType: "text" | "audio" | "manifest";
  completedFiles: number;
  totalFiles: number;
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
  speedBps: number;
  etaSeconds: number;
  errorMessage: string | null;
}

export interface PackStatus {
  language: "mandarin" | "japanese";
  textCachedFiles: number;
  textTotalFiles: number;
  textCachedBytes: number;
  textTotalBytes: number;
  isTextComplete: boolean;

  audioCachedFiles: number;
  audioTotalFiles: number;
  audioCachedBytes: number;
  audioTotalBytes: number;
  isAudioComplete: boolean;

  totalCachedBytes: number;
  canResume: boolean;
}

// Format bytes into human-readable string
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KB`;
  const mib = kib / 1024;
  return `${mib.toFixed(2)} MB`;
}

// Format speed into string (e.g. "2.4 MB/s")
export function formatSpeed(bps: number): string {
  if (bps <= 0) return "0 KB/s";
  return `${formatBytes(bps)}/s`;
}

// Format ETA seconds into human-readable duration
export function formatEta(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return "--";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
}

class OfflineDownloadManager {
  private abortController: AbortController | null = null;
  private isPaused = false;
  private isRunning = false;
  private currentProgress: DownloadProgress | null = null;
  private listeners: Set<(progress: DownloadProgress) => void> = new Set();

  public subscribe(fn: (progress: DownloadProgress) => void) {
    this.listeners.add(fn);
    if (this.currentProgress) {
      fn(this.currentProgress);
    }
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(progress: DownloadProgress) {
    this.currentProgress = progress;
    this.listeners.forEach((fn) => {
      try {
        fn(progress);
      } catch (e) {
        console.error("Progress listener error:", e);
      }
    });
  }

  /**
   * Fetch manifest for a language
   */
  public async getManifest(lang: "mandarin" | "japanese"): Promise<LanguageManifest> {
    const res = await fetch(`/api/offline-manifest?lang=${lang}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch offline manifest for ${lang} (${res.status})`);
    }
    return await res.json();
  }

  /**
   * Inspect current cache status for a language
   */
  public async checkStatus(lang: "mandarin" | "japanese", manifest?: LanguageManifest): Promise<PackStatus> {
    if (typeof window === "undefined" || !("caches" in window)) {
      return {
        language: lang,
        textCachedFiles: 0,
        textTotalFiles: 206,
        textCachedBytes: 0,
        textTotalBytes: 0,
        isTextComplete: false,
        audioCachedFiles: 0,
        audioTotalFiles: 206,
        audioCachedBytes: 0,
        audioTotalBytes: 0,
        isAudioComplete: false,
        totalCachedBytes: 0,
        canResume: false,
      };
    }

    const data = manifest || (await this.getManifest(lang));
    const cache = await caches.open(CACHE_NAME);

    let textCachedFiles = 0;
    let textCachedBytes = 0;
    for (const t of data.text.files) {
      const match = await cache.match(t.url);
      if (match) {
        textCachedFiles++;
        textCachedBytes += t.size;
      }
    }

    let audioCachedFiles = 0;
    let audioCachedBytes = 0;
    for (const a of data.audio.files) {
      const match = await cache.match(a.url);
      if (match) {
        audioCachedFiles++;
        audioCachedBytes += a.size;
      }
    }

    const isTextComplete = textCachedFiles === data.text.totalFiles && data.text.totalFiles > 0;
    const isAudioComplete = audioCachedFiles === data.audio.totalFiles && data.audio.totalFiles > 0;
    const totalCachedBytes = textCachedBytes + audioCachedBytes;
    const canResume = (textCachedFiles > 0 && !isTextComplete) || (audioCachedFiles > 0 && !isAudioComplete);

    return {
      language: lang,
      textCachedFiles,
      textTotalFiles: data.text.totalFiles,
      textCachedBytes,
      textTotalBytes: data.text.totalBytes,
      isTextComplete,
      audioCachedFiles,
      audioTotalFiles: data.audio.totalFiles,
      audioCachedBytes,
      audioTotalBytes: data.audio.totalBytes,
      isAudioComplete,
      totalCachedBytes,
      canResume,
    };
  }

  /**
   * Pause any ongoing download
   */
  public pause() {
    this.isPaused = true;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Start or resume downloading language pack with precise byte-level tracking
   */
  public async startDownload({
    language,
    includeAudio,
    onProgress,
  }: {
    language: "mandarin" | "japanese";
    includeAudio: boolean;
    onProgress?: (p: DownloadProgress) => void;
  }): Promise<void> {
    if (this.isRunning) {
      console.warn("Download is already running");
      return;
    }

    if (onProgress) {
      this.subscribe(onProgress);
    }

    this.isRunning = true;
    this.isPaused = false;
    this.abortController = new AbortController();

    const signal = this.abortController.signal;

    try {
      this.notify({
        stage: "inspecting",
        language,
        includeAudio,
        currentFileName: "Fetching manifest...",
        currentFileType: "manifest",
        completedFiles: 0,
        totalFiles: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        percentage: 0,
        speedBps: 0,
        etaSeconds: 0,
        errorMessage: null,
      });

      const manifest = await this.getManifest(language);
      const cache = await caches.open(CACHE_NAME);

      // Define target items
      interface QueueItem {
        id: number;
        title: string;
        url: string;
        size: number;
        type: "text" | "audio";
        contentType: string;
      }

      const allItems: QueueItem[] = [];

      // 1. Text items (Always included per requirement: "this assumes all the text is also being downloaded")
      for (const t of manifest.text.files) {
        allItems.push({
          id: t.id,
          title: t.title,
          url: t.url,
          size: t.size,
          type: "text",
          contentType: "application/json",
        });
      }

      // 2. Audio items (Included if includeAudio is true)
      if (includeAudio) {
        for (const a of manifest.audio.files) {
          allItems.push({
            id: a.id,
            title: a.title,
            url: a.url,
            size: a.size,
            type: "audio",
            contentType: "audio/mpeg",
          });
        }
      }

      const totalFiles = allItems.length;
      const totalBytes = allItems.reduce((acc, item) => acc + item.size, 0);

      // Inspect cache for already completed files to enable instantaneous resumability
      const pendingItems: QueueItem[] = [];
      let initialDownloadedBytes = 0;
      let initialCompletedFiles = 0;

      for (const item of allItems) {
        const cached = await cache.match(item.url);
        if (cached) {
          initialDownloadedBytes += item.size;
          initialCompletedFiles++;
        } else {
          pendingItems.push(item);
        }
      }

      let downloadedBytes = initialDownloadedBytes;
      let completedFiles = initialCompletedFiles;

      const initialPct = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;

      this.notify({
        stage: pendingItems.length === 0 ? "completed" : "downloading",
        language,
        includeAudio,
        currentFileName: pendingItems.length === 0 ? "All files already cached" : "Preparing download...",
        currentFileType: pendingItems[0]?.type || "text",
        completedFiles,
        totalFiles,
        downloadedBytes,
        totalBytes,
        percentage: Math.min(100, Math.round(initialPct * 10) / 10),
        speedBps: 0,
        etaSeconds: 0,
        errorMessage: null,
      });

      if (pendingItems.length === 0) {
        this.isRunning = false;
        return;
      }

      // Speed & ETA tracking variables
      const speedWindowDuration = 3000; // 3-second window
      const speedSamples: { time: number; bytes: number }[] = [];
      speedSamples.push({ time: performance.now(), bytes: downloadedBytes });

      // Process pending queue sequentially to ensure file-level atomic commits to cache
      for (let i = 0; i < pendingItems.length; i++) {
        if (this.isPaused || signal.aborted) {
          this.notify({
            stage: "paused",
            language,
            includeAudio,
            currentFileName: "Download paused",
            currentFileType: pendingItems[i].type,
            completedFiles,
            totalFiles,
            downloadedBytes,
            totalBytes,
            percentage: Math.min(100, Math.round((downloadedBytes / totalBytes) * 1000) / 10),
            speedBps: 0,
            etaSeconds: 0,
            errorMessage: null,
          });
          this.isRunning = false;
          return;
        }

        const item = pendingItems[i];
        let attempts = 0;
        const maxAttempts = 3;
        let success = false;
        let lastError: Error | null = null;

        while (attempts < maxAttempts && !success && !this.isPaused && !signal.aborted) {
          attempts++;
          try {
            const res = await fetch(item.url, {
              signal,
              cache: "no-store",
            });

            if (!res.ok) {
              throw new Error(`HTTP ${res.status} from ${item.url}`);
            }

            if (!res.body) {
              const blob = await res.blob();
              downloadedBytes += blob.size;
              await cache.put(
                item.url,
                new Response(blob, {
                  headers: {
                    "Content-Type": item.contentType,
                    "Content-Length": String(blob.size),
                    "Cache-Control": "public, max-age=31536000",
                  },
                })
              );
              success = true;
              completedFiles++;
            } else {
              // Read stream byte-by-byte for authentic, un-faked progress bar updates
              const reader = res.body.getReader();
              const chunks: Uint8Array[] = [];
              let receivedForThisFile = 0;

              while (true) {
                if (this.isPaused || signal.aborted) {
                  reader.cancel();
                  break;
                }

                const { done, value } = await reader.read();
                if (done) break;

                if (value) {
                  chunks.push(value);
                  receivedForThisFile += value.length;
                  downloadedBytes += value.length;

                  // Update speed window
                  const now = performance.now();
                  speedSamples.push({ time: now, bytes: downloadedBytes });
                  while (speedSamples.length > 1 && now - speedSamples[0].time > speedWindowDuration) {
                    speedSamples.shift();
                  }

                  let currentSpeed = 0;
                  if (speedSamples.length > 1) {
                    const elapsedSec = (now - speedSamples[0].time) / 1000;
                    const bytesDelta = downloadedBytes - speedSamples[0].bytes;
                    currentSpeed = elapsedSec > 0 ? bytesDelta / elapsedSec : 0;
                  }

                  const remainingBytes = Math.max(0, totalBytes - downloadedBytes);
                  const eta = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;
                  const pct = Math.min(100, Math.round((downloadedBytes / totalBytes) * 1000) / 10);

                  this.notify({
                    stage: "downloading",
                    language,
                    includeAudio,
                    currentFileName: item.title,
                    currentFileType: item.type,
                    completedFiles,
                    totalFiles,
                    downloadedBytes,
                    totalBytes,
                    percentage: pct,
                    speedBps: Math.round(currentSpeed),
                    etaSeconds: Math.round(eta),
                    errorMessage: null,
                  });
                }
              }

              if (this.isPaused || signal.aborted) {
                this.notify({
                  stage: "paused",
                  language,
                  includeAudio,
                  currentFileName: "Download paused",
                  currentFileType: item.type,
                  completedFiles,
                  totalFiles,
                  downloadedBytes,
                  totalBytes,
                  percentage: Math.min(100, Math.round((downloadedBytes / totalBytes) * 1000) / 10),
                  speedBps: 0,
                  etaSeconds: 0,
                  errorMessage: null,
                });
                this.isRunning = false;
                return;
              }

              // Concatenate chunks and save directly to CacheStorage
              const fullBlob = new Blob(chunks as unknown as BlobPart[], { type: item.contentType });
              await cache.put(
                item.url,
                new Response(fullBlob, {
                  headers: {
                    "Content-Type": item.contentType,
                    "Content-Length": String(fullBlob.size),
                    "Cache-Control": "public, max-age=31536000",
                  },
                })
              );

              success = true;
              completedFiles++;
            }
          } catch (err: any) {
            lastError = err;
            if (this.isPaused || signal.aborted) {
              break;
            }
            console.warn(`Attempt ${attempts} failed for ${item.url}:`, err);
            // Brief backoff before retry
            await new Promise((resolve) => setTimeout(resolve, 800 * attempts));
          }
        }

        if (!success && !this.isPaused && !signal.aborted) {
          // Network failure! Preserve progress and inform user with resumable state
          const pct = Math.min(100, Math.round((downloadedBytes / totalBytes) * 1000) / 10);
          this.notify({
            stage: "error",
            language,
            includeAudio,
            currentFileName: item.title,
            currentFileType: item.type,
            completedFiles,
            totalFiles,
            downloadedBytes,
            totalBytes,
            percentage: pct,
            speedBps: 0,
            etaSeconds: 0,
            errorMessage: `Network error downloading ${item.title}: ${lastError?.message || "Connection interrupted"}. Progress is saved and resumable.`,
          });
          this.isRunning = false;
          return;
        }
      }

      // 100% Download Completed!
      this.notify({
        stage: "completed",
        language,
        includeAudio,
        currentFileName: "Download complete!",
        currentFileType: "audio",
        completedFiles: totalFiles,
        totalFiles,
        downloadedBytes: totalBytes,
        totalBytes,
        percentage: 100,
        speedBps: 0,
        etaSeconds: 0,
        errorMessage: null,
      });
    } catch (err: any) {
      if (!this.isPaused && !signal.aborted) {
        console.error("Fatal download error:", err);
        this.notify({
          stage: "error",
          language,
          includeAudio,
          currentFileName: "Failed",
          currentFileType: "text",
          completedFiles: 0,
          totalFiles: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          percentage: 0,
          speedBps: 0,
          etaSeconds: 0,
          errorMessage: err?.message || "An unexpected error occurred during download.",
        });
      }
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  /**
   * Delete all cached text and audio for a language
   */
  public async deleteLanguagePack(lang: "mandarin" | "japanese"): Promise<void> {
    if (typeof window === "undefined" || !("caches" in window)) return;
    const manifest = await this.getManifest(lang);
    const cache = await caches.open(CACHE_NAME);

    for (const t of manifest.text.files) {
      await cache.delete(t.url);
    }
    for (const a of manifest.audio.files) {
      await cache.delete(a.url);
    }
  }
}

// Global singleton instance
export const offlineDownloadManager = new OfflineDownloadManager();
