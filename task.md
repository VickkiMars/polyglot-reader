# Implementation Tasks: Full Japanese Lexical Parity (Interface Dream)

- [x] **Task 1: Morphological & Bilingual Lexicon Engine**
  - Integrated `janome`, `pykakasi`, `jamdict`, and Mandarin bilingual cross-referencing to extract complete sequential vocabulary for every Japanese story.
  - Resolved named entities (e.g. `ダーウェイ` -> "David (name)", `マーティン` -> "Martin (name)").
  - Mapped particles, auxiliaries, and compound verbs into learner-friendly definitions.
  - Assigned JLPT proficiency levels (N5..N1) across all vocabulary words.

- [x] **Task 2: Regenerate All 206 Japanese Story Vocabularies & Ruby Paragraphs**
  - Processed all 206 Japanese stories in `japanese/stories.json`.
  - Expanded vocabulary from 2,063 to **17,359 entries** (average 84.3 words/story, surpassing Mandarin's 72.6 words/story).
  - Pre-rendered `ruby_paragraphs` with 100% word annotation and zero unannotated/raw echoes.

- [x] **Task 3: Rebuild All 206 Japanese Markdown Reader Files**
  - Overwritten `/home/kami/Desktop/codebase/language/japanese/readers/*.md` with full vocabulary tables matching MandarinBean format.

- [x] **Task 4: Rebuild Japanese CSV Dataset**
  - Overwritten `/home/kami/Desktop/codebase/language/japanese/stories.csv` with all 17,359 vocabulary rows.

- [x] **Task 5: Re-bundle Web Assets & Verify Live in Browser**
  - Updated `stories_japanese.js` (8.9 MB).
  - Verified with Playwright: verified token count (104 interactive tokens in Story 1), hover tooltip definitions (including proper nouns), and saved QA screenshot `japanese_reader_cjk_font.png`.

- [x] **Task 6: Provide Final Walkthrough Artifact**
  - Documented all fixes, metrics before/after, and test evidence.
