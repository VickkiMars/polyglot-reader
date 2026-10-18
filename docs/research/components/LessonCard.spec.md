# LessonCard Specification

## Overview
- **Target file:** `src/components/LessonCard.tsx`
- **Screenshot:** `docs/design-references/desktop_full.png`
- **Interaction model:** Hover elevation, image scale, and link color transition.

## DOM Structure
- `article.lesson-card`
  - `div.card-thumbnail-container` (overflow: hidden, border-radius: 8px 8px 0 0, aspect-ratio: 16/9)
    - `img.card-thumbnail` (width: 100%, height: 100%, object-fit: cover)
  - `div.card-body` (padding: 16px)
    - `h3.card-title`
      - `a.card-title-link` (fontFamily: Montserrat, fontSize: 16px, fontWeight: 500)
    - `div.card-meta` (display: flex, gap: 8px, margin-top: 10px, align-items: center)
      - `span.meta-badge` (fontFamily: Roboto, fontSize: 13px, color: #7a7a7a)
      - `span.meta-dot` ("•")
      - `span.audio-indicator` (audio headphone / speaker icon)

## Computed Styles (getComputedStyle)
- `card`: background: #ffffff, border-radius: 8px, border: 1px solid #f0f0f0, box-shadow: 0 1px 3px rgba(0,0,0,0.04), transition: all 0.25s ease
- `card:hover`: box-shadow: 0 8px 24px rgba(0,0,0,0.1), transform: translateY(-2px)
- `card-title-link`: color: #707d82, text-decoration: none, transition: color 0.2s ease
- `card:hover .card-title-link`: color: #cc3366
- `card:hover .card-thumbnail`: transform: scale(1.04), transition: transform 0.35s ease
- `meta-badge`: color: #7a7a7a, font-size: 13px

## Responsive Behavior
- Self-contained fluid card adjusting automatically to grid column widths.
