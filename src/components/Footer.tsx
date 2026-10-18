import React from "react";
import Link from "next/link";
import { BookOpen, Headphones, Languages, Sparkles } from "lucide-react";

const FOOTER_LINKS = [
  { text: "About", href: "/about/" },
  { text: "Blog", href: "/category/blog/" },
  { text: "New HSK Vocabulary", href: "/new-hsk-vocabulary/" },
  { text: "Help & FAQ", href: "/help/" },
  { text: "Privacy Policy", href: "/privacy-policy/" },
  { text: "Terms of Use", href: "/terms-of-use/" },
];

export default function Footer() {
  return (
    <footer className="bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] border-t border-[var(--md-sys-color-outline-variant)]/60 pt-14 pb-12 px-4 sm:px-6 mt-20 transition-colors duration-200">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-10">
        {/* Top Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-montserrat font-bold text-lg text-[var(--md-sys-color-primary)]">
                Polyglot Reader
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
                v2.0
              </span>
            </div>
            <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] leading-relaxed max-w-sm">
              The premier graded reading and listening platform for East Asian language learners. 206 parallel stories across Mandarin Chinese (HSK 1–6) and Japanese (JLPT N5–N1).
            </p>
            <div className="flex items-center gap-4 text-xs text-[var(--md-sys-color-on-surface-variant)] pt-2">
              <div className="flex items-center gap-1.5">
                <kbd className="px-2 py-1 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded text-[11px] font-mono">
                  Space
                </kbd>
                <span>Play / Pause</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-2 py-1 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded text-[11px] font-mono">
                  ESC
                </kbd>
                <span>Close Reader</span>
              </div>
            </div>
          </div>

          {/* Mandarin Track Column */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--md-sys-color-primary)]">
              🇨🇳 Mandarin Track
            </h4>
            <ul className="space-y-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
              <li>
                <Link href="#" className="hover:text-[var(--md-sys-color-primary)] transition-colors">
                  HSK 1–2 Beginner Stories
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--md-sys-color-primary)] transition-colors">
                  HSK 3–4 Intermediate Dialogs
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--md-sys-color-primary)] transition-colors">
                  HSK 5–6 Advanced Articles
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--md-sys-color-primary)] transition-colors">
                  Simplified &amp; Traditional Switcher
                </Link>
              </li>
            </ul>
          </div>

          {/* Japanese Track Column */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--md-sys-color-primary)]">
              🇯🇵 Japanese Track
            </h4>
            <ul className="space-y-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
              <li>
                <Link href="#" className="hover:text-[var(--md-sys-color-primary)] transition-colors">
                  JLPT N5–N4 Graded Readers
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--md-sys-color-primary)] transition-colors">
                  JLPT N3 Intermediate Narratives
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--md-sys-color-primary)] transition-colors">
                  JLPT N2–N1 Authentic Readings
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-[var(--md-sys-color-primary)] transition-colors">
                  Interactive Furigana Annotations
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-[1px] bg-[var(--md-sys-color-outline-variant)]/60" />

        {/* Bottom Legal & Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--md-sys-color-on-surface-variant)]">
          <nav className="flex flex-wrap justify-center sm:justify-start gap-4">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.text}
                href={link.href}
                className="hover:text-[var(--md-sys-color-primary)] transition-colors"
              >
                {link.text}
              </Link>
            ))}
          </nav>

          <p className="font-roboto">
            &copy; {new Date().getFullYear()} Polyglot Reader. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
