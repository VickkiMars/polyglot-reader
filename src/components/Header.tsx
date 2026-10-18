"use client";

import React from "react";
import Link from "next/link";

interface HeaderProps {
  currentLanguage: "mandarin" | "japanese";
  onLanguageChange: (lang: "mandarin" | "japanese") => void;
}

export default function Header({ currentLanguage, onLanguageChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-[var(--md-sys-color-surface-container-lowest)] border-b border-[var(--md-sys-color-outline-variant)]/60 transition-colors duration-200">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-4">
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
            <span>Mandarin (HSK)</span>
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
            <span>Japanese (JLPT)</span>
          </button>
        </div>
      </div>
    </header>
  );
}
