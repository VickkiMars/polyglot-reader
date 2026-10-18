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
  Sparkles,
  ExternalLink,
  ChevronDown,
  Check,
} from "lucide-react";
import { StoryCatalogItem, StoryDetail, VocabularyItem } from "@/types";

interface StoryReaderModalProps {
  story: StoryCatalogItem | null;
  language: "mandarin" | "japanese";
  onClose: () => void;
}

export default function StoryReaderModal({
  story,
  language,
  onClose,
}: StoryReaderModalProps) {
  const [detail, setDetail] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // Reader settings
  const [showReading, setShowReading] = useState(true); // Pinyin / Furigana
  const [isTraditional, setIsTraditional] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [activeTab, setActiveTab] = useState<"story" | "vocabulary">("story");
  const [fontSize, setFontSize] = useState<"normal" | "large" | "xlarge">("large");

  // Word Tooltip state
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    pinyin: string;
    reading: string;
    translation: string;
    level: string;
    visible: boolean;
  }>({
    x: 0,
    y: 0,
    pinyin: "",
    reading: "",
    translation: "",
    level: "",
    visible: false,
  });

  // Fetch full story details
  useEffect(() => {
    if (!story) return;

    setLoading(true);
    fetch(`/api/stories/${story.id}?lang=${language}`)
      .then((res) => res.json())
      .then((data: StoryDetail) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load story detail:", err);
        setLoading(false);
      });
  }, [story, language]);

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
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
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

  // Tooltip interaction for vocabulary in the text
  const handleWordInteraction = (
    e: React.MouseEvent<HTMLElement>,
    vocabList: VocabularyItem[]
  ) => {
    const target = e.target as HTMLElement;
    const ruby = target.closest("ruby");
    const clickedWord = ruby ? ruby.textContent?.trim() || "" : target.textContent?.trim() || "";

    if (!clickedWord) return;

    // Search in vocab list
    const found = vocabList.find(
      (v) =>
        clickedWord.includes(v.word) ||
        v.word.includes(clickedWord) ||
        (v.pinyin && clickedWord.includes(v.pinyin))
    );

    if (found) {
      const rect = (ruby || target).getBoundingClientRect();
      setTooltip({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        pinyin: found.pinyin || found.reading || "",
        reading: found.word,
        translation: found.translation,
        level: found.hsk || (found.jlpt ? `JLPT ${found.jlpt}` : ""),
        visible: true,
      });
    }
  };

  const closeTooltip = () => {
    if (tooltip.visible) {
      setTooltip((prev) => ({ ...prev, visible: false }));
    }
  };

  if (!story) return null;

  const isMandarin = language === "mandarin";
  const audioSrc = isMandarin ? story.audio.mandarin : story.audio.japanese;

  // Font size class mapping
  const fontSizeClass =
    fontSize === "normal"
      ? "text-lg leading-[2.2]"
      : fontSize === "large"
      ? "text-xl sm:text-2xl leading-[2.4]"
      : "text-2xl sm:text-3xl leading-[2.6]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="bg-[var(--md-sys-color-surface-container-lowest)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-all duration-200"
        onClick={(e) => {
          e.stopPropagation();
          closeTooltip();
        }}
      >
        {/* Modal Top App Bar */}
        <div className="px-5 py-4 bg-[var(--md-sys-color-surface-container-low)] border-b border-[var(--md-sys-color-outline-variant)]/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shrink-0">
              {isMandarin ? story.hsk : `JLPT ${story.jlpt}`}
            </span>
            <div className="min-w-0">
              <h2 className="font-montserrat font-bold text-base sm:text-lg text-[var(--md-sys-color-on-surface)] truncate">
                {isMandarin ? story.title : story.japanese.title || story.title}
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
        <div className="px-5 py-3 bg-[var(--md-sys-color-surface-container)] border-b border-[var(--md-sys-color-outline-variant)]/40 flex flex-wrap items-center justify-between gap-3">
          <audio
            ref={audioRef}
            src={audioSrc}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            preload="metadata"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center hover:opacity-90 shadow-xs cursor-pointer transition-transform active:scale-95"
              aria-label={isPlaying ? "Pause audio" : "Play audio"}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <div className="text-xs font-mono text-[var(--md-sys-color-on-surface-variant)]">
              <span>{formatTime(currentTime)}</span>
              <span> / </span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Progress Slider */}
          <div className="flex-1 min-w-[160px] max-w-md mx-2">
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

          {/* Speed Controls */}
          <div className="flex items-center gap-1 bg-[var(--md-sys-color-surface-container-lowest)] p-0.5 rounded-full border border-[var(--md-sys-color-outline-variant)]/60">
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

        {/* Reader Action Ribbon & Toggle Controls */}
        <div className="px-5 py-2.5 bg-[var(--md-sys-color-surface-container-low)] border-b border-[var(--md-sys-color-outline-variant)]/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Tabs: Story Text vs Vocabulary List */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("story")}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                activeTab === "story"
                  ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]"
                  : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container)]"
              }`}
            >
              Story Reading
            </button>
            <button
              onClick={() => setActiveTab("vocabulary")}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                activeTab === "vocabulary"
                  ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]"
                  : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container)]"
              }`}
            >
              Vocabulary ({detail?.vocabulary?.length || story.mandarin.vocab_count})
            </button>
          </div>

          {/* Reading Toggles */}
          {activeTab === "story" && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Readings toggle (Pinyin/Furigana) */}
              <button
                onClick={() => setShowReading(!showReading)}
                className={`px-3 py-1 rounded-full border transition-all cursor-pointer font-medium ${
                  showReading
                    ? "bg-[var(--md-sys-color-surface-container-highest)] border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]"
                    : "bg-[var(--md-sys-color-surface-container-lowest)] border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)]"
                }`}
              >
                {isMandarin
                  ? showReading
                    ? "Pinyin On"
                    : "Pinyin Off"
                  : showReading
                  ? "Furigana On"
                  : "Furigana Off"}
              </button>

              {/* Mandarin: Simplified / Traditional toggle */}
              {isMandarin && (
                <button
                  onClick={() => setIsTraditional(!isTraditional)}
                  className="px-3 py-1 rounded-full border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] transition-all cursor-pointer font-medium"
                >
                  {isTraditional ? "Traditional" : "Simplified"}
                </button>
              )}

              {/* Translation Toggle */}
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className={`px-3 py-1 rounded-full border transition-all cursor-pointer font-medium ${
                  showTranslation
                    ? "bg-[var(--md-sys-color-surface-container-highest)] border-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-tertiary)]"
                    : "bg-[var(--md-sys-color-surface-container-lowest)] border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)]"
                }`}
              >
                {showTranslation ? "Translation On" : "Translation Off"}
              </button>

              {/* Font Size Selector */}
              <div className="flex items-center border border-[var(--md-sys-color-outline-variant)] rounded-full bg-[var(--md-sys-color-surface-container-lowest)] overflow-hidden">
                <button
                  onClick={() => setFontSize("normal")}
                  className={`px-2 py-0.5 text-xs font-semibold ${
                    fontSize === "normal"
                      ? "bg-[var(--md-sys-color-primary)] text-white"
                      : "text-[var(--md-sys-color-on-surface-variant)]"
                  }`}
                  title="Normal font size"
                >
                  A
                </button>
                <button
                  onClick={() => setFontSize("large")}
                  className={`px-2 py-0.5 text-xs font-semibold ${
                    fontSize === "large"
                      ? "bg-[var(--md-sys-color-primary)] text-white"
                      : "text-[var(--md-sys-color-on-surface-variant)]"
                  }`}
                  title="Large font size"
                >
                  A+
                </button>
                <button
                  onClick={() => setFontSize("xlarge")}
                  className={`px-2 py-0.5 text-xs font-semibold ${
                    fontSize === "xlarge"
                      ? "bg-[var(--md-sys-color-primary)] text-white"
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

        {/* Scrollable Reader Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-[var(--md-sys-color-on-surface-variant)]">
              <div className="w-8 h-8 border-2 border-[var(--md-sys-color-primary)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Loading authentic reading text &amp; vocabulary...</p>
            </div>
          ) : activeTab === "story" ? (
            <div
              className={`font-cjk ${fontSizeClass} text-[var(--md-sys-color-on-surface)] space-y-8 ${
                !showReading ? "hide-readings" : ""
              }`}
              onMouseUp={(e) => handleWordInteraction(e, detail?.vocabulary || [])}
            >
              {isMandarin ? (
                // Mandarin Paragraphs
                ((isTraditional
                  ? detail?.traditional_paragraphs
                  : detail?.simplified_paragraphs) || []
                ).map((para, idx) => (
                  <div key={idx} className="space-y-3">
                    <p className="text-[var(--md-sys-color-on-surface)] font-medium tracking-wide">
                      {para}
                    </p>
                    {showReading && detail?.pinyin_paragraphs?.[idx] && (
                      <p className="text-xs sm:text-sm text-[var(--md-sys-color-primary)]/80 italic font-roboto tracking-wider leading-relaxed">
                        {detail.pinyin_paragraphs[idx]}
                      </p>
                    )}
                    {showTranslation && detail?.english_paragraphs?.[idx] && (
                      <div className="p-3.5 bg-[var(--md-sys-color-surface-container)] rounded-xl border-l-2 border-[var(--md-sys-color-tertiary)] text-xs sm:text-sm text-[var(--md-sys-color-on-surface-variant)] font-roboto leading-relaxed">
                        {detail.english_paragraphs[idx]}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                // Japanese Paragraphs with Ruby furigana HTML
                (detail?.ruby_paragraphs || detail?.japanese_paragraphs || []).map(
                  (para, idx) => (
                    <div key={idx} className="space-y-3">
                      <div
                        className="text-[var(--md-sys-color-on-surface)] font-medium tracking-wide"
                        dangerouslySetInnerHTML={{ __html: para }}
                      />
                      {showTranslation && detail?.english_paragraphs?.[idx] && (
                        <div className="p-3.5 bg-[var(--md-sys-color-surface-container)] rounded-xl border-l-2 border-[var(--md-sys-color-tertiary)] text-xs sm:text-sm text-[var(--md-sys-color-on-surface-variant)] font-roboto leading-relaxed">
                          {detail.english_paragraphs[idx]}
                        </div>
                      )}
                    </div>
                  )
                )
              )}
            </div>
          ) : (
            // Vocabulary Table View
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--md-sys-color-outline-variant)] text-xs uppercase tracking-wider text-[var(--md-sys-color-on-surface-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                    <th className="py-3 px-4 font-semibold">Word / Character</th>
                    <th className="py-3 px-4 font-semibold">Pronunciation</th>
                    <th className="py-3 px-4 font-semibold">English Meaning</th>
                    <th className="py-3 px-4 font-semibold">Proficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--md-sys-color-outline-variant)]/40 font-roboto">
                  {(detail?.vocabulary || []).map((item, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-[var(--md-sys-color-surface-container)] transition-colors"
                    >
                      <td className="py-3 px-4 font-cjk font-semibold text-base text-[var(--md-sys-color-on-surface)]">
                        {item.word}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[var(--md-sys-color-primary)]">
                        {item.pinyin || item.reading || "—"}
                      </td>
                      <td className="py-3 px-4 text-xs sm:text-sm text-[var(--md-sys-color-on-surface-variant)]">
                        {item.translation}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)]">
                          {item.hsk || (item.jlpt ? `JLPT ${item.jlpt}` : "—")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Floating Vocabulary Tooltip */}
        {tooltip.visible && (
          <div
            className="fixed z-50 -translate-x-1/2 -translate-y-full px-3.5 py-2.5 bg-[var(--md-sys-color-surface-container-highest)] border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)] rounded-xl shadow-xl max-w-xs text-xs pointer-events-none"
            style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
          >
            <div className="font-mono font-bold text-[var(--md-sys-color-primary)] text-sm">
              {tooltip.pinyin}
            </div>
            <div className="mt-1 text-[var(--md-sys-color-on-surface-variant)] leading-snug">
              {tooltip.translation}
            </div>
            {tooltip.level && (
              <div className="mt-1.5 inline-block px-2 py-0.5 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] font-semibold text-[10px]">
                {tooltip.level}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
