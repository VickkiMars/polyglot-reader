"use client";

import React from "react";
import { Headphones, BookOpen } from "lucide-react";
import { StoryCatalogItem } from "@/types";

interface LessonCardProps {
  story: StoryCatalogItem;
  language: "mandarin" | "japanese";
  onSelect: (story: StoryCatalogItem) => void;
}

export default function LessonCard({ story, language, onSelect }: LessonCardProps) {
  const isMandarin = language === "mandarin";
  const displayTitle = isMandarin ? story.title : story.japanese.title || story.title;
  const secondaryTitle = isMandarin ? story.mandarin.character_preview : story.title;
  const previewReading = isMandarin
    ? story.mandarin.pinyin_preview
    : story.japanese.reading_preview;
  const vocabCount = isMandarin ? story.mandarin.vocab_count : story.japanese.vocab_count;
  const levelBadge = isMandarin ? story.hsk : `JLPT ${story.jlpt}`;

  return (
    <article
      onClick={() => onSelect(story)}
      className="group bg-[var(--md-sys-color-surface-container-lowest)] rounded-2xl border border-[var(--md-sys-color-outline-variant)]/60 overflow-hidden transition-all duration-200 hover:border-[var(--md-sys-color-primary)]/60 hover:shadow-md hover:bg-[var(--md-sys-color-surface-container-low)] flex flex-col h-full cursor-pointer active:scale-[0.99]"
    >
      {/* Stylized Typographic CJK Banner */}
      <div
        className="relative w-full aspect-video min-h-[145px] sm:min-h-[175px] overflow-hidden bg-gradient-to-br from-[var(--md-sys-color-surface-container-high)] to-[var(--md-sys-color-surface-container-lowest)] flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none shrink-0"
      >
        {/* Subtle background seal watermarking */}
        <span className="absolute -right-4 -bottom-4 text-6xl sm:text-7xl font-cjk font-bold text-[var(--md-sys-color-primary)]/5 pointer-events-none">
          {isMandarin ? "汉语" : "日本語"}
        </span>
        <span className="text-lg sm:text-2xl font-cjk font-bold text-[var(--md-sys-color-on-surface)] tracking-wide line-clamp-1">
          {isMandarin ? story.mandarin.character_preview.slice(0, 8) : story.japanese.title}
        </span>
        <span className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1.5 font-roboto italic line-clamp-1">
          {story.title}
        </span>

        {/* Audio Narration Pill Badge */}
        <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-black/60 backdrop-blur-xs text-white px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-medium flex items-center gap-1.5 shadow-xs">
          <Headphones className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--md-sys-color-tertiary-container)]" />
          <span className="text-[10px] sm:text-[11px]">Audio</span>
        </div>

        {/* Level Tag (Top Left) */}
        <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3">
          <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] shadow-xs">
            {levelBadge}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 sm:p-5 flex flex-col flex-grow justify-between gap-3 sm:gap-4">
        <div>
          {/* Main Title */}
          <h3 className="font-montserrat font-semibold text-base sm:text-lg text-[var(--md-sys-color-on-surface)] group-hover:text-[var(--md-sys-color-primary)] transition-colors leading-snug line-clamp-1">
            {displayTitle}
          </h3>

          {/* CJK Character Preview */}
          <p className="mt-1 text-sm font-cjk text-[var(--md-sys-color-primary)] line-clamp-1 font-medium">
            {secondaryTitle}
          </p>

          {/* Phonetic / Reading Preview */}
          {previewReading && (
            <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)] line-clamp-1 italic font-roboto">
              {previewReading}
            </p>
          )}
        </div>

        {/* Card Footer: Metadata and Action Button */}
        <div className="pt-3 border-t border-[var(--md-sys-color-outline-variant)]/40 flex items-center justify-between text-xs text-[var(--md-sys-color-on-surface-variant)]">
          <div className="flex items-center gap-2">
            <span className="text-[var(--md-sys-color-on-surface-variant)] font-medium">
              {vocabCount} words
            </span>
            <span>•</span>
            <span className="text-[var(--md-sys-color-on-surface-variant)]">
              {story.level}
            </span>
          </div>

          {/* Read & Listen Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(story);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary)] hover:text-[var(--md-sys-color-on-primary)] transition-all cursor-pointer min-h-[36px]"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Read</span>
          </button>
        </div>
      </div>
    </article>
  );
}
