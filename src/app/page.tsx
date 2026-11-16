"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import AudioUpdateBanner from "@/components/AudioUpdateBanner";
import Hero from "@/components/Hero";
import LessonGrid from "@/components/LessonGrid";
import Footer from "@/components/Footer";
import allStoriesData from "@/data/all_stories.json";
import { StoryCatalogItem, Language } from "@/types";

export default function HomePage() {
  const stories = allStoriesData as StoryCatalogItem[];
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("polyglot_preferred_lang") as Language;
      if (saved === "mandarin" || saved === "japanese" || saved === "russian") {
        return saved;
      }
    }
    return "mandarin";
  });
  const [externalOpenModal, setExternalOpenModal] = useState(false);
  const [targetModalLang, setTargetModalLang] = useState<Language>("japanese");

  const handleLanguageChange = (lang: Language) => {
    setCurrentLanguage(lang);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("polyglot_preferred_lang", lang);
      } catch {}
    }
  };

  const handleOpenUpdateModal = (lang: Language) => {
    setTargetModalLang(lang);
    setExternalOpenModal(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] transition-colors duration-200">
      <Header
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        externalOpenModal={externalOpenModal}
        onExternalModalHandled={() => setExternalOpenModal(false)}
        targetModalLang={targetModalLang}
      />
      <AudioUpdateBanner
        currentLanguage={currentLanguage}
        onOpenUpdateModal={handleOpenUpdateModal}
      />
      <Hero
        currentLanguage={currentLanguage}
        totalStories={stories.length}
      />
      <main className="flex-grow">
        <LessonGrid
          initialStories={stories}
          language={currentLanguage}
        />
      </main>
      <Footer />
    </div>
  );
}
