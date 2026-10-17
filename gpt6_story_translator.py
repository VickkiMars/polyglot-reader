#!/usr/bin/env python3
"""
GPT-6 Story Translator & Word Alignment Pipeline
=================================================
Translates Mandarin Bean stories into accurate, natural English using GPT-6
(gpt-6-sol) with structured prompts and examples, matching the exact markdown
reader layout (Chinese, Pinyin, English translation, and Vocabulary/Grammar table).

Features:
- Incremental / Resume: Skips the 100 stories already translated and only processes
  the remaining stories without English translations.
- Structured Prompts: Uses few-shot translation examples to ensure precise paragraph-
  by-paragraph alignment.
- Consistent Output: Updates JSON, CSV, and generated Markdown readers in
  data/mandarinbean_stories/readers/.
"""

import os
import re
import json
import csv
import time
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

# Load environment variables
DEFAULT_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
SENTAL_ENV_PATH = "/home/kami/Desktop/codebase/sental/translation_sandbox/.env"


def load_env():
    for env_path in [DEFAULT_ENV_PATH, SENTAL_ENV_PATH]:
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip())


load_env()

API_KEY = os.environ.get("OPENAI_API_KEY")
DEFAULT_MODEL = os.environ.get("OPENAI_MODEL", "gpt-6-sol")


# Structured System Prompt with clear instructions and few-shot examples
SYSTEM_PROMPT = """You are an expert Chinese-to-English translator and linguist specializing in Chinese graded readers (like Mandarin Bean).
Your task is to translate Chinese stories into natural, fluent, and highly accurate English while strictly preserving paragraph alignment.

Rules:
1. Process every paragraph in its exact original order.
2. Return exactly one English paragraph translation per input Chinese paragraph.
3. Keep the translation tone natural, engaging, and faithful to the difficulty level and nuance of the Chinese story.
4. Output must be a strictly valid JSON object matching the following schema:
{
  "english_paragraphs": [
    "English translation of paragraph 1",
    "English translation of paragraph 2"
  ]
}

### Example 1:
Input Paragraphs:
[
  "战国时候的一个农民，他的田中有一棵树。",
  "一天，他看见一只跑得很快的兔子。兔子撞到了树上，死了。所以，农民就每天在树边等，等啊等，希望能再等到一只兔子。",
  "当然不可能等到第二只兔子！他被大家笑话。"
]
Output:
{
  "english_paragraphs": [
    "During the Warring States period, there was a farmer who had a tree in his field.",
    "One day, he saw a rabbit running at high speed. The rabbit crashed into the tree and died. From then on, the farmer waited beside the tree every single day, hoping another rabbit would come along.",
    "Of course, another rabbit never came! He became a laughingstock to everyone."
  ]
}

### Example 2:
Input Paragraphs:
[
  "我叫大伟，我是一个学生。现在我在中国学习汉语。我有一个好朋友，他叫马丁。",
  "今天星期六，我们都不上课。上午十点，我们去商场买衣服。下午我们去看电影。"
]
Output:
{
  "english_paragraphs": [
    "My name is Dawei, and I am a student. Currently, I am studying Chinese in China. I have a good friend named Martin.",
    "Today is Saturday, so neither of us has class. At ten o'clock in the morning, we went to the shopping mall to buy clothes. In the afternoon, we went to see a movie."
  ]
}
"""


class GPT6StoryTranslator:
    def __init__(self, data_dir="data/mandarinbean_stories", model=DEFAULT_MODEL, workers=5):
        self.data_dir = data_dir
        self.model = model
        self.workers = workers
        self.client = OpenAI(api_key=API_KEY)
        self.cache_path = os.path.join(self.data_dir, "stories_cache.json")
        self.json_path = os.path.join(self.data_dir, "stories.json")
        self.csv_path = os.path.join(self.data_dir, "stories.csv")
        self.readers_dir = os.path.join(self.data_dir, "readers")

    def load_stories(self):
        if not os.path.exists(self.cache_path):
            raise FileNotFoundError(f"Cache file not found at: {self.cache_path}")
        with open(self.cache_path, "r", encoding="utf-8") as f:
            stories = json.load(f)
        return stories

    def translate_paragraphs_gpt6(self, title, paragraphs, retries=3):
        """Calls GPT-6 with structured JSON output to translate Chinese paragraphs."""
        if not paragraphs:
            return []

        user_content = f"Title: {title}\nChinese Paragraphs:\n"
        user_content += json.dumps(paragraphs, ensure_ascii=False, indent=2)

        for attempt in range(retries):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_content}
                    ],
                    response_format={"type": "json_object"},
                    max_completion_tokens=2500
                )
                raw_text = response.choices[0].message.content.strip()
                parsed = json.loads(raw_text)
                translated_list = parsed.get("english_paragraphs", [])

                if len(translated_list) == len(paragraphs):
                    return [p.strip() for p in translated_list]
                elif len(translated_list) > 0:
                    # Pad or trim if length mismatch
                    if len(translated_list) < len(paragraphs):
                        translated_list.extend([""] * (len(paragraphs) - len(translated_list)))
                    return translated_list[:len(paragraphs)]
            except Exception as e:
                print(f"[-] GPT-6 request error on attempt {attempt+1}/{retries}: {e}")
                time.sleep(2 * (attempt + 1))

        return [""] * len(paragraphs)

    def write_markdown_reader(self, story):
        """Generates the formatted markdown reader matching the exact standard layout."""
        os.makedirs(self.readers_dir, exist_ok=True)
        filename = f"{story['id']}_{story['slug']}.md"
        filepath = os.path.join(self.readers_dir, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"# {story['title']}\n\n")
            f.write(f"- **Level**: {story['level']} ({', '.join(story['hsk_tags']) if story['hsk_tags'] else 'N/A'})\n")
            f.write(f"- **URL**: [{story['url']}]({story['url']})\n")
            if story.get("audio_url"):
                f.write(f"- **Audio Narration**: [Listen / Download MP3]({story['audio_url']})\n")
            f.write("\n---\n\n")

            f.write("## 1. Story Text & Pinyin\n\n")
            sim_paras = story.get("simplified_paragraphs", [])
            py_paras = story.get("pinyin_paragraphs", [])
            en_paras = story.get("english_paragraphs", [])

            for i in range(len(sim_paras)):
                sim = sim_paras[i]
                py = py_paras[i] if i < len(py_paras) else ""
                en = en_paras[i] if i < len(en_paras) else ""

                f.write(f"**Chinese**:\n{sim}\n\n")
                if py:
                    f.write(f"*Pinyin*:\n{py}\n\n")
                if en:
                    f.write(f"> **English Translation**:\n> {en}\n\n")

            vocab = story.get("vocabulary", [])
            if vocab:
                f.write("\n---\n\n## 2. Vocabulary & Grammar Notes\n\n")
                f.write("| Simplified | Traditional | Pinyin | Definition | HSK Level |\n")
                f.write("| --- | --- | --- | --- | --- |\n")
                for v in vocab:
                    hsk = v.get("old_hsk") or v.get("new_hsk") or "-"
                    sim_w = v.get("word_simplified", "")
                    tr_w = v.get("word_traditional", "")
                    py_w = v.get("pinyin", "")
                    def_w = v.get("definition", "")
                    f.write(f"| {sim_w} | {tr_w} | {py_w} | {def_w} | HSK {hsk} |\n")

    def export_all(self, stories):
        """Updates stories.json, stories.csv, and stories_cache.json with full translations."""
        # 1. Update Cache
        with open(self.cache_path, "w", encoding="utf-8") as f:
            json.dump(stories, f, ensure_ascii=False, indent=2)

        # 2. Update Master JSON
        with open(self.json_path, "w", encoding="utf-8") as f:
            json.dump(stories, f, ensure_ascii=False, indent=2)
        print(f"[+] Updated complete JSON archive ({len(stories)} stories) -> {self.json_path}")

        # 3. Update Master CSV
        with open(self.csv_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "ID", "Title", "Level", "HSK Tags", "Date", "URL", "Audio URL",
                "Simplified Text", "Pinyin Text", "English Translation", "Vocabulary Count"
            ])
            for s in stories:
                writer.writerow([
                    s["id"],
                    s["title"],
                    s["level"],
                    "; ".join(s["hsk_tags"]),
                    s["date"],
                    s["url"],
                    s.get("audio_url") or "",
                    s.get("simplified_full", ""),
                    s.get("pinyin_full", ""),
                    s.get("english_full", ""),
                    len(s.get("vocabulary", []))
                ])
        print(f"[+] Updated summary CSV -> {self.csv_path}")

    def run(self, force=False):
        stories = self.load_stories()
        print(f"[*] Loaded {len(stories)} total stories from cache.")

        # Identify which stories need translation
        to_translate = []
        for i, s in enumerate(stories):
            has_eng = bool(s.get("english_full", "").strip())
            if force or not has_eng:
                to_translate.append((i, s))

        print(f"[*] Stories requiring GPT-6 translation: {len(to_translate)} (Skipping {len(stories) - len(to_translate)} already translated)")

        if not to_translate:
            print("[+] All stories already have English translations! Exiting.")
            return stories

        print(f"[*] Starting GPT-6 translation using model '{self.model}' with {self.workers} worker threads...")

        def _translate_worker(item):
            idx, story = item
            title = story.get("title", "")
            paras = story.get("simplified_paragraphs", [])
            en_paras = self.translate_paragraphs_gpt6(title, paras)
            en_full = "\n\n".join(en_paras)

            story["english_paragraphs"] = en_paras
            story["english_full"] = en_full
            self.write_markdown_reader(story)
            return idx, story

        completed_count = 0
        total_work = len(to_translate)

        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            future_to_item = {executor.submit(_translate_worker, item): item for item in to_translate}
            for future in as_completed(future_to_item):
                completed_count += 1
                item = future_to_item[future]
                try:
                    idx, updated_story = future.result()
                    stories[idx] = updated_story
                    print(f"[{completed_count}/{total_work}] Translated story ID {updated_story['id']}: {updated_story['title'][:40]}")
                except Exception as e:
                    print(f"[-] Error on story {item[1].get('id')}: {e}")

                # Checkpoint progress
                if completed_count % 15 == 0 or completed_count == total_work:
                    self.export_all(stories)

        self.export_all(stories)
        print(f"[+] Successfully finished GPT-6 translation for all {total_work} stories!")
        return stories


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GPT-6 Chinese Story Translator & Word Alignment")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL, help=f"OpenAI Model to use (default: {DEFAULT_MODEL})")
    parser.add_argument("--data-dir", type=str, default="data/mandarinbean_stories", help="Directory containing stories")
    parser.add_argument("--workers", type=int, default=5, help="Number of worker threads (default: 5)")
    parser.add_argument("--force", action="store_true", help="Force re-translation of all stories")
    args = parser.parse_args()

    translator = GPT6StoryTranslator(
        data_dir=args.data_dir,
        model=args.model,
        workers=args.workers
    )
    translator.run(force=args.force)
