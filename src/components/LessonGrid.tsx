"use client";

import React, { useState, useMemo } from "react";
import LessonCard from "./LessonCard";
import FilterBar from "./FilterBar";
import Pagination from "./Pagination";
import StoryReaderModal from "./StoryReaderModal";
import { StoryCatalogItem, FilterState } from "@/types";

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
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
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

      {/* Results Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <span className="text-sm font-medium text-[var(--md-sys-color-on-surface-variant)]">
          Showing {paginatedStories.length} of {filteredStories.length} graded stories
          {filters.level !== "all" && ` • ${filters.level}`}
          {language === "mandarin" ? " (Mandarin)" : " (Japanese)"}
        </span>
      </div>

      {/* 3-Column Card Grid */}
      {paginatedStories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    </div>
  );
}
