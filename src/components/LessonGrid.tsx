"use client";

import React, { useState, useMemo } from "react";
import LessonCard from "./LessonCard";
import FilterBar from "./FilterBar";
import Pagination from "./Pagination";
import { Lesson, FilterState } from "@/types";

interface LessonGridProps {
  initialLessons: Lesson[];
}

const ITEMS_PER_PAGE = 9;

export default function LessonGrid({ initialLessons }: LessonGridProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    level: "all",
    selectedHsk: [],
    progress: "all",
  });

  const [appliedFilters, setAppliedFilters] = useState<FilterState>(filters);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter lessons based on applied filters
  const filteredLessons = useMemo(() => {
    return initialLessons.filter((lesson) => {
      // Search query
      if (
        appliedFilters.search &&
        !lesson.title.toLowerCase().includes(appliedFilters.search.toLowerCase())
      ) {
        return false;
      }

      // HSK Level filter
      if (appliedFilters.selectedHsk.length > 0) {
        const matchesHsk = lesson.meta.some((tag) =>
          appliedFilters.selectedHsk.some((hsk) =>
            tag.toLowerCase().includes(hsk.toLowerCase())
          )
        );
        if (!matchesHsk) return false;
      }

      return true;
    });
  }, [initialLessons, appliedFilters]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredLessons.length / ITEMS_PER_PAGE) || 1;
  const paginatedLessons = filteredLessons.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleApply = () => {
    setAppliedFilters(filters);
    setCurrentPage(1);
  };

  const handleClear = () => {
    const cleared = { search: "", level: "all", selectedHsk: [], progress: "all" };
    setFilters(cleared);
    setAppliedFilters(cleared);
    setCurrentPage(1);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-8">
      {/* Hero / Category Title */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-[#707d82] mb-2 font-roboto">
          <span>Home</span>
          <span>/</span>
          <span>All Lessons</span>
          <span>/</span>
          <span className="text-[#cc3366] font-medium">Beginner</span>
        </div>
        <h1 className="text-3xl lg:text-4xl font-montserrat font-bold text-[#2a302f]">
          Chinese Reading and Listening Practice
        </h1>
        <p className="mt-2 text-sm text-[#707d82] font-roboto">
          Showing beginner graded stories, articles, and dialogs with audio and vocabulary.
        </p>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        onApply={handleApply}
        onClear={handleClear}
      />

      {/* Results Header */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-sm font-medium text-[#707d82]">
          Showing {paginatedLessons.length} of {filteredLessons.length} lessons
        </span>
      </div>

      {/* 3-Column Card Grid */}
      {paginatedLessons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedLessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border border-[#ebecee] rounded-lg">
          <p className="text-gray-500 text-base">No lessons match your active filters.</p>
          <button
            onClick={handleClear}
            className="mt-4 px-4 py-2 text-sm text-[#cc3366] font-semibold border border-[#cc3366] rounded-md hover:bg-[#cc3366] hover:text-white transition-all"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
