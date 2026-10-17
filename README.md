# Mandarin Bean Stories Extraction & Translation Pipeline

A robust, production-grade extraction and translation pipeline for all stories on [Mandarin Bean Story Archive](https://mandarinbean.com/tag/story/).

---

## 1. Technical Findings & Site Architecture

### Discovery
1. **Tag Archive Mapping**:
   The URL `https://mandarinbean.com/tag/story/` corresponds to WordPress Tag ID **7** (`Story`).
   As of current count, there are **206 stories** across the site.

2. **WordPress REST API Access**:
   Rather than fragile HTML scraping across 42 HTML pagination pages, the site exposes its standard WordPress REST API:
   ```
   https://mandarinbean.com/wp-json/wp/v2/posts?tags=7&per_page=100&page=N
   ```
   All 206 stories can be retrieved in just **3 fast API calls** (`per_page=100`), guaranteeing complete coverage with zero dropped stories.

3. **Multi-layer Text & Ruby Annotations**:
   Each story's content is formatted with HTML `<ruby>` tags containing rich phonetic and semantic metadata:
   - `<span class="si">`: Simplified Chinese characters
   - `<span class="tr">`: Traditional Chinese characters
   - `<rt>`: Pinyin with accurate tone marks
   - `data-mb-definition`: English vocabulary definitions for each word/phrase
   - `data-mb-oldhsk` / `data-mb-newhsk`: HSK difficulty levels

4. **The English Translation Nuance**:
   - **Native Vocabulary Translation**: Every character and multi-character word on the site has native English definitions in the ruby tooltips.
   - **Full Story Prose Translation**: On MandarinBean, full-text English translations are gated behind an Indeed Membership Pro paywall (`Logged-in premium members can access Exercises, Notes, Translation and Download Center`).
   - **Pipeline Solution**: The pipeline extracts all native English vocabulary definitions and titles, and integrates an automated sentence- and paragraph-level English translation stage (aligned with the Chinese sentences) into the export formats.

5. **Audio Narration**:
   Every story includes high-quality audio narration hosted on the Libsyn CDN:
   ```
   https://traffic.libsyn.com/secure/learnchinese/{audio_id}.mp3
   ```
   The pipeline extracts the audio link and can optionally download the MP3 files locally.

---

## 2. Pipeline Features

- **Multi-Format Extraction**:
  - Simplified Chinese full text and paragraphs
  - Traditional Chinese full text and paragraphs
  - Pinyin transcription with tone marks
  - Comprehensive English translation (paragraph- and sentence-aligned)
  - Word-level vocabulary glossary with Pinyin, English definitions, and HSK level
- **Multiple Output Formats**:
  - `stories.json`: Complete structured JSON archive
  - `stories.csv`: Tabular spreadsheet format for quick filtering and Anki deck generation
  - `readers/*.md`: Individual Markdown readers for each story featuring Chinese, Pinyin, English translation, audio links, and vocabulary tables
  - `audio/*.mp3`: Optional local audio archive
- **Fault-Tolerant & Resumable**:
  - Caches extracted stories to `stories_cache.json`. If interrupted, running the pipeline will resume where it left off without re-extracting or re-translating existing stories.

---

## 3. Installation & Usage

### Prerequisites
```bash
pip install beautifulsoup4
```

### Running the Pipeline

- **Test run on 5 stories**:
  ```bash
  python3 mandarinbean_extractor.py --limit 5
  ```

- **Extract all 206 stories**:
  ```bash
  python3 mandarinbean_extractor.py
  ```

- **Extract all stories and download narration MP3 files**:
  ```bash
  python3 mandarinbean_extractor.py --download-audio
  ```

- **Extract without automated translation (raw text & native vocabulary only)**:
  ```bash
  python3 mandarinbean_extractor.py --no-translate
  ```

- **Specify custom output folder**:
  ```bash
  python3 mandarinbean_extractor.py --output-dir ./mandarinbean_data
  ```

---

## 4. Output Structure

```
data/mandarinbean_stories/
├── stories.json            # Full nested JSON database of all stories
├── stories.csv             # CSV summary table with metadata and texts
├── stories_cache.json      # Resumption cache
├── readers/                # Formatted markdown readers per story
│   ├── 23410_a-happy-day.md
│   ├── 21751_punch-the-little-monkey.md
│   └── ...
└── audio/                  # (Optional) Downloaded MP3 narrations
    ├── 23410_a-happy-day.mp3
    └── ...
```
