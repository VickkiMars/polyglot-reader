# LessonGrid Specification

## Overview
- **Target file:** `src/components/LessonGrid.tsx`
- **Screenshot:** `docs/design-references/desktop_full.png`
- **Interaction model:** Responsive CSS grid rendering cards with pagination.

## DOM Structure
- `section.lessons-section` (max-width: 1200px, margin: 0 auto, padding: 32px 16px)
  - `div.grid-header` (heading: "Beginner Lessons", count badge)
  - `div.lessons-grid` (display: grid, grid-template-columns: repeat(3, 1fr), gap: 24px)
    - `<LessonCard />` (x9 items per page)
  - `div.pagination-wrapper` (`<Pagination />`)

## Responsive Layout
- **Desktop (>= 1024px):** 3 columns (`grid-cols-3`, `gap: 24px`)
- **Tablet (768px - 1023px):** 2 columns (`grid-cols-2`, `gap: 20px`)
- **Mobile (< 768px):** 1 column (`grid-cols-1`, `gap: 16px`)
