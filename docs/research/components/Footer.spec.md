# Footer Specification

## Overview
- **Target file:** `src/components/Footer.tsx`
- **Screenshot:** `docs/design-references/desktop_full.png`
- **Interaction model:** Static informational footer with link hovers.

## DOM Structure
- `footer.site-footer` (background: #2a302f, color: #ffffff, padding: 48px 16px 24px)
  - `div.footer-container` (max-width: 1200px, margin: 0 auto, display: flex, flex-direction: column, align-items: center, gap: 24px)
    - `nav.footer-links` (display: flex, flex-wrap: wrap, gap: 20px, justify-content: center)
      - `a.footer-link` ("About")
      - `a.footer-link` ("Blog")
      - `a.footer-link` ("New HSK Vocabulary")
      - `a.footer-link` ("Help")
      - `a.footer-link` ("Privacy Policy")
      - `a.footer-link` ("Terms of Use")
    - `div.footer-copyright` ("© Mandarin Bean. All Rights Reserved.")

## Computed Styles
- `footer-link`: fontFamily: 'Montserrat, sans-serif', fontSize: 14px, color: '#a0aab0', textDecoration: 'none'
- `footer-link:hover`: color: '#ffffff'
- `footer-copyright`: fontFamily: 'Roboto, sans-serif', fontSize: 13px, color: '#687379'
