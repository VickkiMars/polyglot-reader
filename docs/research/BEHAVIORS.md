# Behaviors & Interaction Specifications

**Target:** `https://mandarinbean.com/all-lessons/?jsf=epro-loop-builder&tax=category:3`

## 1. Navigation & Dropdowns
- **Trigger:** Hover (desktop) / Click (mobile)
- **Target:** Nav menu item `.sub-menu`
- **Initial State:** `opacity: 0; visibility: hidden; transform: translateY(10px);`
- **Active State:** `opacity: 1; visibility: visible; transform: translateY(0);`
- **Transition:** `all 0.25s ease-in-out`
- **Mobile Drawer:** Hamburger button toggles mobile overlay drawer from top/right at `< 1024px`.

## 2. JetSmartFilters
- **Search Filter:**
  - Real-time client or AJAX filtering on lesson titles.
  - Border `#ebecee`, focus border `#cc3366`.
- **Level Dropdown & HSK Checkboxes:**
  - Selecting checkboxes filters cards by matching HSK level badge (HSK 1 - HSK 6).
- **Apply / Clear Filters:**
  - "Apply filters" button: outline `#cc3366`, hover background `#cc3366`, color `#fff`.
  - "Clear filters" resets all active selections.

## 3. Lesson Cards Hover Effects
- **Card Container:**
  - Box shadow default: `0 1px 3px rgba(0,0,0,0.06)`
  - Box shadow hover: `0 8px 24px rgba(0,0,0,0.12)`
  - Transition: `box-shadow 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)`
- **Thumbnail Image:**
  - Scale default: `scale(1)`
  - Scale hover: `scale(1.04)`
  - Overflow: `hidden` on container
  - Transition: `transform 0.4s ease`
- **Title Link:**
  - Color default: `#707d82`
  - Color hover: `#cc3366`
  - Transition: `color 0.2s ease`

## 4. Responsive Breakpoints
- **Desktop (>= 1024px):**
  - Full horizontal navbar
  - 3-column lesson card grid (`grid-cols-3`, `gap: 24px`)
  - Horizontal filter toolbar
- **Tablet (768px - 1023px):**
  - Mobile hamburger navbar
  - 2-column lesson card grid (`grid-cols-2`, `gap: 20px`)
- **Mobile (< 768px):**
  - 1-column stacked card grid (`grid-cols-1`, `gap: 16px`)
  - Full-width filter inputs stacked vertically
