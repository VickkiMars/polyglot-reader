#!/usr/bin/env python3
"""
Translate the 5 empty stories using English-to-Japanese Dictionary grounding + GPT-6
"""

import os
import json
import time
from openai import OpenAI
from scripts.japanese_dictionary import EnglishToJapaneseDictionary

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    with open("/home/kami/Desktop/codebase/sental/translation_sandbox/.env") as f:
        for line in f:
            if "OPENAI_API_KEY" in line and "=" in line:
                OPENAI_API_KEY = line.split("=", 1)[1].strip()

client = OpenAI(api_key=OPENAI_API_KEY)
dictionary = EnglishToJapaneseDictionary()

TARGET_SIDS = [20389, 13440, 18973, 13547, 15026]

with open("/home/kami/Desktop/codebase/language/mandarin/stories.json") as f:
    mandarin_stories = {s["id"]: s for s in json.load(f)}

with open("/home/kami/Desktop/codebase/language/japanese/stories.json") as f:
    japanese_stories = json.load(f)

j_map = {s["id"]: s for s in japanese_stories}

PROMPT = """You are an expert Japanese linguist, educator, and native-level translator specializing in Japanese graded readers for language learners (JLPT aligned).
Given a story's English paragraphs and English-to-Japanese dictionary translation grounding, produce natural, idiomatic Japanese paragraphs and hiragana reading paragraphs.

CRITICAL REQUIREMENTS:
1. PARAGRAPH ALIGNMENT: Translate paragraph-by-paragraph matching the exact input paragraph count.
2. NATURAL COLLOCATIONS:
   - Never say '食事を料理する'. Use '食事を作る' / '晩ご飯を作る' or '自炊する'.
   - 'Cook our own meals' -> mark agency with '自分たちで' (or '自炊する'), never possessive '自分たちの食事'.
3. CULTURAL FOOD TERMS:
   - Steamed buns (包子) -> '中華まん' / '肉まん' (never 'ロールパン').
   - Dumplings (饺子) -> '餃子' (never '蒸しだんご').
   - Noodles (面条) -> '麺' / 'ラーメン' (never 'ヌードル').
4. EMOTION NUANCE ('HAPPY'):
   - Use '楽しい' (fun/enjoyable day/activities), '嬉しい' (event joy), and avoid '非常に幸せです' for casual fun days.
5. TIME & PARTICLES:
   - Relative time words ('今日', '午後', '朝', '夜') do NOT take 'に' ('午後は', not '午後に').
   - Use '観る' for watching movies ('映画を観る').
   - Omit redundant subject pronouns ('私たち') once established; avoid double-topic marker stacking.

Output strictly valid JSON with this schema:
{
  "japanese_paragraphs": [
    "Japanese paragraph 1...",
    "Japanese paragraph 2..."
  ],
  "reading_paragraphs": [
    "Reading in hiragana with spacing for paragraph 1...",
    "Reading in hiragana with spacing for paragraph 2..."
  ]
}
"""

for sid in TARGET_SIDS:
    m_story = mandarin_stories.get(sid)
    if not m_story:
        continue

    title = m_story.get("title", "")
    en_paras = m_story.get("english_paragraphs", [])
    print(f"[*] Translating Story {sid}: '{title}' ({len(en_paras)} paragraphs)...")

    dict_grounding = dictionary.build_bilingual_prompt_context(en_paras)
    user_content = f"Story Title: {title}\n\n{dict_grounding}\n\nEnglish Paragraphs:\n" + json.dumps(en_paras, ensure_ascii=False, indent=2)

    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model="gpt-5-mini",  # use fast reliable model without rate limits
                messages=[
                    {"role": "system", "content": PROMPT},
                    {"role": "user", "content": user_content}
                ],
                response_format={"type": "json_object"}
            )
            data = json.loads(resp.choices[0].message.content)
            ja_paras = data.get("japanese_paragraphs", [])
            rd_paras = data.get("reading_paragraphs", [])

            if len(ja_paras) == len(en_paras):
                if sid in j_map:
                    j_map[sid]["japanese_paragraphs"] = ja_paras
                    j_map[sid]["reading_paragraphs"] = rd_paras
                    j_map[sid]["japanese_full"] = "\n\n".join(ja_paras)
                    j_map[sid]["reading_full"] = "\n\n".join(rd_paras)
                    print(f"[+] Successfully translated Story {sid} into {len(ja_paras)} Japanese paragraphs!")
                break
        except Exception as e:
            print(f"[-] Attempt {attempt+1} error on story {sid}: {e}")
            time.sleep(2)

# Save updated stories.json
with open("/home/kami/Desktop/codebase/language/japanese/stories.json", "w", encoding="utf-8") as f:
    json.dump(japanese_stories, f, indent=2, ensure_ascii=False)
with open("data/japanese_stories/stories.json", "w", encoding="utf-8") as f:
    json.dump(japanese_stories, f, indent=2, ensure_ascii=False)

print("[+] Updated stories.json with all missing story translations!")
