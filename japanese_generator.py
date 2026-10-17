#!/usr/bin/env python3
"""
Japanese Story & Graded Reader Pipeline
=======================================
Generates Japanese graded readers from English/Mandarin stories using GPT-6 (gpt-6-sol).
Produces:
- Japanese stories with paragraph-aligned Kanji/Kana text and Furigana/Hiragana readings
- Vocabulary & Grammar notes with words, readings, English definitions, and JLPT levels
- Output formats: JSON, CSV, and Markdown readers inside /home/kami/Desktop/codebase/language/japanese/
"""

import os
import re
import json
import csv
import time
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

# Paths
SOURCE_MANDARIN_DIR = "/home/kami/Desktop/codebase/language/mandarin"
TARGET_JAPANESE_DIR = "/home/kami/Desktop/codebase/language/japanese"
ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
SENTAL_ENV_PATH = "/home/kami/Desktop/codebase/sental/translation_sandbox/.env"


def load_env():
    for p in [ENV_PATH, SENTAL_ENV_PATH]:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip())


load_env()
API_KEY = os.environ.get("OPENAI_API_KEY")
MODEL = os.environ.get("OPENAI_MODEL", "gpt-6-sol")


SYSTEM_PROMPT = """You are an expert Japanese linguist and educator specializing in Japanese graded readers (mirroring the Mandarin Bean format).
Given a story's English paragraphs (and its original context), translate it into natural, idiomatic, and engaging Japanese.

Requirements:
1. Translate paragraph-by-paragraph. Return strictly the same number of paragraphs.
2. For each paragraph, provide:
   a) "japanese_paragraphs": The natural Japanese text using standard Kanji and Kana.
   b) "reading_paragraphs": The phonetic reading (in Hiragana, with natural word spacing) corresponding to the Japanese paragraph.
3. Extract 6 to 15 key vocabulary words from the story into "vocabulary":
   - "word": Kanji / base form
   - "reading": Hiragana pronunciation
   - "definition": English meaning in context
   - "jlpt": Approximate JLPT level ("N5", "N4", "N3", "N2", "N1", or "-")

Output strictly valid JSON with the schema:
{
  "japanese_title": "Japanese title",
  "japanese_paragraphs": [
    "Japanese paragraph 1...",
    "Japanese paragraph 2..."
  ],
  "reading_paragraphs": [
    "Reading in hiragana for paragraph 1...",
    "Reading in hiragana for paragraph 2..."
  ],
  "vocabulary": [
    {
      "word": "...",
      "reading": "...",
      "definition": "...",
      "jlpt": "N5"
    }
  ]
}

Example:
Input:
Title: Waiting for the hare
English Paragraphs:
[
  "During the Warring States period, a farmer had a tree in his field.",
  "One day, he saw a rabbit running very fast. It crashed into the tree and died. So the farmer waited by the tree every day, hoping to find another rabbit.",
  "Of course, no second rabbit ever came! Everyone laughed at him."
]
Output:
{
  "japanese_title": "株を守りて兎を待つ",
  "japanese_paragraphs": [
    "戦国時代、ある農夫の畑に一本の木がありました。",
    "ある日、彼が走っている素早い兎を見かけました。兎は木に激突して死んでしまいました。それ以来、農夫はまた兎が現れることを期待して、毎日木のそばで待ち続けました。",
    "もちろん、二匹目の兎など現れるはずがありません！彼はみんなから笑いものにされました。"
  ],
  "reading_paragraphs": [
    "せんごくじだい、 ある のうふ の はたけ に いっぽん の き が ありました。",
    "あるひ、 かれ が はしっている すばやい うさぎ を みかけました。 うさぎ は き に げきとつ して しんで しまいました。 それいらい、 のうふ は また うさぎ が あらわれる こと を きたい して、 まいにち き の そば で まちつづけました。",
    "もちろん、 にひきめ の うさぎ など あらわれる はず が ありません！ かれ は みんな から わらいもの に されました。"
  ],
  "vocabulary": [
    {"word": "戦国時代", "reading": "せんごくじだい", "definition": "Warring States period", "jlpt": "-"},
    {"word": "農夫", "reading": "のうふ", "definition": "farmer", "jlpt": "N2"},
    {"word": "畑", "reading": "はたけ", "definition": "field; farmland", "jlpt": "N3"},
    {"word": "素早い", "reading": "すばやい", "definition": "fast; quick; agile", "jlpt": "N2"},
    {"word": "激突", "reading": "げきとつ", "definition": "crashing into; collision", "jlpt": "N1"},
    {"word": "期待", "reading": "きたい", "definition": "expectation; hope", "jlpt": "N3"},
    {"word": "笑いもの", "reading": "わらいもの", "definition": "laughingstock", "jlpt": "N1"}
  ]
}
"""


class JapaneseStoryPipeline:
    def __init__(self, src_dir=SOURCE_MANDARIN_DIR, target_dir=TARGET_JAPANESE_DIR, model=MODEL, workers=8):
        self.src_dir = src_dir
        self.target_dir = target_dir
        self.model = model
        self.workers = workers
        self.client = OpenAI(api_key=API_KEY)

        self.cache_file = os.path.join(self.target_dir, "japanese_cache.json")
        self.json_file = os.path.join(self.target_dir, "stories.json")
        self.csv_file = os.path.join(self.target_dir, "stories.csv")
        self.readers_dir = os.path.join(self.target_dir, "readers")
        os.makedirs(self.readers_dir, exist_ok=True)

    def load_mandarin_stories(self):
        src_json = os.path.join(self.src_dir, "stories.json")
        with open(src_json, "r", encoding="utf-8") as f:
            return json.load(f)

    def translate_to_japanese(self, story, retries=3):
        title = story.get("title", "")
        en_paras = story.get("english_paragraphs", [])
        if not en_paras and story.get("english_full"):
            en_paras = [p.strip() for p in story["english_full"].split("\n\n") if p.strip()]

        if not en_paras:
            # Fallback to simplified text if english was empty
            en_paras = story.get("simplified_paragraphs", [])

        user_content = f"Title: {title}\nEnglish Paragraphs:\n"
        user_content += json.dumps(en_paras, ensure_ascii=False, indent=2)

        for attempt in range(retries):
            try:
                resp = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_content}
                    ],
                    response_format={"type": "json_object"},
                    max_completion_tokens=2500
                )
                data = json.loads(resp.choices[0].message.content)
                ja_paras = data.get("japanese_paragraphs", [])
                rd_paras = data.get("reading_paragraphs", [])
                vocab = data.get("vocabulary", [])
                ja_title = data.get("japanese_title", title)

                # Ensure length parity
                if len(ja_paras) < len(en_paras):
                    ja_paras.extend([""] * (len(en_paras) - len(ja_paras)))
                if len(rd_paras) < len(en_paras):
                    rd_paras.extend([""] * (len(en_paras) - len(rd_paras)))

                return {
                    "japanese_title": ja_title,
                    "japanese_paragraphs": ja_paras[:len(en_paras)],
                    "reading_paragraphs": rd_paras[:len(en_paras)],
                    "vocabulary": vocab
                }
            except Exception as e:
                print(f"[-] GPT-6 Japanese translation error on {title} (attempt {attempt+1}): {e}")
                time.sleep(2 * (attempt + 1))

        return {
            "japanese_title": title,
            "japanese_paragraphs": [""] * len(en_paras),
            "reading_paragraphs": [""] * len(en_paras),
            "vocabulary": []
        }

    def write_markdown_reader(self, item):
        filename = f"{item['id']}_{item['slug']}.md"
        filepath = os.path.join(self.readers_dir, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"# {item['japanese_title']} ({item['title']})\n\n")
            f.write(f"- **Level**: {item['level']} ({', '.join(item['hsk_tags']) if item.get('hsk_tags') else 'N/A'})\n")
            f.write(f"- **Mandarin Reference URL**: [{item.get('url', '')}]({item.get('url', '')})\n")
            if item.get("audio_url"):
                f.write(f"- **Narration Audio**: [Listen / Download MP3]({item['audio_url']})\n")
            f.write("\n---\n\n")

            f.write("## 1. Story Text & Reading\n\n")
            ja_paras = item.get("japanese_paragraphs", [])
            rd_paras = item.get("reading_paragraphs", [])
            en_paras = item.get("english_paragraphs", [])

            for i in range(len(ja_paras)):
                ja = ja_paras[i]
                rd = rd_paras[i] if i < len(rd_paras) else ""
                en = en_paras[i] if i < len(en_paras) else ""

                f.write(f"**Japanese**:\n{ja}\n\n")
                if rd:
                    f.write(f"*Reading*:\n{rd}\n\n")
                if en:
                    f.write(f"> **English Translation**:\n> {en}\n\n")

            vocab = item.get("vocabulary", [])
            if vocab:
                f.write("\n---\n\n## 2. Vocabulary & Grammar Notes\n\n")
                f.write("| Japanese | Reading | Definition | JLPT Level |\n")
                f.write("| --- | --- | --- | --- |\n")
                for v in vocab:
                    word = v.get("word", "")
                    reading = v.get("reading", "")
                    defn = v.get("definition", "")
                    jlpt = v.get("jlpt", "-")
                    f.write(f"| {word} | {reading} | {defn} | {jlpt} |\n")

    def export_all(self, stories):
        # 1. Cache
        with open(self.cache_file, "w", encoding="utf-8") as f:
            json.dump(stories, f, ensure_ascii=False, indent=2)

        # 2. Master JSON
        with open(self.json_file, "w", encoding="utf-8") as f:
            json.dump(stories, f, ensure_ascii=False, indent=2)
        print(f"[+] Exported Japanese JSON dataset ({len(stories)} stories) -> {self.json_file}")

        # 3. Master CSV
        with open(self.csv_file, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "ID", "Title (EN)", "Title (JA)", "Level", "URL",
                "Japanese Text", "Reading Text", "English Translation", "Vocabulary Count"
            ])
            for s in stories:
                writer.writerow([
                    s["id"],
                    s["title"],
                    s.get("japanese_title", ""),
                    s["level"],
                    s.get("url", ""),
                    s.get("japanese_full", ""),
                    s.get("reading_full", ""),
                    s.get("english_full", ""),
                    len(s.get("vocabulary", []))
                ])
        print(f"[+] Exported Japanese CSV summary -> {self.csv_file}")

    def run(self, force=False):
        mandarin_stories = self.load_mandarin_stories()
        print(f"[*] Loaded {len(mandarin_stories)} source stories from Mandarin dataset.")

        cached_data = {}
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    cached_data = {s["id"]: s for s in json.load(f)}
                print(f"[+] Found {len(cached_data)} existing Japanese stories in cache.")
            except Exception:
                pass

        to_process = []
        for s in mandarin_stories:
            sid = s["id"]
            if force or sid not in cached_data or not cached_data[sid].get("japanese_full"):
                to_process.append(s)

        print(f"[*] Stories to translate into Japanese: {len(to_process)} (Skipping {len(mandarin_stories) - len(to_process)} already generated)")

        def _worker(s):
            sid = s["id"]
            result = self.translate_to_japanese(s)
            ja_full = "\n\n".join(result["japanese_paragraphs"])
            rd_full = "\n\n".join(result["reading_paragraphs"])

            ja_item = {
                "id": s["id"],
                "title": s["title"],
                "japanese_title": result["japanese_title"],
                "slug": s["slug"],
                "url": s.get("url", ""),
                "date": s.get("date", ""),
                "level": s["level"],
                "hsk_tags": s.get("hsk_tags", []),
                "audio_url": s.get("audio_url", ""),
                "english_paragraphs": s.get("english_paragraphs", []),
                "english_full": s.get("english_full", ""),
                "japanese_paragraphs": result["japanese_paragraphs"],
                "reading_paragraphs": result["reading_paragraphs"],
                "japanese_full": ja_full,
                "reading_full": rd_full,
                "vocabulary": result["vocabulary"]
            }
            self.write_markdown_reader(ja_item)
            return sid, ja_item

        total = len(to_process)
        completed = 0

        if total > 0:
            print(f"[*] Launching GPT-6 Japanese generation with {self.workers} worker threads...")
            with ThreadPoolExecutor(max_workers=self.workers) as executor:
                future_to_s = {executor.submit(_worker, s): s for s in to_process}
                for future in as_completed(future_to_s):
                    completed += 1
                    s = future_to_s[future]
                    try:
                        sid, ja_item = future.result()
                        cached_data[sid] = ja_item
                        print(f"[{completed}/{total}] Generated Japanese story ID {sid}: {ja_item['japanese_title']}")
                    except Exception as e:
                        print(f"[-] Error on story ID {s.get('id')}: {e}")

                    if completed % 15 == 0 or completed == total:
                        # Reassemble in original order
                        ordered = [cached_data[st["id"]] for st in mandarin_stories if st["id"] in cached_data]
                        self.export_all(ordered)

        ordered = [cached_data[st["id"]] for st in mandarin_stories if st["id"] in cached_data]
        self.export_all(ordered)
        print(f"[+] All {len(ordered)} Japanese stories successfully generated and exported!")
        return ordered


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Japanese graded readers from Mandarin/English stories using GPT-6")
    parser.add_argument("--workers", type=int, default=8, help="Number of concurrent worker threads (default: 8)")
    parser.add_argument("--force", action="store_true", help="Force regenerate all Japanese stories")
    args = parser.parse_args()

    pipeline = JapaneseStoryPipeline(workers=args.workers)
    pipeline.run(force=args.force)
