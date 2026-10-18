"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import LessonGrid from "@/components/LessonGrid";
import Footer from "@/components/Footer";
import allStoriesData from "@/data/all_stories.json";
import { StoryCatalogItem } from "@/types";

export default function HomePage() {
  const stories = allStoriesData as StoryCatalogItem[];
  const [currentLanguage, setCurrentLanguage] = useState<"mandarin" | "japanese">("mandarin");

  return (
    <div className="flex flex-col min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] transition-colors duration-200">
      <Header
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
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
