#!/usr/bin/env python3
"""
Complete Batch Russian Translation & Audio Generation Pipeline
==============================================================
1. English-to-Russian Dictionary Grounding (erdict.sqlite3)
2. GPT-4o-mini paragraph-by-paragraph natural learner translation
3. Morphological enrichment for ruby annotations & vocabulary (lemmas, grammar, TRKI levels)
4. High-fidelity neural audio generation (ru-RU-SvetlanaNeural via edge-tts)
5. Metadata & Audio Sizes synchronization across Polyglot Reader
"""

import os
import sys
import json
import time
import re
import html
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Any, Tuple
import edge_tts
from openai import OpenAI

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))

from scripts.russian_dictionary import EnglishToRussianDictionary

MANDARIN_DETAILS_JSON = os.path.join(BASE_DIR, "src", "data", "mandarin_details.json")
RUSSIAN_DETAILS_JSON = os.path.join(BASE_DIR, "src", "data", "russian_details.json")
ALL_STORIES_JSON = os.path.join(BASE_DIR, "src", "data", "all_stories.json")
LOCAL_STORIES_JSON = os.path.join(BASE_DIR, "data", "russian_stories", "stories.json")
AUDIO_SIZES_JSON = os.path.join(BASE_DIR, "src", "data", "audio_sizes.json")
TRANSLATIONS_CACHE_JSON = os.path.join(BASE_DIR, "data", "russian_stories", "russian_translations_cache.json")
PUBLIC_STORIES_DIR = os.path.join(BASE_DIR, "public", "stories", "russian")
AUDIO_OUTPUT_DIR = os.path.join(BASE_DIR, "public", "audio", "russian")

os.makedirs(os.path.dirname(LOCAL_STORIES_JSON), exist_ok=True)
os.makedirs(PUBLIC_STORIES_DIR, exist_ok=True)
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
dictionary = EnglishToRussianDictionary()

SYSTEM_PROMPT = """You are an expert Russian linguist and pedagogue specializing in Russian graded readers for foreign language learners (ТРКИ / CEFR aligned).
Translate the provided English story into natural, accurate, learner-friendly Russian.
You are provided with English-to-Russian dictionary grounding with stress marks (U+0301).

CRITICAL REQUIREMENTS:
1. Translate paragraph-by-paragraph. 'russian_paragraphs' must have the EXACT SAME NUMBER of paragraphs as input English paragraphs.
2. Accurately translate all sentences without omitting details.
3. Put acute accent marks (\u0301) on the stressed vowel of every multi-syllable Russian word (e.g., студе́нт, краси́вый, сего́дня). Single-syllable words like 'он', 'мы', 'чай', 'день' do not need an accent.
4. For Chinese proper names:
   - 'Dawei' -> 'Давэ́й' (never translate as 'Давай'!)
   - 'Martin' -> 'Ма́ртин'
   - 'Beijing' -> 'Пеки́н'
   - 'China' -> 'Кита́й'
5. For traditional Chinese dishes:
   - 'baozi' / 'buns' -> 'паровы́е бу́лочки (ба́оцзы)' or 'бу́лочки'
   - 'dumplings' / 'jiaozi' -> 'пельме́ни (цзя́оцзы)' or 'пельме́ни'
   - 'noodles' -> 'лапша́'
6. Provide Latin transliteration in 'reading_paragraphs' for each paragraph with accents on stressed vowels.
7. Provide a learner-appropriate Russian title with stress mark in 'russian_title'.
8. Assign appropriate CEFR level ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') in 'torfl_level'.
9. Output valid JSON:
{
  "russian_title": "...",
  "torfl_level": "A1",
  "russian_paragraphs": ["..."],
  "reading_paragraphs": ["..."]
}"""


def translate_single_story(sid: str, story: Dict[str, Any], retries: int = 4) -> Dict[str, Any]:
    title = story.get("title", "")
    en_paras = story.get("english_paragraphs", [])
    if not en_paras and story.get("english_full"):
        en_paras = [p.strip() for p in story["english_full"].split("\n\n") if p.strip()]

    if not en_paras:
        return {
            "russian_title": title,
            "torfl_level": "A1",
            "russian_paragraphs": [],
            "reading_paragraphs": []
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
                max_tokens=3000
            )
            data = json.loads(resp.choices[0].message.content)
            ru_paras = data.get("russian_paragraphs", [])
            rd_paras = data.get("reading_paragraphs", [])

            if len(ru_paras) < len(en_paras):
                ru_paras.extend([""] * (len(en_paras) - len(ru_paras)))
            if len(rd_paras) < len(en_paras):
                rd_paras.extend([""] * (len(en_paras) - len(rd_paras)))

            return {
                "russian_title": data.get("russian_title", title),
                "torfl_level": data.get("torfl_level", "A1"),
                "russian_paragraphs": ru_paras[:len(en_paras)],
                "reading_paragraphs": rd_paras[:len(en_paras)]
            }
        except Exception as e:
            if attempt == retries - 1:
                print(f"[-] Translation failed for story {sid} after {retries} attempts: {e}")
                return {
                    "russian_title": title,
                    "torfl_level": "A1",
                    "russian_paragraphs": [],
                    "reading_paragraphs": []
                }
            time.sleep(2 * (attempt + 1))


def step1_translate_all(base_data: Dict[str, Any]) -> Dict[str, Any]:
    print("\n=======================================================")
    print("STEP 1: Translating all 206 stories to Russian (LLM + ERDict)")
    print("=======================================================")

    cache = {}
    if os.path.exists(TRANSLATIONS_CACHE_JSON):
        try:
            with open(TRANSLATIONS_CACHE_JSON, "r", encoding="utf-8") as f:
                cache = json.load(f)
            print(f"[*] Loaded {len(cache)} pre-translated stories from cache.")
        except Exception:
            cache = {}

    to_translate = {sid: s for sid, s in base_data.items() if sid not in cache or not cache[sid].get("russian_paragraphs")}
    print(f"[*] Stories to translate: {len(to_translate)} / {len(base_data)}")

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
                        with open(TRANSLATIONS_CACHE_JSON, "w", encoding="utf-8") as f:
                            json.dump(cache, f, ensure_ascii=False, indent=2)
                except Exception as e:
                    print(f"[-] Error on story {sid}: {e}")

        with open(TRANSLATIONS_CACHE_JSON, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
        print(f"[+] All {len(cache)} stories translated and cached in {time.time() - t0:.1f}s.")

    return cache


CYRILLIC_TO_LATIN = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': "'", 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
    'Ъ': '', 'Ы': 'Y', 'Ь': "'", 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
}

def transliterate(word: str) -> str:
    res = []
    i = 0
    while i < len(word):
        ch = word[i]
        if ch == '\u0301':
            res.append('\u0301')
        elif ch in CYRILLIC_TO_LATIN:
            res.append(CYRILLIC_TO_LATIN[ch])
        else:
            res.append(ch)
        i += 1
    return "".join(res)


def step2_enrich_russian_lexicon(base_data: Dict[str, Any], translations: Dict[str, Any]) -> Dict[str, Any]:
    print("\n=======================================================")
    print("STEP 2: Enriching Russian Lexicon, Ruby Tokens & Vocab")
    print("=======================================================")
    t0 = time.time()
    russian_details = {}

    for idx, (sid, base_story) in enumerate(base_data.items()):
        trans = translations.get(sid, {})
        ru_paras = trans.get("russian_paragraphs", [])
        rd_paras = trans.get("reading_paragraphs", [])
        ru_title = trans.get("russian_title", base_story.get("title", ""))
        torfl = trans.get("torfl_level", "A1")

        # Process words and build ruby annotations
        ruby_paragraphs = []
        story_vocab_map = {}
        story_vocab_list = []

        for p_idx, para in enumerate(ru_paras):
            # Tokenize words vs punctuation/spacing
            # Split by word boundaries while keeping symbols
            tokens = re.findall(r"[\w\u0301-]+|[^\w\s\u0301-]+|\s+", para)
            annotated_tokens = []

            for tok in tokens:
                clean_tok = tok.strip()
                if not clean_tok or re.match(r"^[^\w\u0301]+$", clean_tok):
                    annotated_tokens.append(tok)
                    continue

                # Strip stress for dictionary lookup
                unaccented = clean_tok.replace("\u0301", "").lower()
                dict_entry = dictionary.translate_word(unaccented)
                
                # Reading transliteration
                translit = transliterate(clean_tok)
                definition = dict_entry["russian_gloss"] if dict_entry else ""
                if not definition:
                    # Fallback reverse gloss if possible
                    definition = unaccented

                # Escapes
                safe_word = html.escape(clean_tok)
                safe_translit = html.escape(translit)
                safe_defn = html.escape(definition)

                ruby_tag = f'<ruby class="mb-tooltip" data-py="{safe_translit}" data-defn="{safe_defn}" data-hsk="{torfl}"><span class="si">{safe_word}</span><rt>{safe_translit}</rt></ruby>'
                annotated_tokens.append(ruby_tag)

                # Add to vocab table
                if unaccented not in story_vocab_map and len(unaccented) > 1:
                    item = {
                        "word": clean_tok,
                        "reading": translit,
                        "translation": definition,
                        "torfl": torfl,
                        "hsk": torfl
                    }
                    story_vocab_map[unaccented] = item
                    story_vocab_list.append(item)

            ruby_paragraphs.append("".join(annotated_tokens))

        slug = base_story.get("slug", str(sid))
        audio_filename = f"{sid}_{slug}.mp3"

        detailed_story = {
            "id": int(sid),
            "title": base_story.get("title", ""),
            "russian_title": ru_title,
            "level": base_story.get("level", "Beginner"),
            "torfl_level": torfl,
            "hsk_tags": [torfl],
            "slug": slug,
            "audio_url": f"/audio/russian/{audio_filename}",
            "english_paragraphs": base_story.get("english_paragraphs", []),
            "english_full": base_story.get("english_full", ""),
            "russian_paragraphs": ru_paras,
            "reading_paragraphs": rd_paras,
            "ruby_paragraphs": ruby_paragraphs,
            "vocabulary": story_vocab_list
        }

        russian_details[sid] = detailed_story

        # Save individual story JSON to public/stories/russian/{id}.json
        pub_story_path = os.path.join(PUBLIC_STORIES_DIR, f"{sid}.json")
        with open(pub_story_path, "w", encoding="utf-8") as f:
            json.dump(detailed_story, f, ensure_ascii=False, indent=2)

    # Save bundled src/data/russian_details.json
    with open(RUSSIAN_DETAILS_JSON, "w", encoding="utf-8") as f:
        json.dump(russian_details, f, ensure_ascii=False, indent=2)
    print(f"[+] Saved {RUSSIAN_DETAILS_JSON} ({len(russian_details)} stories)")

    # Save data/russian_stories/stories.json
    with open(LOCAL_STORIES_JSON, "w", encoding="utf-8") as f:
        json.dump(list(russian_details.values()), f, ensure_ascii=False, indent=2)
    print(f"[+] Saved {LOCAL_STORIES_JSON}")

    # Synchronize src/data/all_stories.json
    if os.path.exists(ALL_STORIES_JSON):
        with open(ALL_STORIES_JSON, "r", encoding="utf-8") as f:
            all_stories = json.load(f)

        for item in all_stories:
            sid_str = str(item.get("id"))
            if sid_str in russian_details:
                s = russian_details[sid_str]
                ru_p = s.get("russian_paragraphs", [""])
                rd_p = s.get("reading_paragraphs", [""])
                char_prev = ru_p[0][:40] if ru_p else ""
                read_prev = rd_p[0][:40] if rd_p else ""

                if "audio" not in item:
                    item["audio"] = {}
                item["audio"]["russian"] = s.get("audio_url", f"/audio/russian/{sid_str}_{item.get('slug')}.mp3")

                item["russian"] = {
                    "title": s.get("russian_title", item.get("title")),
                    "character_preview": char_prev,
                    "reading_preview": read_prev,
                    "vocab_count": len(s.get("vocabulary", [])),
                    "para_count": len(ru_p)
                }

        with open(ALL_STORIES_JSON, "w", encoding="utf-8") as f:
            json.dump(all_stories, f, ensure_ascii=False, indent=2)
        print(f"[+] Synchronized {ALL_STORIES_JSON} with Russian catalog metadata")

    return russian_details


async def synthesize_single_audio(story: Dict[str, Any], sem: asyncio.Semaphore, voice: str, rate: str):
    sid = story["id"]
    slug = story.get("slug", str(sid))
    filename = f"{sid}_{slug}.mp3"
    out_path = os.path.join(AUDIO_OUTPUT_DIR, filename)

    # If file already exists and > 10KB, skip to save time and bandwidth
    if os.path.exists(out_path) and os.path.getsize(out_path) > 10000:
        return sid, True, os.path.getsize(out_path)

    paras = story.get("russian_paragraphs", [])
    raw_text = " ".join(paras).strip()
    if not raw_text:
        return sid, False, 0

    # Clean text without stress accents for pristine TTS prosody
    clean_text = raw_text.replace("\u0301", "")

    async with sem:
        for attempt in range(4):
            try:
                comm = edge_tts.Communicate(clean_text, voice, rate=rate)
                await asyncio.wait_for(comm.save(out_path), timeout=20.0)
                size = os.path.getsize(out_path)
                if size > 5000:
                    return sid, True, size
                await asyncio.sleep(1.0)
            except Exception as e:
                if attempt == 3:
                    print(f"[-] TTS error for story {sid}: {e}")
                    return sid, False, 0
                await asyncio.sleep(1.5 * (attempt + 1))

    return sid, False, 0


async def step3_synthesize_all_audio(russian_details: Dict[str, Any]):
    print("\n=======================================================")
    print("STEP 3: Synthesizing Neural Russian Audio (ru-RU-Svetlana)")
    print("=======================================================")
    t0 = time.time()
    sem = asyncio.Semaphore(6)
    voice = "ru-RU-SvetlanaNeural"
    rate = "-4%"

    completed = 0
    total = len(russian_details)

    async def track(story):
        nonlocal completed
        sid, ok, sz = await synthesize_single_audio(story, sem, voice, rate)
        completed += 1
        if completed % 15 == 0 or completed == total:
            print(f"[{completed}/{total}] Audio generated ({time.time() - t0:.1f}s elapsed)...")
        return sid, ok, sz

    tasks = [track(story) for story in russian_details.values()]
    results = await asyncio.gather(*tasks)
    success_count = sum(1 for _, ok, _ in results if ok)
    print(f"[+] Russian neural audio generated: {success_count}/{len(russian_details)} MP3 files in {time.time() - t0:.1f}s.")


def step4_update_audio_sizes():
    print("\n=======================================================")
    print("STEP 4: Updating audio_sizes.json with Russian MP3s")
    print("=======================================================")
    if not os.path.exists(AUDIO_SIZES_JSON):
        return

    with open(AUDIO_SIZES_JSON, "r", encoding="utf-8") as f:
        sizes_data = json.load(f)

    if "russian" not in sizes_data:
        sizes_data["russian"] = {}

    mp3_files = sorted([f for f in os.listdir(AUDIO_OUTPUT_DIR) if f.endswith(".mp3")])
    total_bytes = 0

    for f in mp3_files:
        p = os.path.join(AUDIO_OUTPUT_DIR, f)
        sz = os.path.getsize(p)
        sizes_data["russian"][f] = sz
        total_bytes += sz

    with open(AUDIO_SIZES_JSON, "w", encoding="utf-8") as f:
        json.dump(sizes_data, f, ensure_ascii=False, indent=2)

    print(f"[+] Updated {AUDIO_SIZES_JSON}: {len(mp3_files)} Russian MP3s ({total_bytes / (1024*1024):.2f} MB total).")


def main():
    print("=== STARTING COMPLETE RUSSIAN PIPELINE (TEXT FIRST -> AUDIO SYNTHESIS) ===")
    total_t0 = time.time()

    with open(MANDARIN_DETAILS_JSON, "r", encoding="utf-8") as f:
        base_data = json.load(f)

    # 1. Translate all stories
    translations = step1_translate_all(base_data)

    # 2. Enrich Russian lexicon, pre-render ruby paragraphs and vocabulary
    russian_details = step2_enrich_russian_lexicon(base_data, translations)

    # 3. Synthesize neural audio
    asyncio.run(step3_synthesize_all_audio(russian_details))

    # 4. Update audio sizes metadata
    step4_update_audio_sizes()

    print(f"\n[+] RUSSIAN PIPELINE COMPLETED SUCCESSFULLY IN {time.time() - total_t0:.1f}s!")


if __name__ == "__main__":
    main()
