# Polyglot Reader — Graded East Asian Language Platform

A production-grade, immersive graded reading and neural audio listening platform for East Asian languages (Mandarin Chinese & Japanese).

---

## Architecture & Features

1. **Dual Language Tracks**:
   - **Mandarin Chinese**: Graded stories across HSK 1–6 with toggleable Simplified & Traditional scripts, tone-marked Pinyin, and word-by-word definitions.
   - **Japanese**: Graded stories across JLPT N5–N1 with complete morphological lexical parity, interactive furigana ruby annotations, and English definitions.

2. **Material Design 3 (MD3) Interface**:
   - Tonal elevation and container surfaces (`surface-container-lowest` through `highest`).
   - Dynamic theme switching with full light and dark mode parity.
   - 8dp spacing system and touch targets ≥44pt.

3. **Neural Audio Narration Engine**:
   - 100% audio coverage across all 206 stories for both Mandarin (`zh-CN-XiaoxiaoNeural`) and Japanese (`ja-JP-NanamiNeural`).
   - Interactive in-app player with seek scrubbing, volume controls, and playback speed adjustment (0.75×, 1.0×, 1.25×, 1.5×).

4. **Interactive In-App Reader**:
   - Interactive ruby text with floating lexical tooltips on hover or tap.
   - Synchronized sentence translations.
   - Dedicated searchable vocabulary tab with complete word lists.

---

## Development

```bash
# Install dependencies
npm install

# Start Next.js development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```
