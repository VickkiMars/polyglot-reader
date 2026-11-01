"use client";

import React from "react";
import { Search, X, Headphones, SlidersHorizontal, RotateCcw } from "lucide-react";
import { FilterState } from "@/types";

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClear: () => void;
  counts: {
    all: number;
    beginner: number;
    intermediate: number;
    advanced: number;
  };
}

const HSK_LEVELS = ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"];
const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];

export default function FilterBar({
  filters,
  onFilterChange,
  onClear,
  counts,
}: FilterBarProps) {
  const isMandarin = filters.language === "mandarin";
  const levels = isMandarin ? HSK_LEVELS : JLPT_LEVELS;
  const selectedLevels = isMandarin ? filters.selectedHsk : filters.selectedJlpt;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  const clearSearch = () => {
    onFilterChange({ ...filters, search: "" });
  };

  const handleLevelSelect = (level: string) => {
    onFilterChange({ ...filters, level });
  };

  const toggleLevelChip = (lvl: string) => {
    if (isMandarin) {
      const exists = filters.selectedHsk.includes(lvl);
      const updated = exists
        ? filters.selectedHsk.filter((item) => item !== lvl)
        : [...filters.selectedHsk, lvl];
      onFilterChange({ ...filters, selectedHsk: updated });
    } else {
      const exists = filters.selectedJlpt.includes(lvl);
      const updated = exists
        ? filters.selectedJlpt.filter((item) => item !== lvl)
        : [...filters.selectedJlpt, lvl];
      onFilterChange({ ...filters, selectedJlpt: updated });
    }
  };

  const toggleAudioOnly = () => {
    onFilterChange({ ...filters, audioOnly: !filters.audioOnly });
  };

  const hasActiveFilters =
    Boolean(filters.search) ||
    filters.level !== "all" ||
    selectedLevels.length > 0 ||
    filters.audioOnly;

  return (
    <div className="bg-[var(--md-sys-color-surface-container)] rounded-2xl p-3 sm:p-5 mb-6 sm:mb-8 border border-[var(--md-sys-color-outline-variant)]/60 shadow-xs transition-colors duration-200 min-w-0 max-w-full overflow-hidden">
      {/* Top Row: Search and Level Filter Segmented Control */}
      <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 items-stretch lg:items-center justify-between min-w-0">
        {/* Search Field */}
        <div className="relative flex-1 max-w-xl min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--md-sys-color-on-surface-variant)] pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={handleSearchChange}
            placeholder={
              isMandarin
                ? "Search lessons by title, character, or topic..."
                : "Search stories by Japanese title, reading, or English..."
            }
            className="w-full pl-10 pr-10 py-2.5 bg-[var(--md-sys-color-surface-container-lowest)] border border-[var(--md-sys-color-outline-variant)] rounded-full text-xs sm:text-sm text-[var(--md-sys-color-on-surface)] placeholder:text-[var(--md-sys-color-on-surface-variant)]/70 focus:outline-none focus:border-[var(--md-sys-color-primary)] focus:ring-1 focus:ring-[var(--md-sys-color-primary)] transition-all min-h-[44px]"
          />
          {filters.search && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] cursor-pointer rounded-full min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Level Tabs - Scrollable on mobile without wrapping */}
        <div className="w-full min-w-0 lg:w-auto overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
          <div className="inline-flex items-center bg-[var(--md-sys-color-surface-container-lowest)] p-1 rounded-full border border-[var(--md-sys-color-outline-variant)]/60 min-w-max">
            {[
              { id: "all", label: "All Levels", count: counts.all },
              { id: "Beginner", label: "Beginner", count: counts.beginner },
              { id: "Intermediate", label: "Intermediate", count: counts.intermediate },
              { id: "Advanced", label: "Advanced", count: counts.advanced },
            ].map((tab) => {
              const active = filters.level === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleLevelSelect(tab.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer min-h-[36px] whitespace-nowrap ${
                    active
                      ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-xs"
                      : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container)]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      active
                        ? "bg-black/20 text-white"
                        : "bg-[var(--md-sys-color-surface-container)] text-[var(--md-sys-color-on-surface-variant)]"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row: Dynamic Proficiency Level Chips & Audio Filter */}
      <div className="mt-4 pt-4 border-t border-[var(--md-sys-color-outline-variant)]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] uppercase tracking-wider mr-1">
            {isMandarin ? "HSK Filter:" : "JLPT Filter:"}
          </span>
          {levels.map((lvl) => {
            const checked = selectedLevels.includes(lvl);
            return (
              <button
                key={lvl}
                onClick={() => toggleLevelChip(lvl)}
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer border transition-all duration-150 min-h-[34px] sm:min-h-[36px] ${
                  checked
                    ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-[var(--md-sys-color-primary)] shadow-xs"
                    : "bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)]"
                }`}
                aria-pressed={checked}
              >
                {lvl}
              </button>
            );
          })}

          {/* Audio Only Chip */}
          <button
            onClick={toggleAudioOnly}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-all duration-150 min-h-[34px] sm:min-h-[36px] sm:ml-1 ${
              filters.audioOnly
                ? "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)] border-[var(--md-sys-color-tertiary)] font-semibold shadow-xs"
                : "bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-on-surface-variant)] border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-tertiary)]"
            }`}
            aria-pressed={filters.audioOnly}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Audio Only</span>
          </button>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="self-start sm:self-auto inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary-container)]/50 rounded-full transition-colors cursor-pointer min-h-[36px]"
          >
            <RotateCcw className="w-3 h-3" />
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}
