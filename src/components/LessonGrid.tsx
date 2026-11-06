"use client";

import React, { useState, useMemo } from "react";
import LessonCard from "./LessonCard";
import FilterBar from "./FilterBar";
import Pagination from "./Pagination";
import StoryReaderModal from "./StoryReaderModal";
import PlayReaderModal from "./PlayReaderModal";
import kamifusenPlayData from "@/data/plays/kamifusen.json";
import { StoryCatalogItem, FilterState, PlayMetadata } from "@/types";
import { Theater, Users, Play as PlayIcon, Sparkles, BookOpen } from "lucide-react";

interface LessonGridProps {
  initialStories: StoryCatalogItem[];
  language: "mandarin" | "japanese";
}

const ITEMS_PER_PAGE = 9;

export default function LessonGrid({ initialStories, language }: LessonGridProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    level: "all",
    language: language,
    selectedHsk: [],
    selectedJlpt: [],
    audioOnly: false,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStory, setSelectedStory] = useState<StoryCatalogItem | null>(null);
  const [isPlayModalOpen, setIsPlayModalOpen] = useState(false);
  const playData = kamifusenPlayData as unknown as PlayMetadata;

  // Sync language prop into filters
  React.useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      language,
      // Reset selected levels when switching language
      selectedHsk: [],
      selectedJlpt: [],
    }));
    setCurrentPage(1);
  }, [language]);

  // Compute counts for level tabs
  const levelCounts = useMemo(() => {
    return {
      all: initialStories.length,
      beginner: initialStories.filter((s) => s.level.toLowerCase() === "beginner").length,
      intermediate: initialStories.filter((s) => s.level.toLowerCase() === "intermediate").length,
      advanced: initialStories.filter((s) => s.level.toLowerCase() === "advanced").length,
    };
  }, [initialStories]);

  // Filter stories based on active filters
  const filteredStories = useMemo(() => {
    return initialStories.filter((story) => {
      // 1. Search Query
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchesTitle = story.title.toLowerCase().includes(query);
        const matchesJpTitle = story.japanese.title?.toLowerCase().includes(query);
        const matchesCjk = story.mandarin.character_preview.toLowerCase().includes(query);
        const matchesJpCjk = story.japanese.character_preview.toLowerCase().includes(query);
        const matchesTags = story.tags.some((t) => t.toLowerCase().includes(query));

        if (!matchesTitle && !matchesJpTitle && !matchesCjk && !matchesJpCjk && !matchesTags) {
          return false;
        }
      }

      // 2. Level Category (Beginner, Intermediate, Advanced)
      if (filters.level !== "all") {
        if (story.level.toLowerCase() !== filters.level.toLowerCase()) {
          return false;
        }
      }

      // 3. HSK Level Filter (for Mandarin)
      if (language === "mandarin" && filters.selectedHsk.length > 0) {
        const matchesHsk = filters.selectedHsk.some((hsk) =>
          story.hsk_tags.some((t) => t.toLowerCase().includes(hsk.toLowerCase()))
        );
        if (!matchesHsk) return false;
      }

      // 4. JLPT Level Filter (for Japanese)
      if (language === "japanese" && filters.selectedJlpt.length > 0) {
        const matchesJlpt = filters.selectedJlpt.some(
          (jlpt) => story.jlpt.toLowerCase() === jlpt.toLowerCase()
        );
        if (!matchesJlpt) return false;
      }

      // 5. Audio Only Filter
      if (filters.audioOnly) {
        const hasAudio =
          language === "mandarin" ? Boolean(story.audio.mandarin) : Boolean(story.audio.japanese);
        if (!hasAudio) return false;
      }

      return true;
    });
  }, [initialStories, filters, language]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredStories.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedStories = filteredStories.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleClearFilters = () => {
    setFilters({
      search: "",
      level: "all",
      language,
      selectedHsk: [],
      selectedJlpt: [],
      audioOnly: false,
    });
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 350, behavior: "smooth" });
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={(newFilters) => {
          setFilters(newFilters);
          setCurrentPage(1);
        }}
        onClear={handleClearFilters}
        counts={levelCounts}
      />

      {/* Featured Japanese Play Rehearsal Card (when Japanese track is active) */}
      {language === "japanese" && (
        <div className="mb-8 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-[var(--md-sys-color-surface-container-high)] via-[var(--md-sys-color-surface-container)] to-[var(--md-sys-color-surface-container-high)] border-2 border-[var(--md-sys-color-primary)]/30 shadow-md transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--md-sys-color-primary)]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 shadow-xs">
                  <Theater className="w-3.5 h-3.5" />
                  New: Theatrical Play Rehearsal
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                  JLPT N3–N2
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 text-xs font-semibold border border-indigo-500/30">
                  4 Scenes · 270 Chunks
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2">
                  <span>紙風船（一幕）</span>
                  <span className="text-base sm:text-lg font-normal text-[var(--md-sys-color-on-surface-variant)]">
                    — Paper Balloon by 岸田國士 (Kunio Kishida)
                  </span>
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[var(--md-sys-color-on-surface-variant)] leading-relaxed">
                  Immerse yourself in authentic modernist Japanese dialogue. Practice turn-by-turn with clamped audio chunks, shadow conversational pauses, or choose your character role (<strong className="text-[var(--md-sys-color-on-surface)]">夫 Husband</strong> or <strong className="text-[var(--md-sys-color-on-surface)]">妻 Wife</strong>) for interactive dialogue sparring.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-[var(--md-sys-color-on-surface-variant)] pt-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Users className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Dual-Character Neural Audio
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  100% Ruby Annotations & Stage English
                </span>
              </div>
            </div>

            <div className="shrink-0 w-full sm:w-auto">
              <button
                onClick={() => setIsPlayModalOpen(true)}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-bold text-sm shadow-md hover:bg-[var(--md-sys-color-primary)]/90 transition-all flex items-center justify-center gap-2 cursor-pointer scale-100 hover:scale-[1.02] active:scale-95"
              >
                <PlayIcon className="w-5 h-5 fill-current" />
                <span>Rehearse Play (戯曲を試みる)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 sm:mb-6">
        <span className="text-xs sm:text-sm font-medium text-[var(--md-sys-color-on-surface-variant)]">
          Showing {paginatedStories.length} of {filteredStories.length} graded stories
          {filters.level !== "all" && ` • ${filters.level}`}
          {language === "mandarin" ? " (Mandarin)" : " (Japanese)"}
        </span>
      </div>

      {/* Responsive Card Grid: 1 col on mobile, 2 on sm/md, 3 on lg+ */}
      {paginatedStories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {paginatedStories.map((story) => (
            <LessonCard
              key={story.id}
              story={story}
              language={language}
              onSelect={setSelectedStory}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 px-4 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)] rounded-2xl">
          <p className="text-lg font-medium text-[var(--md-sys-color-on-surface)]">
            No graded stories match your active criteria
          </p>
          <p className="mt-1 text-sm text-[var(--md-sys-color-on-surface-variant)] max-w-md mx-auto">
            Try adjusting your search terms, selecting a different proficiency level, or resetting filters.
          </p>
          <button
            onClick={handleClearFilters}
            className="mt-5 px-5 py-2.5 text-xs font-semibold text-[var(--md-sys-color-on-primary)] bg-[var(--md-sys-color-primary)] rounded-full hover:opacity-90 transition-all cursor-pointer shadow-xs"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Pagination Controls */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      {/* Interactive Story Reader Modal */}
      <StoryReaderModal
        story={selectedStory}
        language={language}
        onClose={() => setSelectedStory(null)}
      />

      {/* Interactive Theatrical Play Reader Modal */}
      <PlayReaderModal
        play={playData}
        isOpen={isPlayModalOpen}
        onClose={() => setIsPlayModalOpen(false)}
      />
    </div>
  );
}
