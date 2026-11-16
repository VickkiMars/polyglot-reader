#!/usr/bin/env python3
"""
Comprehensive Play Translations Fixer:
Scans all 6 plays in src/data/plays/*.json, identifies every chunk with missing,
empty, or Japanese-fallback English text, translates via OpenAI gpt-4o-mini in contextual batches,
verifies English quality, and synchronizes both src/data/plays/ and public/plays/.
"""

import os
import sys
import json
import re
import urllib.request
import urllib.error
import time

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PLAYS_DIR = os.path.join(PROJECT_ROOT, "src", "data", "plays")
PUB_PLAYS_DIR = os.path.join(PROJECT_ROOT, "public", "plays")

# Load OpenAI key
key = os.environ.get("OPENAI_API_KEY")
if not key:
    env_file = os.path.join(PROJECT_ROOT, ".env")
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                if line.startswith("OPENAI_API_KEY"):
                    key = line.split("=", 1)[1].strip()
                    break

if not key:
    raise ValueError("OPENAI_API_KEY not found in environment or .env")

def is_japanese(text):
    if not text:
        return False
    cjk = len(re.findall(r'[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]', text))
    return cjk > 0 and (cjk / max(1, len(text.strip()))) > 0.15

def call_openai_chat(messages, retries=3):
    payload = json.dumps({
        "model": "gpt-4o-mini",
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.2
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}"
        }
    )

    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            print(f"  [Attempt {attempt+1}] HTTP {e.code}: {err_body}")
            if attempt == retries - 1:
                raise e
            time.sleep(3 * (attempt + 1))
        except Exception as e:
            print(f"  [Attempt {attempt+1}] Error: {e}")
            if attempt == retries - 1:
                raise e
            time.sleep(3 * (attempt + 1))

PLAY_TITLES = {
    "kamifusen": "Paper Balloon (Kunio Kishida)",
    "itsutaka": "Always by the Window, We Are (Naoyuki Miura)",
    "highway": "Highway Smoke (Ryu Motohashi)",
    "lion": "Where the Lion Is (Kenshi Nakamura)",
    "hansuu": "Rumination (Nodoka Matsui)",
    "nemurenai": "No Night Without Sleep (Oriza Hirata)"
}

def translate_batch(play_id, items):
    title = PLAY_TITLES.get(play_id, play_id)
    system_prompt = (
        f"You are an expert theatrical dramaturg and translator translating the modern Japanese play '{title}' into stage-worthy, natural English.\n"
        "Translate each item with dramatic fidelity, preserving character voices, colloquial nuance, and theatrical stage directions.\n"
        "Provide your response in strictly valid JSON format matching this schema:\n"
        "{\n"
        '  "translations": [\n'
        "    {\n"
        '      "id": "<matching chunk id>",\n'
        '      "direction_en": "<translated direction or empty>",\n'
        '      "text_en": "<translated spoken dialogue or empty>"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "CRITICAL: Never output Japanese in text_en or direction_en. Output must be strictly valid English."
    )

    user_msg = (
        f"Translate the following {len(items)} chunks from Japanese to English. Output JSON:\n"
        + json.dumps(items, ensure_ascii=False, indent=2)
    )

    content = call_openai_chat([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_msg}
    ])

    data = json.loads(content)
    res_list = data.get("translations", [])
    res_map = {r["id"]: r for r in res_list if "id" in r}
    return res_map

def fix_play(play_id):
    src_path = os.path.join(SRC_PLAYS_DIR, f"{play_id}.json")
    pub_path = os.path.join(PUB_PLAYS_DIR, f"{play_id}.json")

    with open(src_path, "r", encoding="utf-8") as f:
        play_data = json.load(f)

    # Find bad chunks
    to_translate = []
    for sc in play_data["scenes"]:
        for ch in sc["chunks"]:
            is_stage = ch.get("type") == "stage_direction"
            txt_ja = ch.get("direction_ja" if is_stage else "text_ja", "")
            txt_en = ch.get("direction_en" if is_stage else "text_en", "")

            needs_fix = False
            if not txt_en or not txt_en.strip() or txt_en.strip() == "..." or is_japanese(txt_en):
                needs_fix = True

            # Special case: s1_c1 in kamifusen has direction_en but text_en is empty while text_ja has text
            if not is_stage and ch.get("text_ja") and not ch.get("text_en"):
                needs_fix = True

            if needs_fix and txt_ja:
                to_translate.append({
                    "id": ch["id"],
                    "speaker": ch.get("speaker", ""),
                    "speaker_en": ch.get("speaker_en", ""),
                    "direction_ja": ch.get("direction_ja", ""),
                    "text_ja": ch.get("text_ja", ""),
                    "is_stage": is_stage,
                    "target_chunk": ch
                })

    print(f"[{play_id}] Found {len(to_translate)} chunks needing translation...")
    if not to_translate:
        return

    # Process in batches of 8
    batch_size = 8
    for i in range(0, len(to_translate), batch_size):
        batch = to_translate[i:i+batch_size]
        items_payload = [{
            "id": it["id"],
            "speaker": it["speaker"],
            "speaker_en": it["speaker_en"],
            "direction_ja": it["direction_ja"],
            "text_ja": it["text_ja"],
            "is_stage": it["is_stage"]
        } for it in batch]

        print(f"  [{play_id}] Translating batch {i//batch_size + 1}/{(len(to_translate) + batch_size - 1)//batch_size} ({len(batch)} items)...")
        res_map = translate_batch(play_id, items_payload)

        for it in batch:
            ch = it["target_chunk"]
            cid = it["id"]
            if cid in res_map:
                res = res_map[cid]
                dir_en = res.get("direction_en", "").strip()
                txt_en = res.get("text_en", "").strip()

                if it["is_stage"]:
                    if dir_en and not is_japanese(dir_en):
                        ch["direction_en"] = dir_en
                    elif txt_en and not is_japanese(txt_en):
                        ch["direction_en"] = txt_en
                else:
                    if txt_en and not is_japanese(txt_en):
                        ch["text_en"] = txt_en
                    if dir_en and not is_japanese(dir_en):
                        ch["direction_en"] = dir_en
                    # If dialogue was somehow put in direction_en
                    if not ch.get("text_en") and ch.get("direction_en") and not is_japanese(ch["direction_en"]):
                        ch["text_en"] = ch["direction_en"]

        time.sleep(0.5)

    # Save to both src and public
    with open(src_path, "w", encoding="utf-8") as f:
        json.dump(play_data, f, ensure_ascii=False, indent=2)

    with open(pub_path, "w", encoding="utf-8") as f:
        json.dump(play_data, f, ensure_ascii=False, indent=2)

    print(f"[+] [{play_id}] Updated {src_path} and {pub_path} successfully!")

def main():
    plays = ["kamifusen", "itsutaka", "highway", "lion", "hansuu", "nemurenai"]
    for pid in plays:
        fix_play(pid)

if __name__ == "__main__":
    main()
