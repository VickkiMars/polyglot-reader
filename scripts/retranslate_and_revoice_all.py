#!/usr/bin/env python3
"""
Complete Batch Retranslation & Audio Regeneration Pipeline
==========================================================
1. English-to-Japanese Dictionary Grounding (ejdict.sqlite3)
2. GPT-4o-mini sentence-by-sentence natural learner translation
3. Morphological enrichment (Janome + pykakasi + jamdict) for ruby annotations & vocabulary
4. High-fidelity neural audio generation (ja-JP-NanamiNeural via edge-tts)
5. Metadata & Audio Sizes synchronization across the platform
"""

import os
import sys
import json
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Any
import edge_tts
from openai import OpenAI

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))

from scripts.japanese_dictionary import EnglishToJapaneseDictionary
import japanese_lexicon_enricher as enricher

JAPANESE_DETAILS_JSON = os.path.join(BASE_DIR, "src", "data", "japanese_details.json")
ALL_STORIES_JSON = os.path.join(BASE_DIR, "src", "data", "all_stories.json")
LOCAL_STORIES_JSON = os.path.join(BASE_DIR, "data", "japanese_stories", "stories.json")
AUDIO_SIZES_JSON = os.path.join(BASE_DIR, "src", "data", "audio_sizes.json")
RETRANSLATED_CACHE_JSON = os.path.join(BASE_DIR, "data", "retranslated_cache.json")
AUDIO_OUTPUT_DIR = os.path.join(BASE_DIR, "public", "audio", "japanese")

# Ensure directories exist
os.makedirs(os.path.dirname(RETRANSLATED_CACHE_JSON), exist_ok=True)
os.makedirs(AUDIO_OUTPUT_DIR, exist_ok=True)

# Load OpenAI API Key
OPENAI_API_KEY = None
for env_file in [os.path.join(BASE_DIR, ".env"), os.path.join(BASE_DIR, ".env.local")]:
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("OPENAI_API_KEY="):
                    OPENAI_API_KEY = line.split("=", 1)[1].strip()
                    break
    if OPENAI_API_KEY:
        break

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY not found in .env or .env.local")

client = OpenAI(api_key=OPENAI_API_KEY)
dictionary = EnglishToJapaneseDictionary()

SYSTEM_PROMPT = """You are an expert Japanese linguist and translator specializing in Japanese graded readers for language learners.
Translate the provided English story into natural, accurate, learner-friendly Japanese (JLPT aligned).
You are provided with English-to-Japanese dictionary grounding extracted from EJDict (46,000+ words).

CRITICAL REQUIREMENTS:
1. Translate paragraph-by-paragraph. The output 'japanese_paragraphs' must have the EXACT SAME NUMBER of paragraphs as the input English paragraphs.
2. Translate all sentences accurately without omitting any details.
3. For personal relations (e.g. 'I have a good friend named Martin'), translate faithfully (e.g. '私にはマーティンという名前の良い友達がいます' or '私にはマーティンという仲の良い友達がいます').
4. For proper names, use standard Katakana (e.g., 'Martin' -> 'マーティン', 'Dawei' -> 'ダーウェイ').
5. Provide matching hiragana readings in 'reading_paragraphs' for each paragraph with natural word spacing.
6. Output MUST be valid JSON matching:
{
  "japanese_paragraphs": ["..."],
  "reading_paragraphs": ["..."]
}"""


def translate_single_story(sid: str, story: Dict[str, Any], retries: int = 4) -> Dict[str, Any]:
    title = story.get("title", "")
    en_paras = story.get("english_paragraphs", [])
    if not en_paras and story.get("english_full"):
        en_paras = [p.strip() for p in story["english_full"].split("\n\n") if p.strip()]

    if not en_paras:
        return {
            "japanese_paragraphs": story.get("japanese_paragraphs", []),
            "reading_paragraphs": story.get("reading_paragraphs", [])
        }

    dict_context = dictionary.build_bilingual_prompt_context(en_paras)
    user_msg = f"Story Title: {title}\n\n{dict_context}\n\nEnglish Paragraphs:\n{json.dumps(en_paras, ensure_ascii=False, indent=2)}"

    for attempt in range(retries):
        try:
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg}
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
        except Exception as e:
            if attempt == retries - 1:
                print(f"[-] Translation failed for story {sid} after {retries} attempts: {e}")
                return {
                    "japanese_paragraphs": story.get("japanese_paragraphs", []),
                    "reading_paragraphs": story.get("reading_paragraphs", [])
                }
            time.sleep(2 * (attempt + 1))


def step1_retranslate_all_stories(data: Dict[str, Any]) -> Dict[str, Any]:
    print("\n=======================================================")
    print("STEP 1: Retranslating all stories using Dictionary + LLM")
    print("=======================================================")

    cache = {}
    if os.path.exists(RETRANSLATED_CACHE_JSON):
        try:
            with open(RETRANSLATED_CACHE_JSON, "r", encoding="utf-8") as f:
                cache = json.load(f)
            print(f"[*] Loaded {len(cache)} pre-translated stories from cache.")
        except Exception:
            cache = {}

    to_translate = {sid: s for sid, s in data.items() if sid not in cache}
    print(f"[*] Stories to translate: {len(to_translate)} / {len(data)}")

    if to_translate:
        t0 = time.time()
        completed = 0
        total = len(to_translate)

        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_sid = {
                executor.submit(translate_single_story, sid, story): sid
                for sid, story in to_translate.items()
            }

            for future in as_completed(future_to_sid):
                sid = future_to_sid[future]
                try:
                    res = future.result()
                    cache[sid] = res
                    completed += 1
                    if completed % 10 == 0 or completed == total:
                        print(f"[{completed}/{total}] Translated stories ({time.time() - t0:.1f}s elapsed)...")
                        with open(RETRANSLATED_CACHE_JSON, "w", encoding="utf-8") as f:
                            json.dump(cache, f, ensure_ascii=False, indent=2)
                except Exception as e:
                    print(f"[-] Error on story {sid}: {e}")

        with open(RETRANSLATED_CACHE_JSON, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
        print(f"[+] All {len(cache)} stories retranslated and cached in {time.time() - t0:.1f}s.")

    return cache


def step2_enrich_lexicon(data: Dict[str, Any], retranslated: Dict[str, Any]):
    print("\n=======================================================")
    print("STEP 2: Enriching Lexicon & Generating Ruby Annotations")
    print("=======================================================")
    t0 = time.time()
    total_vocab = 0

    for idx, (sid, story) in enumerate(data.items()):
        res = retranslated.get(sid, {})
        ja_paras = res.get("japanese_paragraphs") or story.get("japanese_paragraphs", [])
        rd_paras = res.get("reading_paragraphs") or story.get("reading_paragraphs", [])

        story["japanese_paragraphs"] = ja_paras
        story["reading_paragraphs"] = rd_paras

        # Run morphological analyzer
        vocab, ruby_paras = enricher.process_story(story, {})
        story["vocabulary"] = vocab
        story["ruby_paragraphs"] = ruby_paras
        total_vocab += len(vocab)

        if (idx + 1) % 50 == 0 or idx == len(data) - 1:
            print(f"[{idx + 1}/{len(data)}] Lexicon enriched ({time.time() - t0:.1f}s)...")

    # Save updated japanese_details.json
    with open(JAPANESE_DETAILS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[+] Saved {JAPANESE_DETAILS_JSON} (total vocab entries: {total_vocab})")

    # Update all_stories.json
    if os.path.exists(ALL_STORIES_JSON):
        with open(ALL_STORIES_JSON, "r", encoding="utf-8") as f:
            all_stories = json.load(f)

        for item in all_stories:
            sid_str = str(item.get("id"))
            if sid_str in data:
                s = data[sid_str]
                ja_p = s.get("japanese_paragraphs", [""])
                rd_p = s.get("reading_paragraphs", [""])
                char_prev = ja_p[0][:40] if ja_p else ""
                read_prev = rd_p[0][:40] if rd_p else ""
                item["japanese"] = {
                    "title": s.get("japanese_title", s.get("title")),
                    "character_preview": char_prev,
                    "reading_preview": read_prev,
                    "vocab_count": len(s.get("vocabulary", [])),
                    "para_count": len(ja_p)
                }

        with open(ALL_STORIES_JSON, "w", encoding="utf-8") as f:
            json.dump(all_stories, f, ensure_ascii=False, indent=2)
        print(f"[+] Synchronized {ALL_STORIES_JSON}")

    # Update local stories.json
    if os.path.exists(LOCAL_STORIES_JSON):
        stories_list = list(data.values())
        with open(LOCAL_STORIES_JSON, "w", encoding="utf-8") as f:
            json.dump(stories_list, f, ensure_ascii=False, indent=2)
        print(f"[+] Synchronized {LOCAL_STORIES_JSON}")


async def synthesize_single_audio(story: Dict[str, Any], sem: asyncio.Semaphore, voice: str, rate: str):
    sid = story["id"]
    slug = story.get("slug", str(sid))
    filename = f"{sid}_{slug}.mp3"
    out_path = os.path.join(AUDIO_OUTPUT_DIR, filename)

    paras = story.get("japanese_paragraphs", [])
    text = " ".join(paras).strip()
    if not text:
        return sid, False, 0

    async with sem:
        for attempt in range(3):
            try:
                comm = edge_tts.Communicate(text, voice, rate=rate)
                await comm.save(out_path)
                size = os.path.getsize(out_path)
                if size > 5000:
                    story["audio_url"] = f"/audio/japanese/{filename}"
                    return sid, True, size
                await asyncio.sleep(1.0)
            except Exception as e:
                if attempt == 2:
                    print(f"[-] TTS error for story {sid}: {e}")
                    return sid, False, 0
                await asyncio.sleep(1.0 * (attempt + 1))

    return sid, False, 0


async def step3_synthesize_all_audio(data: Dict[str, Any]):
    print("\n=======================================================")
    print("STEP 3: Synthesizing Neural Audio with edge-tts (Nanami)")
    print("=======================================================")
    t0 = time.time()
    sem = asyncio.Semaphore(8)
    voice = "ja-JP-NanamiNeural"
    rate = "-4%"

    tasks = [
        synthesize_single_audio(story, sem, voice, rate)
        for story in data.values()
    ]

    results = await asyncio.gather(*tasks)
    success_count = sum(1 for _, ok, _ in results if ok)
    print(f"[+] Audio synthesis complete: {success_count}/{len(data)} MP3 files generated in {time.time() - t0:.1f}s.")


def step4_update_audio_sizes():
    print("\n=======================================================")
    print("STEP 4: Recalculating audio_sizes.json")
    print("=======================================================")
    if not os.path.exists(AUDIO_SIZES_JSON):
        return

    with open(AUDIO_SIZES_JSON, "r", encoding="utf-8") as f:
        sizes_data = json.load(f)

    if "japanese" not in sizes_data:
        sizes_data["japanese"] = {}

    mp3_files = sorted([f for f in os.listdir(AUDIO_OUTPUT_DIR) if f.endswith(".mp3")])
    total_bytes = 0

    for f in mp3_files:
        p = os.path.join(AUDIO_OUTPUT_DIR, f)
        sz = os.path.getsize(p)
        sizes_data["japanese"][f] = sz
        total_bytes += sz

    with open(AUDIO_SIZES_JSON, "w", encoding="utf-8") as f:
        json.dump(sizes_data, f, ensure_ascii=False, indent=2)

    print(f"[+] Updated {AUDIO_SIZES_JSON}: {len(mp3_files)} files, {total_bytes / (1024*1024):.2f} MB total.")


def main():
    print("=== STARTING FULL RETRANSLATION & AUDIO PIPELINE ===")
    total_t0 = time.time()

    with open(JAPANESE_DETAILS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Retranslate all stories
    retranslated = step1_retranslate_all_stories(data)

    # 2. Enrich lexicon and ruby annotations
    step2_enrich_lexicon(data, retranslated)

    # 3. Synthesize neural audio
    asyncio.run(step3_synthesize_all_audio(data))

    # 4. Update audio sizes metadata
    step4_update_audio_sizes()

    # Verify Story 23410
    s23410 = data.get("23410", {})
    print("\n=======================================================")
    print("VERIFICATION: Story 23410 ('A Happy Day')")
    print("=======================================================")
    print("Title:", s23410.get("title"))
    print("Japanese text:", s23410.get("japanese_paragraphs", [""])[0][:150])
    print("Reading text:", s23410.get("reading_paragraphs", [""])[0][:150])
    print("Vocab count:", len(s23410.get("vocabulary", [])))
    print(f"\n[+] PIPELINE COMPLETED SUCCESSFULLY IN {time.time() - total_t0:.1f}s!")


if __name__ == "__main__":
    main()
