"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X, Sun, Moon, BookOpen, Volume2, Sparkles } from "lucide-react";

interface HeaderProps {
  currentLanguage: "mandarin" | "japanese";
  onLanguageChange: (lang: "mandarin" | "japanese") => void;
}

export default function Header({ currentLanguage, onLanguageChange }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check saved theme or system preference
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

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

        {/* Center: MD3 Language Segmented Switcher */}
        <div className="flex items-center bg-[var(--md-sys-color-surface-container-high)] p-1 rounded-full border border-[var(--md-sys-color-outline-variant)]/40 shadow-xs">
          <button
            onClick={() => onLanguageChange("mandarin")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer min-h-[36px] ${
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
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer min-h-[36px] ${
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

        {/* Right Desktop Nav & Controls */}
        <div className="hidden lg:flex items-center gap-3">
          <nav className="flex items-center space-x-1 text-sm font-medium text-[var(--md-sys-color-on-surface-variant)]">
            <Link
              href="/"
              className="px-3 py-2 rounded-full hover:bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface)] transition-colors"
            >
              All Lessons
            </Link>
            <Link
              href="#grammar"
              className="px-3 py-2 rounded-full hover:bg-[var(--md-sys-color-surface-container)] transition-colors"
            >
              Grammar
            </Link>
            <Link
              href="#tests"
              className="px-3 py-2 rounded-full hover:bg-[var(--md-sys-color-surface-container)] transition-colors"
            >
              Test Prep
            </Link>
            <Link
              href="#pricing"
              className="px-3 py-2 rounded-full hover:bg-[var(--md-sys-color-surface-container)] transition-colors"
            >
              Pricing
            </Link>
          </nav>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container)] hover:text-[var(--md-sys-color-on-surface)] transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Login Pill Button */}
          <Link
            href="/login/"
            className="px-4 py-2 rounded-full border border-[var(--md-sys-color-outline)] text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary-container)] hover:text-[var(--md-sys-color-on-primary-container)] transition-all text-xs font-semibold min-h-[40px] flex items-center"
          >
            Sign In
          </Link>
        </div>

        {/* Mobile Actions */}
        <div className="flex items-center gap-1 lg:hidden">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container)] min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-full text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container)] min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-[var(--md-sys-color-surface-container-lowest)] border-t border-[var(--md-sys-color-outline-variant)] px-4 py-4 space-y-3 text-sm shadow-lg">
          <div className="flex flex-col gap-1 pb-3 border-b border-[var(--md-sys-color-outline-variant)]/60">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--md-sys-color-on-surface-variant)]">
              Language Track
            </span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={() => {
                  onLanguageChange("mandarin");
                  setMobileOpen(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold text-center border transition-all ${
                  currentLanguage === "mandarin"
                    ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-[var(--md-sys-color-primary)]"
                    : "border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)]"
                }`}
              >
                🇨🇳 Mandarin (HSK)
              </button>
              <button
                onClick={() => {
                  onLanguageChange("japanese");
                  setMobileOpen(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold text-center border transition-all ${
                  currentLanguage === "japanese"
                    ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-[var(--md-sys-color-primary)]"
                    : "border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface)]"
                }`}
              >
                🇯🇵 Japanese (JLPT)
              </button>
            </div>
          </div>
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-[var(--md-sys-color-on-surface)] font-medium"
          >
            All Lessons
          </Link>
          <Link
            href="#grammar"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-[var(--md-sys-color-on-surface-variant)]"
          >
            Grammar Points
          </Link>
          <Link
            href="#tests"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-[var(--md-sys-color-on-surface-variant)]"
          >
            Test Prep
          </Link>
          <Link
            href="#pricing"
            onClick={() => setMobileOpen(false)}
            className="block py-2 text-[var(--md-sys-color-on-surface-variant)]"
          >
            Pricing
          </Link>
          <Link
            href="/login/"
            onClick={() => setMobileOpen(false)}
            className="block text-center py-2.5 rounded-full border border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)] font-semibold text-xs"
          >
            Sign In
          </Link>
        </div>
      )}
    </header>
  );
}
