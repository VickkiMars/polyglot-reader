#!/usr/bin/env python3
"""
Dictionary-to-GPT-6 Japanese Audio Generation & Synchronization Pipeline
========================================================================
1. English-to-Japanese Dictionary Translation:
   - Takes English story texts and uses the downloaded EJDict SQLite database
     to perform lexical translation and extract bilingual dictionary grounding.
2. GPT-6 Translation & Phonetic Alignment:
   - Feeds the dictionary-grounded Japanese vocabulary and English text into GPT-6
     (model: gpt-6-sol) to synthesize natural, learner-aligned Japanese graded text.
3. Neural Audio Narration Synthesis:
   - Feeds the verified Japanese script into the OpenAI Neural Audio engine
     (model: gpt-4o-mini-tts / tts-1, voice: alloy / nova) to generate high-fidelity MP3s.
4. Complete Audio Replacement:
   - Safely archives the previous audio to audio_backup_previous/.
   - Removes previous audio files and replaces them with the new neural audio.
   - Updates audio_sizes.json, stories.json, japanese_details.json, readers, and JS bundles.
"""

import os
import re
import json
import time
import shutil
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Any, Optional
import openai
from openai import OpenAI

# Paths
BASE_PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
DESKTOP_LANGUAGE_DIR = "/home/kami/Desktop/codebase/language"
JAPANESE_AUDIO_DIR = os.path.join(DESKTOP_LANGUAGE_DIR, "japanese", "audio")
JAPANESE_BACKUP_DIR = os.path.join(DESKTOP_LANGUAGE_DIR, "japanese", "audio_backup_previous")
JAPANESE_STORIES_JSON = os.path.join(DESKTOP_LANGUAGE_DIR, "japanese", "stories.json")
JAPANESE_READERS_DIR = os.path.join(DESKTOP_LANGUAGE_DIR, "japanese", "readers")
JAPANESE_JS = os.path.join(DESKTOP_LANGUAGE_DIR, "stories_japanese.js")

LOCAL_STORIES_JSON = os.path.join(BASE_PROJECT_DIR, "data", "japanese_stories", "stories.json")
LOCAL_DETAILS_JSON = os.path.join(BASE_PROJECT_DIR, "src", "data", "japanese_details.json")
ALL_STORIES_JSON = os.path.join(BASE_PROJECT_DIR, "src", "data", "all_stories.json")
AUDIO_SIZES_JSON = os.path.join(BASE_PROJECT_DIR, "src", "data", "audio_sizes.json")

# Import the English-to-Japanese Dictionary Engine
from scripts.japanese_dictionary import EnglishToJapaneseDictionary

# Load Environment Variables for OpenAI
ENV_PATHS = [
    os.path.join(BASE_PROJECT_DIR, ".env"),
    os.path.join(BASE_PROJECT_DIR, ".env.local"),
    "/home/kami/Desktop/codebase/sental/translation_sandbox/.env"
]

def load_environment():
    for p in ENV_PATHS:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip())

load_environment()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-6-sol")
TTS_MODEL = os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
TTS_VOICE = os.environ.get("OPENAI_TTS_VOICE", "alloy")


GPT6_PROMPT = """You are an expert Japanese linguist and educator specializing in Japanese graded readers for language learners.
Given a story's English paragraphs and English-to-Japanese dictionary translation grounding, refine and produce natural, idiomatic, and engaging Japanese text.

Requirements:
1. Translate paragraph-by-paragraph matching the exact paragraph count of the English input.
2. Return strictly valid JSON matching this schema:
{
  "japanese_paragraphs": [
    "Japanese paragraph 1...",
    "Japanese paragraph 2..."
  ],
  "reading_paragraphs": [
    "Reading in hiragana with natural spacing for paragraph 1...",
    "Reading in hiragana with natural spacing for paragraph 2..."
  ]
}
Ensure natural rhythm, accurate kanji/kana orthography, and clear sentence structure.
"""


class DictionaryAudioPipeline:
    def __init__(self, model=OPENAI_MODEL, tts_model=TTS_MODEL, voice=TTS_VOICE, workers=8):
        self.model = model
        self.tts_model = tts_model
        self.voice = voice
        self.workers = workers
        self.dictionary = EnglishToJapaneseDictionary()
        self.client = OpenAI(api_key=OPENAI_API_KEY)

        os.makedirs(JAPANESE_AUDIO_DIR, exist_ok=True)
        os.makedirs(JAPANESE_BACKUP_DIR, exist_ok=True)

    def load_stories(self) -> List[Dict[str, Any]]:
        target_path = JAPANESE_STORIES_JSON if os.path.exists(JAPANESE_STORIES_JSON) else LOCAL_STORIES_JSON
        with open(target_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def translate_with_dictionary_and_gpt6(self, story: Dict[str, Any], retries: int = 4) -> Dict[str, Any]:
        """
        Translates English paragraphs to Japanese using the downloaded dictionary
        as lexical grounding, then feeding into GPT-6.
        """
        title = story.get("title", "")
        en_paras = story.get("english_paragraphs", [])
        if not en_paras and story.get("english_full"):
            en_paras = [p.strip() for p in story["english_full"].split("\n\n") if p.strip()]

        if not en_paras:
            return {
                "japanese_paragraphs": story.get("japanese_paragraphs", []),
                "reading_paragraphs": story.get("reading_paragraphs", [])
            }

        # 1. Ground English text with English-to-Japanese Dictionary
        dict_context = self.dictionary.build_bilingual_prompt_context(en_paras)

        user_content = f"Story Title: {title}\n\n{dict_context}\n\nEnglish Paragraphs:\n"
        user_content += json.dumps(en_paras, ensure_ascii=False, indent=2)

        for attempt in range(retries):
            try:
                resp = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": GPT6_PROMPT},
                        {"role": "user", "content": user_content}
                    ],
                    response_format={"type": "json_object"},
                    max_completion_tokens=2500
                )
                data = json.loads(resp.choices[0].message.content)
                ja_paras = data.get("japanese_paragraphs", [])
                rd_paras = data.get("reading_paragraphs", [])

                if len(ja_paras) < len(en_paras):
                    ja_paras.extend([""] * (len(en_paras) - len(ja_paras)))
                if len(rd_paras) < len(en_paras):
                    rd_paras.extend([""] * (len(en_paras) - len(rd_paras)))

                return {
                    "japanese_paragraphs": ja_paras[:len(en_paras)],
                    "reading_paragraphs": rd_paras[:len(en_paras)]
                }
            except openai.RateLimitError as rle:
                wait_sec = 4 * (attempt + 1)
                print(f"[-] Rate limit encountered on story {story.get('id')}, backing off for {wait_sec}s...")
                time.sleep(wait_sec)
            except Exception as e:
                print(f"[-] GPT-6 translation retry {attempt+1}/{retries} on story {story.get('id')}: {e}")
                time.sleep(2 * (attempt + 1))

        # Fallback to existing japanese_paragraphs if API failed
        return {
            "japanese_paragraphs": story.get("japanese_paragraphs", []),
            "reading_paragraphs": story.get("reading_paragraphs", [])
        }

    def generate_neural_audio(self, text: str, retries: int = 4) -> Optional[bytes]:
        """Synthesizes high-fidelity neural audio using OpenAI TTS."""
        if not text.strip():
            return None

        for attempt in range(retries):
            try:
                resp = self.client.audio.speech.create(
                    model=self.tts_model,
                    voice=self.voice,
                    input=text
                )
                return resp.content
            except openai.RateLimitError:
                wait_sec = 4 * (attempt + 1)
                print(f"[-] TTS rate limit, backing off for {wait_sec}s...")
                time.sleep(wait_sec)
            except Exception as e:
                print(f"[-] TTS audio synthesis retry {attempt+1}/{retries}: {e}")
                time.sleep(2 * (attempt + 1))
        return None

    def backup_previous_audio(self):
        """Archives all existing Japanese audio files to audio_backup_previous/."""
        existing_files = [f for f in os.listdir(JAPANESE_AUDIO_DIR) if f.endswith(".mp3")]
        if not existing_files:
            print("[*] No active Japanese audio files found to backup.")
            return

        print(f"[*] Backing up {len(existing_files)} audio files to {JAPANESE_BACKUP_DIR}...")
        for f in existing_files:
            src = os.path.join(JAPANESE_AUDIO_DIR, f)
            dst = os.path.join(JAPANESE_BACKUP_DIR, f)
            shutil.copy2(src, dst)
        print(f"[+] Backup complete: {len(existing_files)} files archived safely.")

    def remove_previous_audio(self):
        """Removes previous audio files from the active audio directory."""
        existing_files = [f for f in os.listdir(JAPANESE_AUDIO_DIR) if f.endswith(".mp3")]
        if existing_files:
            print(f"[*] Removing {len(existing_files)} previous audio files from {JAPANESE_AUDIO_DIR}...")
            for f in existing_files:
                os.remove(os.path.join(JAPANESE_AUDIO_DIR, f))
            print("[+] Previous audio files removed. Ready for new audio generation.")

    def update_audio_sizes_metadata(self):
        """Recalculates exact file sizes for src/data/audio_sizes.json."""
        if not os.path.exists(AUDIO_SIZES_JSON):
            return

        with open(AUDIO_SIZES_JSON, "r", encoding="utf-8") as f:
            sizes_data = json.load(f)

        if "japanese" not in sizes_data:
            sizes_data["japanese"] = {}

        mp3_files = sorted([f for f in os.listdir(JAPANESE_AUDIO_DIR) if f.endswith(".mp3")])
        updated_count = 0
        total_bytes = 0

        for f in mp3_files:
            f_path = os.path.join(JAPANESE_AUDIO_DIR, f)
            f_size = os.path.getsize(f_path)
            sizes_data["japanese"][f] = f_size
            total_bytes += f_size
            updated_count += 1

        with open(AUDIO_SIZES_JSON, "w", encoding="utf-8") as f:
            json.dump(sizes_data, f, indent=2, ensure_ascii=False)

        print(f"[+] Updated {AUDIO_SIZES_JSON}: {updated_count} files, {total_bytes / (1024*1024):.2f} MB total.")

    def update_markdown_readers(self, stories: List[Dict[str, Any]]):
        if not os.path.exists(JAPANESE_READERS_DIR):
            return
        updated = 0
        for s in stories:
            sid = s["id"]
            slug = s.get("slug", str(sid))
            md_path = os.path.join(JAPANESE_READERS_DIR, f"{sid}_{slug}.md")
            if not os.path.exists(md_path):
                continue
            with open(md_path, "r", encoding="utf-8") as f:
                content = f.read()

            audio_target = f"audio/{sid}_{slug}.mp3"
            new_content = re.sub(
                r'-\s*\*\*Audio Narration\*\*:[^\n]+',
                f'- **Audio Narration**: [Listen / Download MP3]({audio_target})',
                content
            )
            new_content = re.sub(
                r'-\s*\*\*Narration Audio\*\*:[^\n]+',
                f'- **Narration Audio**: [Listen / Download MP3]({audio_target})',
                new_content
            )
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            updated += 1
        print(f"[+] Updated audio links in {updated} Markdown reader files.")

    def update_details_json(self, updated_stories: List[Dict[str, Any]]):
        """Updates src/data/japanese_details.json with updated audio urls."""
        if not os.path.exists(LOCAL_DETAILS_JSON):
            return

        try:
            with open(LOCAL_DETAILS_JSON, "r", encoding="utf-8") as f:
                details = json.load(f)

            for s in updated_stories:
                sid_str = str(s["id"])
                if sid_str in details:
                    details[sid_str]["audio_url"] = f"/audio/japanese/{s['id']}_{s.get('slug', str(s['id']))}.mp3"
                    if "japanese_paragraphs" in s:
                        details[sid_str]["japanese_paragraphs"] = s["japanese_paragraphs"]

            with open(LOCAL_DETAILS_JSON, "w", encoding="utf-8") as f:
                json.dump(details, f, indent=2, ensure_ascii=False)
            print(f"[+] Updated {LOCAL_DETAILS_JSON} with new audio URLs.")
        except Exception as e:
            print(f"[-] Warning updating details json: {e}")

    def run(self, limit: Optional[int] = None, skip_translate: bool = False, force: bool = False):
        t0 = time.time()
        stories = self.load_stories()
        print(f"[*] Loaded {len(stories)} total stories from Japanese database.")

        to_process = stories[:limit] if limit else stories
        print(f"[*] Selected {len(to_process)} stories for processing.")

        # 1. Backup previous audio (if not already backed up)
        backup_count = len([f for f in os.listdir(JAPANESE_BACKUP_DIR) if f.endswith(".mp3")])
        if backup_count == 0:
            self.backup_previous_audio()
        else:
            print(f"[*] Existing backup verified: {backup_count} files in {JAPANESE_BACKUP_DIR}")

        if force:
            self.remove_previous_audio()

        print(f"[*] Launching generation pipeline using GPT-6 ('{self.model}') and TTS ('{self.tts_model}', voice: '{self.voice}') with {self.workers} workers...")

        def _process_story(story):
            sid = story["id"]
            slug = story.get("slug", str(sid))
            filename = f"{sid}_{slug}.mp3"
            out_path = os.path.join(JAPANESE_AUDIO_DIR, filename)

            # Check if already generated in this run
            if not force and os.path.exists(out_path) and os.path.getsize(out_path) > 10000:
                story["audio_url"] = f"japanese/audio/{filename}"
                return sid, True, os.path.getsize(out_path), filename, True

            # Step A: Translate with Dictionary + GPT-6
            if not skip_translate:
                translation = self.translate_with_dictionary_and_gpt6(story)
                story["japanese_paragraphs"] = translation["japanese_paragraphs"]
                story["reading_paragraphs"] = translation["reading_paragraphs"]
                story["japanese_full"] = "\n\n".join(translation["japanese_paragraphs"])
                story["reading_full"] = "\n\n".join(translation["reading_paragraphs"])

            # Step B: Synthesize Neural Audio
            ja_text = " ".join(story.get("japanese_paragraphs", []))
            if not ja_text and story.get("japanese_full"):
                ja_text = story["japanese_full"]

            audio_bytes = self.generate_neural_audio(ja_text)
            if audio_bytes:
                with open(out_path, "wb") as af:
                    af.write(audio_bytes)
                story["audio_url"] = f"japanese/audio/{filename}"
                return sid, True, len(audio_bytes), filename, False
            else:
                return sid, False, 0, filename, False

        completed = 0
        total = len(to_process)
        success_count = 0

        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            future_to_story = {executor.submit(_process_story, s): s for s in to_process}
            for future in as_completed(future_to_story):
                completed += 1
                sid, success, byte_len, filename, was_cached = future.result()
                if success:
                    success_count += 1
                    status = "Ready (Cached)" if was_cached else "Synthesized"
                    print(f"[{completed}/{total}] Story {sid} -> {status}: {filename} ({byte_len:,} bytes)")
                else:
                    print(f"[{completed}/{total}] Story {sid} -> Failed to generate audio for {filename}")

                if completed % 20 == 0 or completed == total:
                    self.update_audio_sizes_metadata()

        # 3. Update Details JSON, Readers, and Datasets
        self.update_details_json(to_process)
        self.update_markdown_readers(to_process)
        self.update_audio_sizes_metadata()

        # Build story map to update original stories list
        story_map = {s["id"]: s for s in to_process}
        full_stories = [story_map.get(s["id"], s) for s in stories]

        for target_file in [JAPANESE_STORIES_JSON, LOCAL_STORIES_JSON]:
            if os.path.exists(os.path.dirname(target_file)):
                with open(target_file, "w", encoding="utf-8") as f:
                    json.dump(full_stories, f, indent=2, ensure_ascii=False)
                print(f"[+] Updated dataset: {target_file}")

        if os.path.exists(JAPANESE_JS):
            with open(JAPANESE_JS, "w", encoding="utf-8") as f:
                f.write("window.JAPANESE_STORIES = " + json.dumps(full_stories, ensure_ascii=False) + ";")
            print(f"[+] Updated JavaScript bundle: {JAPANESE_JS}")

        print(f"\n=======================================================")
        print(f"SUCCESS: Pipeline completed in {time.time() - t0:.1f}s!")
        print(f"New audio generated & synchronized: {success_count}/{total} stories.")
        print(f"Previous audio safely backed up in: {JAPANESE_BACKUP_DIR}")
        print(f"Active audio live in: {JAPANESE_AUDIO_DIR}")
        print(f"=======================================================\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Japanese Dictionary + GPT-6 Audio Replacement Pipeline")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of stories to process")
    parser.add_argument("--workers", type=int, default=8, help="Number of worker threads (default: 8)")
    parser.add_argument("--skip-translate", action="store_true", help="Skip GPT-6 text re-generation and only synthesize audio")
    parser.add_argument("--force", action="store_true", help="Force regenerate audio even if file exists")
    parser.add_argument("--voice", type=str, default="alloy", help="OpenAI TTS voice (default: alloy)")
    parser.add_argument("--model", type=str, default=OPENAI_MODEL, help=f"GPT model (default: {OPENAI_MODEL})")
    args = parser.parse_args()

    pipeline = DictionaryAudioPipeline(
        model=args.model,
        voice=args.voice,
        workers=args.workers
    )
    pipeline.run(limit=args.limit, skip_translate=args.skip_translate, force=args.force)
