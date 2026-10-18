# Header Specification

## Overview
- **Target file:** `src/components/Header.tsx`
- **Screenshot:** `docs/design-references/desktop_full.png`
- **Interaction model:** Hover-driven multi-level dropdown menus on desktop; click-driven toggle drawer on mobile.

## DOM Structure
- `header.site-header`
  - `div.header-container` (max-width: 1200px, flex, space-between, items-center)
    - `div.site-logo` -> `img` (`public/images/logo.png`, width: 180px, height: auto)
    - `nav.desktop-nav` (display: flex, align-items: center, gap: 0)
      - `ul.nav-menu`
        - `li.nav-item` -> `a.nav-link` ("Home")
        - `li.nav-item.has-dropdown` -> `a.nav-link` ("All Lessons")
          - `ul.sub-menu` (dropdown container)
            - `li` -> `a` ("Beginner" - active, colored `#cc3366`)
            - `li` -> `a` ("Intermediate")
            - `li` -> `a` ("Advanced")
        - `li.nav-item.has-dropdown` -> `a.nav-link` ("Grammar")
          - `ul.sub-menu` ("All Grammar Points with Exercises", "Grammar Level Tests")
        - `li.nav-item.has-dropdown` -> `a.nav-link` ("Test Prep")
          - `ul.sub-menu` ("HSK Sample Tests", "YCT Sample Tests")
        - `li.nav-item.has-dropdown` -> `a.nav-link` ("More")
          - `ul.sub-menu` ("Pinyin Practice", "Confusing Chinese Words")
        - `li.nav-item` -> `a.nav-link` ("Pricing")
        - `li.nav-item` -> `a.nav-link.login-btn` ("Login")
    - `button.mobile-menu-btn` (display: none on desktop, visible on mobile)

## Computed Styles (getComputedStyle)
- `header`: height: 80px, background: #ffffff, border-bottom: 1px solid #f0f0f0, position: sticky, top: 0, z-index: 1000
- `nav-link`: fontFamily: 'Montserrat, sans-serif', fontSize: 15px, fontWeight: 500, color: '#2a302f', padding: '28px 14px'
- `nav-link:hover`: color: '#cc3366'
- `sub-menu`: background: #ffffff, box-shadow: 0 4px 20px rgba(0,0,0,0.08), border-radius: 4px, padding: '8px 0', min-width: 220px

## Responsive Behavior
- **Desktop (>= 1024px):** Desktop nav visible, mobile button hidden.
- **Mobile (< 1024px):** Desktop nav hidden, hamburger icon button visible, slide-out mobile menu.
