# Page Topology: MandarinBean All Lessons

**Source:** `https://mandarinbean.com/all-lessons/?jsf=epro-loop-builder&tax=category:3`

## Visual Hierarchy & Sections (Top to Bottom)

1. **Header & Navigation (`Header.tsx`)**
   - Type: Sticky / Fixed overlay on scroll
   - Components:
     - Site Logo (`https://mandarinbean.com/wp-content/uploads/2019/05/MandarinBean_logo_n.png`)
     - Desktop Nav Menu with multi-level dropdowns:
       - Home (`/`)
       - All Lessons (`/all-lessons/` -> Beginner [cat 3], Intermediate [cat 4], Advanced [cat 5])
       - Grammar (All Grammar Points with Exercises, Grammar Level Tests)
       - Test Prep (HSK Sample Tests, YCT Sample Tests)
       - More (Pinyin Practice, Confusing Chinese Words)
       - Pricing (`/premium-service/`)
       - Login (`/login/`)
     - Mobile Hamburger Toggle (responsive breakpoint < 1024px)
   - Interaction Model: Hover dropdowns on desktop; accordion / slide drawer on mobile.

2. **Page Hero / Breadcrumbs Banner (`HeroBanner.tsx`)**
   - Type: Flow content
   - Heading: "Chinese Reading and Listening Practice"
   - Active Category Subtitle / Pill: "Beginner" (Category 3)
   - Breadcrumb navigation: Home > All Lessons > Beginner

3. **Smart Filters Panel (`FilterBar.tsx`)**
   - Type: Flow content, full width or containerized above grid
   - Components:
     - Search Input (`jet-search-filter__input`)
     - Level Select Dropdown (`jet-smart-filters-select`)
     - HSK Filter Checkboxes (`jet-smart-filters-checkboxes` - HSK1..6)
     - Member Progress Dropdown (`jet-smart-filters-select` - All, Read, Unread)
     - Action Buttons: "Apply filters" (Primary outline `#cc3366`), "Clear filters"
   - Interaction Model: Click-driven filter selection, dynamic query update.

4. **Lesson Cards Grid (`LessonGrid.tsx`)**
   - Type: Flow grid (3 columns desktop, 2 columns tablet, 1 column mobile)
   - Each Card (`LessonCard.tsx`):
     - Thumbnail image with subtle hover zoom
     - Lesson Title (`Montserrat`, 16px, weight 500)
     - Meta badges list: Level/HSK badge (`HSK2`), Category (`Story`/`Fun`/`Lifestyle`), Audio duration indicator
   - Interaction Model: Hover states on cards (elevation/shadow, title underline, image transform).

5. **Pagination Controls (`Pagination.tsx`)**
   - Type: Centered flow bar
   - Components:
     - Prev button
     - Page number buttons (1, 2, 3...)
     - Next button
   - Interaction Model: Click to paginate lessons.

6. **Site Footer (`Footer.tsx`)**
   - Type: Bottom flow container
   - Components:
     - Navigation links: About, Blog, New HSK Vocabulary, Help, Privacy Policy, Terms of Use
     - Copyright notice: `© Mandarin Bean. All Rights Reserved.`
