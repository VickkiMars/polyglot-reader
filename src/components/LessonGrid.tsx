"use client";

import React, { useState, useMemo } from "react";
import LessonCard from "./LessonCard";
import FilterBar from "./FilterBar";
import Pagination from "./Pagination";
import StoryReaderModal from "./StoryReaderModal";
import PlayReaderModal from "./PlayReaderModal";
import playsCatalogData from "@/data/plays/plays_catalog.json";
import kamifusenData from "@/data/plays/kamifusen.json";
import itsutakaData from "@/data/plays/itsutaka.json";
import highwayData from "@/data/plays/highway.json";
import lionData from "@/data/plays/lion.json";
import hansuuData from "@/data/plays/hansuu.json";
import nemurenaiData from "@/data/plays/nemurenai.json";
import { StoryCatalogItem, FilterState, PlayMetadata, PlayCatalogItem } from "@/types";
import { Theater, Users, Play as PlayIcon, Sparkles, BookOpen, Layers, Clock } from "lucide-react";

interface LessonGridProps {
  initialStories: StoryCatalogItem[];
  language: "mandarin" | "japanese";
}

const ITEMS_PER_PAGE = 9;

const PLAYS_MAP: Record<string, PlayMetadata> = {
  kamifusen: kamifusenData as unknown as PlayMetadata,
  itsutaka: itsutakaData as unknown as PlayMetadata,
  highway: highwayData as unknown as PlayMetadata,
  lion: lionData as unknown as PlayMetadata,
  hansuu: hansuuData as unknown as PlayMetadata,
  nemurenai: nemurenaiData as unknown as PlayMetadata,
};

const playsCatalog = playsCatalogData as unknown as PlayCatalogItem[];

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
  const [activePlayId, setActivePlayId] = useState<string>("kamifusen");
  const [isPlayModalOpen, setIsPlayModalOpen] = useState(false);

  const activePlay = PLAYS_MAP[activePlayId] || PLAYS_MAP["kamifusen"];

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

      {/* Featured Japanese Plays Rehearsal Showcase (when Japanese track is active) */}
      {language === "japanese" && (
        <div className="mb-8 space-y-4">
          {/* Main Featured Play Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-[var(--md-sys-color-surface-container-high)] via-[var(--md-sys-color-surface-container)] to-[var(--md-sys-color-surface-container-high)] border-2 border-[var(--md-sys-color-primary)]/30 shadow-md transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--md-sys-color-primary)]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 shadow-xs">
                    <Theater className="w-3.5 h-3.5" />
                    Theatrical Play Rehearsal (戯曲の稽古)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] text-xs font-semibold border border-[var(--md-sys-color-primary)]/30">
                    JLPT {activePlay.jlpt_level}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] text-xs font-semibold border border-[var(--md-sys-color-outline-variant)]/60">
                    {activePlay.total_scenes} Scenes · {activePlay.total_lines} Chunks
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)] text-xs font-semibold border border-[var(--md-sys-color-outline-variant)]/60">
                    {activePlay.characters.length} Roles Cast
                  </span>
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-2 flex-wrap">
                    <span>{activePlay.title_ja}</span>
                    <span className="text-base sm:text-lg font-normal text-[var(--md-sys-color-on-surface-variant)]">
                      — {activePlay.title_en} by {activePlay.author_ja} ({activePlay.author_en})
                    </span>
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--md-sys-color-on-surface-variant)] leading-relaxed">
                    {activePlay.synopsis_en}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--md-sys-color-on-surface-variant)] pt-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Users className="w-4 h-4 text-[var(--md-sys-color-primary)]" />
                    Multi-Cast Neural Audio ({activePlay.characters.map((c) => c.name_ja).join(" · ")})
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-4 h-4 text-[var(--md-sys-color-primary)]" />
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
                  <span>Rehearse Scene ({activePlay.title_ja.slice(0, 8)}...)</span>
                </button>
              </div>
            </div>
          </div>

          {/* All 6 Plays Quick-Selector Shelf */}
          <div className="bg-[var(--md-sys-color-surface-container)] rounded-2xl p-3 border border-[var(--md-sys-color-outline-variant)]/60">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-[var(--md-sys-color-on-surface)] flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-[var(--md-sys-color-primary)]" />
                Select Play to Rehearse (全6作品):
              </span>
              <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                6 Modern & Contemporary Japanese Scripts
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {playsCatalog.map((p) => {
                const isSelected = p.id === activePlayId;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActivePlayId(p.id);
                      setIsPlayModalOpen(true);
                    }}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-[var(--md-sys-color-primary-container)] border-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary-container)] shadow-xs"
                        : "bg-[var(--md-sys-color-surface)] border-[var(--md-sys-color-outline-variant)]/50 hover:border-[var(--md-sys-color-primary)]/50 hover:bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
                          {p.jlpt_level}
                        </span>
                        <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">
                          {p.scene_count}場
                        </span>
                      </div>
                      <div className="font-bold text-xs line-clamp-1" title={p.title_ja}>
                        {p.title_ja}
                      </div>
                      <div className="text-[10px] text-[var(--md-sys-color-on-surface-variant)] line-clamp-1">
                        {p.title_en}
                      </div>
                    </div>
                    <div className="mt-2 pt-1 border-t border-[var(--md-sys-color-outline-variant)]/30 text-[10px] text-[var(--md-sys-color-on-surface-variant)] truncate">
                      {p.author_ja}
                    </div>
                  </button>
                );
              })}
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
        play={activePlay}
        isOpen={isPlayModalOpen}
        onClose={() => setIsPlayModalOpen(false)}
        availablePlays={playsCatalog}
        onSelectPlay={(id) => setActivePlayId(id)}
      />
    </div>
  );
}
