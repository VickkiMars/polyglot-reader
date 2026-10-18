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
    <section className="bg-[var(--md-sys-color-surface-container-low)] border-b border-[var(--md-sys-color-outline-variant)]/60 pt-6 pb-8 sm:pt-10 sm:pb-12 transition-colors duration-200">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        <div className="max-w-3xl">
          {/* Main Headline */}
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-montserrat font-bold text-[var(--md-sys-color-on-surface)] tracking-tight leading-[1.2]">
            Master East Asian Languages Through Graded Reading &amp; Natural Audio
          </h1>

          {/* Subtitle / Value Proposition */}
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-[var(--md-sys-color-on-surface-variant)] leading-relaxed max-w-2xl font-roboto">
            Immerse yourself in {totalStories} graded stories across{" "}
            <span className="font-semibold text-[var(--md-sys-color-primary)]">
              {isMandarin ? "Mandarin Chinese (HSK 1–6)" : "Japanese (JLPT N5–N1)"}
            </span>
            . Complete with interactive word-level ruby annotations, instant hover glosses, and crystal-clear neural narration.
          </p>

          {/* Feature Metric Pills - Responsive 2x2 grid on mobile, flex-wrap on desktop */}
          <div className="mt-5 sm:mt-6 grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-2.5 items-center">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/40 text-[11px] sm:text-xs font-medium text-[var(--md-sys-color-on-surface)] shadow-xs">
              <BookOpen className="w-3.5 h-3.5 text-[var(--md-sys-color-primary)] shrink-0" />
              <span>{totalStories} <span className="hidden sm:inline">Parallel </span>Stories</span>
            </div>

            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/40 text-[11px] sm:text-xs font-medium text-[var(--md-sys-color-on-surface)] shadow-xs">
              <Headphones className="w-3.5 h-3.5 text-[var(--md-sys-color-tertiary)] shrink-0" />
              <span><span className="hidden sm:inline">100% </span>Neural Audio</span>
            </div>

            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/40 text-[11px] sm:text-xs font-medium text-[var(--md-sys-color-on-surface)] shadow-xs">
              <Languages className="w-3.5 h-3.5 text-[var(--md-sys-color-secondary)] shrink-0" />
              <span>{isMandarin ? "Dual Scripts" : "Furigana Ruby"}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-[var(--md-sys-color-surface-container-high)] border border-[var(--md-sys-color-outline-variant)]/40 text-[11px] sm:text-xs font-medium text-[var(--md-sys-color-on-surface)] shadow-xs">
              <GraduationCap className="w-3.5 h-3.5 text-[var(--md-sys-color-primary)] shrink-0" />
              <span>17k <span className="hidden sm:inline">Lexical </span>Tokens</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
