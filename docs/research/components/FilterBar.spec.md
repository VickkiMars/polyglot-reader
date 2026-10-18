# FilterBar Specification

## Overview
- **Target file:** `src/components/FilterBar.tsx`
- **Screenshot:** `docs/design-references/desktop_full.png`
- **Interaction model:** Click and input driven (search text, select dropdowns, multi-select checkboxes).

## DOM Structure
- `div.filter-bar-wrapper`
  - `div.search-input-wrapper`
    - `input.search-input` (placeholder: "Search...")
  - `div.filter-controls-row` (flex wrap, gap: 12px, align-items: center)
    - `select.level-select` (Options: All Levels, Beginner, Intermediate, Advanced)
    - `div.hsk-checkboxes-group`
      - `label.hsk-checkbox-label` ("HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6")
    - `select.progress-select` (Options: All, Read, Unread)
    - `button.apply-filters-btn` ("Apply filters")
    - `button.clear-filters-btn` ("Clear filters")

## Computed Styles (getComputedStyle)
- `search-input`: fontFamily: 'Roboto, sans-serif', fontSize: 16px, padding: '8px 16px', border: '1px solid #ebecee', borderRadius: '5px', width: '100%', maxWidth: '320px'
- `level-select`: fontFamily: 'Roboto, sans-serif', fontSize: 14px, padding: '8px 12px', border: '1px solid #ebecee', borderRadius: '4px', background: '#fff'
- `hsk-checkbox-label`: fontFamily: 'Roboto, sans-serif', fontSize: 14px, color: '#333', cursor: 'pointer'
- `apply-filters-btn`: fontFamily: 'Montserrat, sans-serif', fontSize: 15px, fontWeight: 600, color: '#cc3366', background: 'transparent', border: '1px solid #cc3366', borderRadius: '3px', padding: '8px 18px', cursor: 'pointer'
- `apply-filters-btn:hover`: background: '#cc3366', color: '#ffffff'
- `clear-filters-btn`: fontFamily: 'Montserrat, sans-serif', fontSize: 14px, color: '#707d82', background: 'transparent', border: 'none', cursor: 'pointer'

## Responsive Behavior
- **Desktop (>= 1024px):** Filters flow horizontally with flex wrapping.
- **Mobile (< 768px):** Filter inputs expand to full width (100%), stacked vertically.
