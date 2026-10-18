"use client";

import React from "react";
import { BookOpen, Headphones, Languages, GraduationCap } from "lucide-react";

interface HeroProps {
  currentLanguage: "mandarin" | "japanese";
  totalStories: number;
}

export default function Hero({ currentLanguage, totalStories }: HeroProps) {
  const isMandarin = currentLanguage === "mandarin";

  return (
    <section className="bg-[var(--md-sys-color-surface-container-low)] border-b border-[var(--md-sys-color-outline-variant)]/60 pt-10 pb-12 transition-colors duration-200">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="max-w-3xl">
          {/* Main Headline - No kicker or eyebrow per Impeccable Craft Floor */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-montserrat font-bold text-[var(--md-sys-color-on-surface)] tracking-tight leading-[1.15]">
            Master East Asian Languages Through Graded Reading &amp; Natural Audio
          </h1>

          {/* Subtitle / Value Proposition */}
          <p className="mt-4 text-base sm:text-lg text-[var(--md-sys-color-on-surface-variant)] leading-relaxed max-w-2xl font-roboto">
            Immerse yourself in {totalStories} graded stories across{" "}
            <span className="font-semibold text-[var(--md-sys-color-primary)]">
              {isMandarin ? "Mandarin Chinese (HSK 1–6)" : "Japanese (JLPT N5–N1)"}
            </span>
            . Complete with interactive word-level ruby annotations, instant hover glosses, and crystal-clear neural narration.
          </p>

          {/* Feature Metric Pills - 8dp Spacing System */}
          <div className="mt-6 flex flex-wrap gap-2.5 items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/40 text-xs font-medium text-[var(--md-sys-color-on-surface)] shadow-xs">
              <BookOpen className="w-3.5 h-3.5 text-[var(--md-sys-color-primary)]" />
              <span>{totalStories} Parallel Stories</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/40 text-xs font-medium text-[var(--md-sys-color-on-surface)] shadow-xs">
              <Headphones className="w-3.5 h-3.5 text-[var(--md-sys-color-tertiary)]" />
              <span>100% Neural Audio Readings</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/40 text-xs font-medium text-[var(--md-sys-color-on-surface)] shadow-xs">
              <Languages className="w-3.5 h-3.5 text-[var(--md-sys-color-secondary)]" />
              <span>{isMandarin ? "Simplified & Traditional" : "Full Furigana Annotations"}</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/40 text-xs font-medium text-[var(--md-sys-color-on-surface)] shadow-xs">
              <GraduationCap className="w-3.5 h-3.5 text-[var(--md-sys-color-primary)]" />
              <span>17,359 Lexical Tokens</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
