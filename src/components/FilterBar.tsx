"use client";

import React from "react";
import { Search } from "lucide-react";
import { FilterState } from "@/types";

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onApply: () => void;
  onClear: () => void;
}

const HSK_LEVELS = ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"];

export default function FilterBar({
  filters,
  onFilterChange,
  onApply,
  onClear,
}: FilterBarProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, level: e.target.value });
  };

  const handleHskToggle = (hsk: string) => {
    const exists = filters.selectedHsk.includes(hsk);
    const updated = exists
      ? filters.selectedHsk.filter((item) => item !== hsk)
      : [...filters.selectedHsk, hsk];
    onFilterChange({ ...filters, selectedHsk: updated });
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, progress: e.target.value });
  };

  return (
    <div className="bg-white border border-[#ebecee] rounded-lg p-5 mb-8 shadow-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={filters.search}
            onChange={handleSearchChange}
            placeholder="Search lessons..."
            className="w-full pl-10 pr-4 py-2 border border-[#ebecee] rounded-md text-sm text-[#333] focus:outline-none focus:border-[#cc3366] transition-colors"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        </div>

        {/* Level Select */}
        <div>
          <select
            value={filters.level}
            onChange={handleLevelChange}
            className="w-full px-3 py-2 border border-[#ebecee] rounded-md text-sm text-[#333] bg-white focus:outline-none focus:border-[#cc3366] transition-colors cursor-pointer"
          >
            <option value="all">Level: All</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>

        {/* My Progress Select */}
        <div>
          <select
            value={filters.progress}
            onChange={handleProgressChange}
            className="w-full px-3 py-2 border border-[#ebecee] rounded-md text-sm text-[#333] bg-white focus:outline-none focus:border-[#cc3366] transition-colors cursor-pointer"
          >
            <option value="all">My Progress: All</option>
            <option value="read">Read</option>
            <option value="unread">Unread</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onApply}
            className="flex-1 py-2 px-4 border border-[#cc3366] text-[#cc3366] hover:bg-[#cc3366] hover:text-white rounded-md text-sm font-semibold transition-all cursor-pointer"
          >
            Apply filters
          </button>
          <button
            onClick={onClear}
            className="px-3 py-2 text-sm text-[#707d82] hover:text-[#cc3366] transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* HSK Checkboxes Row */}
      <div className="mt-4 pt-4 border-t border-[#f0f0f0] flex flex-wrap items-center gap-4 text-sm text-[#333]">
        <span className="font-medium text-[#707d82] text-xs uppercase tracking-wider">
          HSK Filter:
        </span>
        <div className="flex flex-wrap gap-3">
          {HSK_LEVELS.map((hsk) => {
            const checked = filters.selectedHsk.includes(hsk);
            return (
              <label
                key={hsk}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs cursor-pointer border transition-colors ${
                  checked
                    ? "bg-[#fdf2f5] border-[#cc3366] text-[#cc3366] font-semibold"
                    : "border-[#ebecee] text-[#707d82] hover:border-[#cc3366]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleHskToggle(hsk)}
                  className="hidden"
                />
                {hsk}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
