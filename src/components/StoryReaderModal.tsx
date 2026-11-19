"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Languages,
  BookOpen,
  ExternalLink,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-react";
import { StoryCatalogItem, StoryDetail, VocabularyItem, Language } from "@/types";
import { kanaToRomaji, convertRubyHtmlToRomaji } from "@/lib/japaneseRomaji";

interface StoryReaderModalProps {
  story: StoryCatalogItem | null;
  language: Language;
  onClose: () => void;
}

export default function StoryReaderModal({
  story,
  language,
  onClose,
}: StoryReaderModalProps) {
  const isMandarin = language === "mandarin";
  const isJapanese = language === "japanese";
  const isRussian = language === "russian";

  const [detail, setDetail] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioBuffering, setIsAudioBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // Reader settings
  const [showReading, setShowReading] = useState(true); // Pinyin / Reading
  const [japaneseReadingMode, setJapaneseReadingMode] = useState<"furigana" | "romaji">("furigana");
  const [isTraditional, setIsTraditional] = useState(false);
  const [isSpaceOn, setIsSpaceOn] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [activeTab, setActiveTab] = useState<"story" | "vocabulary">("story");
  const [fontSize, setFontSize] = useState<"normal" | "large" | "xlarge">("large");

  // Word Tooltip state with on-screen collision clamping and directional arrow
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    arrowX: number;
    placement: "top" | "bottom";
    width: number;
    pinyin: string;
    reading: string;
    translation: string;
    level: string;
    visible: boolean;
    targetWord?: string;
  }>({
    x: 0,
    y: 0,
    arrowX: 16,
    placement: "top",
    width: 280,
    pinyin: "",
    reading: "",
    translation: "",
    level: "",
    visible: false,
    targetWord: undefined,
  });

  // Fetch full story details & reset audio state on story/language change
  useEffect(() => {
    if (!story) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      // Proactively trigger eager buffer load for the story under consideration
      audioRef.current.load();
    }
    setIsPlaying(false);
    setIsAudioBuffering(false);
    setCurrentTime(0);
    setDuration(0);

    setLoading(true);
    fetch(`/api/stories/${story.id}?lang=${language}`)
      .then((res) => {
        if (!res.ok) {
          // Fallback to static JSON file on CDN
          return fetch(`/stories/${language}/${story.id}.json`).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          });
        }
        return res.json();
      })
      .then((data: StoryDetail) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load story detail:", err);
        setLoading(false);
      });
  }, [story, language]);

  // Pause audio and cleanup when modal is closed / unmounted
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }
    };
  }, []);

  // Keyboard shortcut: ESC to close, Space to toggle audio
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " " && e.target === document.body) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying]);

  // Audio event handlers
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsAudioBuffering(false);
    } else {
      if (audioRef.current.readyState < 3) {
        setIsAudioBuffering(true);
      }
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsAudioBuffering(false);
        })
        .catch((err) => {
          console.error("Audio playback error:", err);
          setIsPlaying(false);
          setIsAudioBuffering(false);
        });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Tooltip interaction for vocabulary in the text with airtight on-screen clamping
  const handleWordInteraction = (
    e: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>,
    vocabList: VocabularyItem[]
  ) => {
    const target = e.target as HTMLElement;
    const ruby = target.closest("ruby");
    if (!ruby) {
      setTooltip((prev) => ({ ...prev, visible: false }));
      return;
    }

    e.stopPropagation();

    const py = ruby.getAttribute("data-py") || "";
    const defn = ruby.getAttribute("data-defn") || "";
    const hsk = ruby.getAttribute("data-hsk") || "";
    const wordText =
      ruby.querySelector(".si")?.textContent ||
      ruby.textContent?.replace(ruby.querySelector("rt")?.textContent || "", "").trim() ||
      "";

    let pinyin = py;
    let reading = wordText;
    let translation = defn;
    let level = hsk;
    if (isRussian && level && !level.startsWith("ТРКИ")) {
      level = `ТРКИ ${level}`;
    }

    if (!pinyin && !translation) {
      // Search in vocab list fallback
      const found = vocabList.find(
        (v) =>
          (wordText && (v.word.includes(wordText) || wordText.includes(v.word))) ||
          (v.pinyin && wordText.includes(v.pinyin))
      );
      if (found) {
        pinyin = found.pinyin || found.reading || "";
        reading = found.word;
        translation = found.translation;
        level = isRussian
          ? (found.torfl ? `ТРКИ ${found.torfl}` : found.hsk ? `ТРКИ ${found.hsk}` : "")
          : found.hsk || (found.jlpt ? `JLPT ${found.jlpt}` : "");
      }
    }

    if (!pinyin && !translation && !reading) {
      return;
    }

    if (isJapanese && japaneseReadingMode === "romaji") {
      pinyin = kanaToRomaji(py || wordText, defn, wordText);
    }

    // Toggle off if tapping the already open word on mobile
    if (tooltip.visible && tooltip.targetWord === wordText && e.type === "click") {
      setTooltip((prev) => ({ ...prev, visible: false, targetWord: undefined }));
      return;
    }

    const rect = ruby.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 375;
    const vh = typeof window !== "undefined" ? window.innerHeight : 667;
    const padding = 12; // 12px safe boundary from viewport edges
    const tooltipWidth = Math.min(vw - padding * 2, 280);

    const targetX = rect.left + rect.width / 2;
    const idealLeft = targetX - tooltipWidth / 2;
    // Guaranteed on-screen clamping: left is strictly bounded between padding and vw - tooltipWidth - padding
    const clampedLeft = Math.max(padding, Math.min(vw - tooltipWidth - padding, idealLeft));
    // Arrow points directly at the center of the character, clamped to card body
    const arrowX = Math.max(16, Math.min(tooltipWidth - 16, targetX - clampedLeft));

    // Vertical collision detection: flip to bottom if character is near header/top of viewport
    const estimatedHeight = 100;
    let placement: "top" | "bottom" = "top";
    let y = rect.top - 10;

    if (rect.top < 150) {
      placement = "bottom";
      y = rect.bottom + 10;
    } else if (rect.top - estimatedHeight < 20) {
      placement = "bottom";
      y = Math.min(vh - estimatedHeight - padding, rect.bottom + 10);
    }

    setTooltip({
      x: clampedLeft,
      y,
      arrowX,
      placement,
      width: tooltipWidth,
      pinyin,
      reading,
      translation,
      level,
      visible: true,
      targetWord: wordText,
    });
  };

  const closeTooltip = () => {
    if (tooltip.visible) {
      setTooltip((prev) => ({ ...prev, visible: false, targetWord: undefined }));
    }
  };

  if (!story) return null;

  const rawAudioPath = isMandarin
    ? story.audio.mandarin
    : isJapanese
    ? story.audio.japanese
    : story.audio.russian || `/audio/russian/${story.id}_${story.slug}.mp3`;

  const rawAudioBase = process.env.NEXT_PUBLIC_AUDIO_BASE_URL?.replace(/\/$/, "") || "";
  const audioBaseUrl = rawAudioBase.includes("r2.dev") ? "" : rawAudioBase;
  const audioSrc = rawAudioPath ? `${audioBaseUrl}${rawAudioPath}` : "";

  // Font size class mapping
  const fontSizeClass =
    fontSize === "normal"
      ? "text-base sm:text-lg leading-[2.2]"
      : fontSize === "large"
      ? "text-lg sm:text-2xl leading-[2.4]"
      : "text-xl sm:text-3xl leading-[2.6]";

  // Memoize ruby paragraphs with on-the-fly Romaji transliteration for Japanese
  const renderedParagraphs = React.useMemo(() => {
    const raw =
      detail?.ruby_paragraphs && detail.ruby_paragraphs.length > 0
        ? detail.ruby_paragraphs
        : isMandarin
        ? (isTraditional ? detail?.traditional_paragraphs : detail?.simplified_paragraphs) || []
        : isJapanese
        ? detail?.japanese_paragraphs || []
        : detail?.russian_paragraphs || [];

    if (isJapanese && japaneseReadingMode === "romaji") {
      return raw.map((p) => convertRubyHtmlToRomaji(p));
    }
    return raw;
  }, [detail, isMandarin, isJapanese, isTraditional, japaneseReadingMode]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={story.title}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="bg-[var(--md-sys-color-surface-container-lowest)] border-0 sm:border border-[var(--md-sys-color-outline-variant)] rounded-none sm:rounded-2xl w-full max-w-4xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-all duration-200"
        onClick={(e) => {
          e.stopPropagation();
          closeTooltip();
        }}
      >
        {/* Modal Top App Bar */}
        <div className="px-4 py-3 sm:px-5 sm:py-4 bg-[var(--md-sys-color-surface-container-low)] border-b border-[var(--md-sys-color-outline-variant)]/60 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shrink-0">
              {isMandarin
                ? story.hsk
                : isJapanese
                ? `JLPT ${story.jlpt}`
                : detail?.torfl_level
                ? `ТРКИ ${detail.torfl_level}`
                : story.torfl
                ? `ТРКИ ${story.torfl}`
                : story.level || "A1"}
            </span>
            <div className="min-w-0">
              <h2 className="font-montserrat font-bold text-base sm:text-lg text-[var(--md-sys-color-on-surface)] truncate">
                {isMandarin
                  ? story.title
                  : isJapanese
                  ? story.japanese?.title || story.title
                  : story.russian?.title || story.title}
              </h2>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] truncate">
                {story.title} • {story.level}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container)] rounded-full transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
            aria-label="Close reader"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Embedded Neural Audio Player Bar */}
        <div className="px-4 py-2.5 sm:px-5 sm:py-3 bg-[var(--md-sys-color-surface-container)] border-b border-[var(--md-sys-color-outline-variant)]/40 shrink-0">
          <audio
            ref={audioRef}
            src={audioSrc}
            preload="auto"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setIsAudioBuffering(true)}
            onPlaying={() => setIsAudioBuffering(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onCanPlay={() => {
              setIsAudioBuffering(false);
              if (audioRef.current && audioRef.current.duration) {
                setDuration(audioRef.current.duration);
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              setIsAudioBuffering(false);
            }}
            onError={() => {
              setIsAudioBuffering(false);
              if (rawAudioPath && audioRef.current && audioRef.current.src !== window.location.origin + rawAudioPath) {
                console.warn("Audio load error on primary src, falling back to local:", rawAudioPath);
                audioRef.current.src = rawAudioPath;
                audioRef.current.load();
              }
            }}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center hover:opacity-90 shadow-xs cursor-pointer transition-transform active:scale-95 shrink-0"
                aria-label={isAudioBuffering ? "Buffering audio" : isPlaying ? "Pause audio" : "Play audio"}
              >
                {isAudioBuffering ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              {/* Progress Slider */}
              <div className="flex-1 min-w-[80px]">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-[var(--md-sys-color-outline-variant)] rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="text-[11px] sm:text-xs font-mono text-[var(--md-sys-color-on-surface-variant)] shrink-0">
                <span>{formatTime(currentTime)}</span>
                <span> / </span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Speed Controls */}
            <div className="flex items-center justify-between sm:justify-start gap-1">
              <span className="sm:hidden text-[11px] text-[var(--md-sys-color-on-surface-variant)] font-medium">Speed:</span>
              <div className="flex items-center gap-1 bg-[var(--md-sys-color-surface-container-lowest)] p-0.5 rounded-full shadow-2xs">
                {[0.75, 1.0, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                      playbackSpeed === speed
                        ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                        : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                    }`}
                  >
                    {speed}×
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Reader Action Ribbon & Toggle Controls */}
        <div className="px-3.5 py-2 sm:px-5 sm:py-2.5 bg-[var(--md-sys-color-surface-container-low)] border-b border-[var(--md-sys-color-outline-variant)]/40 shrink-0">
          {/* Mobile Layout (< sm): Stacked Two-Tier Controls */}
          <div className="flex sm:hidden flex-col gap-2 text-xs">
            {/* Top Tier: Tabs and Font Size Selector */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-[var(--md-sys-color-surface-container)] p-0.5 rounded-full shadow-2xs">
                <button
                  onClick={() => setActiveTab("story")}
                  className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer min-h-[32px] text-[11px] ${
                    activeTab === "story"
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                      : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
                  }`}
                >
                  Story Text
                </button>
                <button
                  onClick={() => setActiveTab("vocabulary")}
                  className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer min-h-[32px] text-[11px] ${
                    activeTab === "vocabulary"
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                      : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
                  }`}
                >
                  Vocab ({detail?.vocabulary?.length || (isRussian ? (story.russian?.vocab_count || 0) : isJapanese ? (story.japanese?.vocab_count || 0) : story.mandarin.vocab_count)})
                </button>
              </div>

              {/* Font Size Selector on Mobile */}
              {activeTab === "story" && (
                <div className="flex items-center rounded-full bg-[var(--md-sys-color-surface-container-high)] p-0.5">
                  <button
                    onClick={() => setFontSize("normal")}
                    className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                      fontSize === "normal"
                        ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs"
                        : "text-[var(--md-sys-color-on-surface-variant)]"
                    }`}
                    title="Normal font size"
                  >
                    A
                  </button>
                  <button
                    onClick={() => setFontSize("large")}
                    className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                      fontSize === "large"
                        ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs"
                        : "text-[var(--md-sys-color-on-surface-variant)]"
                    }`}
                    title="Large font size"
                  >
                    A+
                  </button>
                  <button
                    onClick={() => setFontSize("xlarge")}
                    className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                      fontSize === "xlarge"
                        ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs"
                        : "text-[var(--md-sys-color-on-surface-variant)]"
                    }`}
                    title="Extra large font size"
                  >
                    A++
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Tier: Reading & Display Toggles on Mobile */}
            {activeTab === "story" && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
                {isMandarin && (
                  <button
                    onClick={() => setIsTraditional(!isTraditional)}
                    className={`px-2.5 py-1 rounded-full transition-all cursor-pointer font-medium text-[11px] whitespace-nowrap min-h-[32px] ${
                      isTraditional
                        ? "bg-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary)] shadow-xs"
                        : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                    }`}
                  >
                    {isTraditional ? "Traditional" : "Simplified"}
                  </button>
                )}

                {isJapanese && (
                  <button
                    onClick={() => setJapaneseReadingMode(japaneseReadingMode === "furigana" ? "romaji" : "furigana")}
                    className={`px-2.5 py-1 rounded-full transition-all cursor-pointer font-medium text-[11px] whitespace-nowrap min-h-[32px] ${
                      japaneseReadingMode === "romaji"
                        ? "bg-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary)] shadow-xs"
                        : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                    }`}
                  >
                    {japaneseReadingMode === "romaji" ? "Romaji" : "Furigana"}
                  </button>
                )}

                <button
                  onClick={() => setShowReading(!showReading)}
                  className={`px-2.5 py-1 rounded-full transition-all cursor-pointer font-medium text-[11px] whitespace-nowrap min-h-[32px] ${
                    showReading
                      ? "bg-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary)] shadow-xs"
                      : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                  }`}
                >
                  {isMandarin
                    ? showReading
                    ? "Pinyin On"
                    : "Pinyin Off"
                    : isJapanese
                    ? showReading
                      ? `${japaneseReadingMode === "romaji" ? "Romaji" : "Furigana"} On`
                      : "Reading Off"
                    : showReading
                    ? "Translit On"
                    : "Translit Off"}
                </button>

                <button
                  onClick={() => setIsSpaceOn(!isSpaceOn)}
                  className={`px-2.5 py-1 rounded-full transition-all cursor-pointer font-medium text-[11px] whitespace-nowrap min-h-[32px] ${
                    isSpaceOn
                      ? "bg-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary)] shadow-xs"
                      : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                  }`}
                >
                  {isSpaceOn ? "Spaces On" : "Spaces Off"}
                </button>

                <button
                  onClick={() => setShowTranslation(!showTranslation)}
                  className={`px-2.5 py-1 rounded-full transition-all cursor-pointer font-medium text-[11px] whitespace-nowrap min-h-[32px] ${
                    showTranslation
                      ? "bg-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary)] shadow-xs"
                      : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                  }`}
                >
                  {showTranslation ? "Translation On" : "Translation Off"}
                </button>
              </div>
            )}
          </div>

          {/* Tablet & Desktop Layout (sm+) */}
          <div className="hidden sm:flex items-center justify-between gap-3 text-xs">
            {/* Tabs: Story Text vs Vocabulary List */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("story")}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                  activeTab === "story"
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container)]"
                }`}
              >
                Story Reading
              </button>
              <button
                onClick={() => setActiveTab("vocabulary")}
                className={`px-3 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                  activeTab === "vocabulary"
                    ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container)]"
                }`}
              >
                Vocabulary ({detail?.vocabulary?.length || (isRussian ? (story.russian?.vocab_count || 0) : isJapanese ? (story.japanese?.vocab_count || 0) : story.mandarin.vocab_count)})
              </button>
            </div>

            {/* Reading Toggles */}
            {activeTab === "story" && (
              <div className="flex flex-wrap items-center gap-2">
                {isMandarin && (
                  <button
                    onClick={() => setIsTraditional(!isTraditional)}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer font-medium ${
                      isTraditional
                        ? "bg-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary)] shadow-xs"
                        : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                    }`}
                  >
                    {isTraditional ? "Traditional" : "Simplified"}
                  </button>
                )}

                {isJapanese && (
                  <button
                    onClick={() => setJapaneseReadingMode(japaneseReadingMode === "furigana" ? "romaji" : "furigana")}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer font-medium ${
                      japaneseReadingMode === "romaji"
                        ? "bg-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary)] shadow-xs"
                        : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                    }`}
                  >
                    {japaneseReadingMode === "romaji" ? "Romaji" : "Furigana"}
                  </button>
                )}

                <button
                  onClick={() => setShowReading(!showReading)}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer font-medium ${
                    showReading
                      ? "bg-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary)] shadow-xs"
                      : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                  }`}
                >
                  {isMandarin
                    ? showReading
                      ? "Pinyin On"
                      : "Pinyin Off"
                    : isJapanese
                    ? showReading
                      ? `${japaneseReadingMode === "romaji" ? "Romaji" : "Furigana"} On`
                      : "Reading Off"
                    : showReading
                    ? "Translit On"
                    : "Translit Off"}
                </button>

                <button
                  onClick={() => setIsSpaceOn(!isSpaceOn)}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer font-medium ${
                    isSpaceOn
                      ? "bg-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary)] shadow-xs"
                      : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                  }`}
                >
                  {isSpaceOn ? "Space On" : "Space Off"}
                </button>

                <button
                  onClick={() => setShowTranslation(!showTranslation)}
                  className={`px-3 py-1 rounded-full transition-all cursor-pointer font-medium ${
                    showTranslation
                      ? "bg-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary)] shadow-xs"
                      : "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                  }`}
                >
                  {showTranslation ? "Translation On" : "Translation Off"}
                </button>

                {/* Font Size Selector */}
                <div className="flex items-center rounded-full bg-[var(--md-sys-color-surface-container-high)] p-0.5 overflow-hidden">
                  <button
                    onClick={() => setFontSize("normal")}
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full transition-colors ${
                      fontSize === "normal"
                        ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs"
                        : "text-[var(--md-sys-color-on-surface-variant)]"
                    }`}
                    title="Normal font size"
                  >
                    A
                  </button>
                  <button
                    onClick={() => setFontSize("large")}
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full transition-colors ${
                      fontSize === "large"
                        ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs"
                        : "text-[var(--md-sys-color-on-surface-variant)]"
                    }`}
                    title="Large font size"
                  >
                    A+
                  </button>
                  <button
                    onClick={() => setFontSize("xlarge")}
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full transition-colors ${
                      fontSize === "xlarge"
                        ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-2xs"
                        : "text-[var(--md-sys-color-on-surface-variant)]"
                    }`}
                    title="Extra large font size"
                  >
                    A++
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Reader Body */}
        <div
          className="flex-1 overflow-y-auto p-4 sm:p-6 sm:p-8 safe-bottom"
          onScroll={() => closeTooltip()}
        >
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-[var(--md-sys-color-on-surface-variant)]">
              <div className="w-8 h-8 border-2 border-[var(--md-sys-color-primary)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Loading authentic reading text &amp; vocabulary...</p>
            </div>
          ) : activeTab === "story" ? (
            <div
              className={`${isRussian ? 'font-montserrat' : 'font-cjk'} ${fontSizeClass} text-[var(--md-sys-color-on-surface)] space-y-8 select-text ${
                !showReading ? "hide-readings pinyin-off" : ""
              } ${!isSpaceOn ? "space-off" : ""} ${isTraditional ? "traditional" : ""}`}
              onClick={(e) => handleWordInteraction(e, detail?.vocabulary || [])}
              onMouseOver={(e) => {
                if (typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
                  handleWordInteraction(e, detail?.vocabulary || []);
                }
              }}
              onMouseOut={(e) => {
                if (typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
                  if ((e.target as HTMLElement).closest("ruby")) {
                    closeTooltip();
                  }
                }
              }}
            >
              {renderedParagraphs.map((para, idx) => (
                <div key={idx} className="space-y-3">
                  <div
                    className="text-[var(--md-sys-color-on-surface)] font-medium tracking-wide leading-loose cursor-pointer touch-manipulation"
                    dangerouslySetInnerHTML={{ __html: para }}
                  />
                  {showTranslation && detail?.english_paragraphs?.[idx] && (
                    <div className="p-3 sm:p-3.5 bg-[var(--md-sys-color-surface-container)] rounded-xl border border-[var(--md-sys-color-outline-variant)]/40 text-xs sm:text-sm text-[var(--md-sys-color-on-surface-variant)] font-roboto leading-relaxed">
                      {detail.english_paragraphs[idx]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Vocabulary View: Responsive Card List on Mobile, Table on Tablet/Desktop
            <div>
              {/* Mobile View (< sm): Touch-Friendly Cards */}
              <div className="sm:hidden space-y-2.5">
                {(detail?.vocabulary || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-[var(--md-sys-color-surface-container-low)] border border-[var(--md-sys-color-outline-variant)]/40 flex flex-col gap-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className={`font-bold text-lg text-[var(--md-sys-color-on-surface)] ${isRussian ? 'font-montserrat' : 'font-cjk'}`}>
                          {item.word || (item as any).word_simplified || "—"}
                        </span>
                        {isMandarin && (item as any).word_traditional && (item as any).word_traditional !== item.word && (
                          <span className="font-cjk text-xs text-[var(--md-sys-color-on-surface-variant)]">
                            ({(item as any).word_traditional})
                          </span>
                        )}
                        <span className="font-mono text-xs font-semibold text-[var(--md-sys-color-primary)]">
                          {isJapanese && japaneseReadingMode === "romaji"
                            ? kanaToRomaji(item.pinyin || item.reading || item.word, item.translation, item.word)
                            : item.pinyin || item.reading || "—"}
                        </span>
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shrink-0">
                        {isRussian
                          ? (item.torfl ? `ТРКИ ${item.torfl}` : item.hsk ? `ТРКИ ${item.hsk}` : "—")
                          : isJapanese
                          ? (item.jlpt ? `JLPT ${item.jlpt}` : "—")
                          : (item.hsk || "—")}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] leading-relaxed">
                      {item.translation}
                    </p>
                  </div>
                ))}
              </div>

              {/* Tablet & Desktop View (sm+): Semantic Table */}
              <div className="hidden sm:block overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--md-sys-color-outline-variant)] text-xs uppercase tracking-wider text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                      <th className="py-3 px-4 font-semibold">{isMandarin ? "Simplified" : isJapanese ? "Word" : "Cyrillic Word"}</th>
                      {isMandarin && <th className="py-3 px-4 font-semibold">Traditional</th>}
                      <th className="py-3 px-4 font-semibold">{isMandarin ? "Pinyin" : isJapanese ? "Reading" : "Transliteration"}</th>
                      <th className="py-3 px-4 font-semibold">English Meaning</th>
                      <th className="py-3 px-4 font-semibold">Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40 font-roboto">
                    {(detail?.vocabulary || []).map((item, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-[var(--md-sys-color-surface-container)] transition-colors"
                      >
                        <td className={`py-3 px-4 font-semibold text-base text-[var(--md-sys-color-on-surface)] ${isRussian ? 'font-montserrat' : 'font-cjk'}`}>
                          {item.word || (item as any).word_simplified || "—"}
                        </td>
                        {isMandarin && (
                          <td className="py-3 px-4 font-cjk font-semibold text-base text-[var(--md-sys-color-on-surface)]">
                            {(item as any).word_traditional || item.word || "—"}
                          </td>
                        )}
                        <td className="py-3 px-4 font-mono text-xs text-[var(--md-sys-color-primary)] font-semibold">
                          {isJapanese && japaneseReadingMode === "romaji"
                            ? kanaToRomaji(item.pinyin || item.reading || item.word, item.translation, item.word)
                            : item.pinyin || item.reading || "—"}
                        </td>
                        <td className="py-3 px-4 text-xs sm:text-sm text-[var(--md-sys-color-on-surface-variant)]">
                          {item.translation}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)]">
                            {isRussian
                              ? (item.torfl ? `ТРКИ ${item.torfl}` : item.hsk ? `ТРКИ ${item.hsk}` : "—")
                              : isJapanese
                              ? (item.jlpt ? `JLPT ${item.jlpt}` : "—")
                              : (item.hsk || "—")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Floating Vocabulary Tooltip with Guaranteed On-Screen Clamping & Indicator Arrow */}
        {tooltip.visible && (
          <div
            className={`fixed z-50 px-3.5 py-2.5 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)] rounded-2xl shadow-2xl text-xs pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-150 ${
              tooltip.placement === "top" ? "-translate-y-full" : ""
            }`}
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              width: `${tooltip.width}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Directional Pointing Arrow */}
            <div
              className={`absolute w-3 h-3 bg-[var(--md-sys-color-surface-container-highest)] border-[var(--md-sys-color-outline-variant)] rotate-45 pointer-events-none ${
                tooltip.placement === "top"
                  ? "-bottom-1.5 border-r border-b"
                  : "-top-1.5 border-l border-t"
              }`}
              style={{ left: `${tooltip.arrowX - 6}px` }}
            />

            {/* Header: Pronunciation, Level Badge, and Close Button */}
            <div className="flex items-center justify-between gap-2 relative z-10">
              <span className="font-mono font-bold text-[var(--md-sys-color-primary)] text-sm tracking-tight truncate">
                {tooltip.pinyin}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {tooltip.level && (
                  <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] font-semibold text-[10px]">
                    {isRussian && !tooltip.level.startsWith("ТРКИ")
                      ? `ТРКИ ${tooltip.level}`
                      : tooltip.level}
                  </span>
                )}
                <button
                  type="button"
                  onClick={closeTooltip}
                  className="w-5 h-5 -mr-1 rounded-full flex items-center justify-center text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container)] cursor-pointer"
                  aria-label="Close word details"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Character / Word Reading */}
            {tooltip.reading && tooltip.reading !== tooltip.pinyin && (
              <div className={`font-semibold text-xs text-[var(--md-sys-color-on-surface)] mt-0.5 relative z-10 ${isRussian ? 'font-montserrat' : 'font-cjk'}`}>
                {tooltip.reading}
              </div>
            )}

            {/* English Definition */}
            <div className="mt-1 text-[var(--md-sys-color-on-surface-variant)] leading-snug font-roboto text-[11px] sm:text-xs relative z-10">
              {tooltip.translation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
