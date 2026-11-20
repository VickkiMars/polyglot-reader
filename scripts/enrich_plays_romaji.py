#!/usr/bin/env python3
"""
Enrich all Japanese plays with accurate Hepburn Romaji and ruby Romaji markup.
Maintains 100% dual synchronization between src/data/plays/ and public/plays/.
"""

import os
import sys
import json
import re
import pykakasi

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PLAYS_DIR = os.path.join(PROJECT_ROOT, "src", "data", "plays")
PUB_PLAYS_DIR = os.path.join(PROJECT_ROOT, "public", "plays")

kks = pykakasi.kakasi()

KANA_MAP = {
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'を': 'o', 'ん': 'n',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
    'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
    'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
    'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
    'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
    'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
    'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
    'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
    'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
    'ぢゃ': 'ja', 'ぢゅ': 'ju', 'ぢょ': 'jo',
    'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
    'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
    'うぇ': 'we', 'うぃ': 'wi', 'うぉ': 'wo',
    'しぇ': 'she', 'じぇ': 'je', 'ちぇ': 'che',
    'てぃ': 'ti', 'でぃ': 'di', 'とぅ': 'tu', 'どぅ': 'du',
    'ふぁ': 'fa', 'ふぃ': 'fi', 'ふぇ': 'fe', 'ふぉ': 'fo',
    'ゔ': 'vu', 'ゔぁ': 'va', 'ゔぃ': 'vi', 'ゔぇ': 've', 'ゔぉ': 'vo'
}

def katakana_to_hiragana(text: str) -> str:
    res = []
    for c in text:
        code = ord(c)
        if 0x30a1 <= code <= 0x30f6:
            res.append(chr(code - 0x60))
        else:
            res.append(c)
    return "".join(res)

def kana_to_romaji(kana: str, defn: str = "", word: str = "") -> str:
    if not kana:
        return ""
    clean_defn = (defn or "").lower()
    clean_word = word or ""

    if clean_word == "は" and ("topic marker" in clean_defn or "particle" in clean_defn):
        return "wa"
    if clean_word == "へ" and ("direction marker" in clean_defn or "particle" in clean_defn):
        return "e"
    if clean_word == "を" and ("object marker" in clean_defn or "particle" in clean_defn):
        return "o"

    hira = katakana_to_hiragana(kana)
    res = []
    i = 0
    n = len(hira)
    while i < n:
        if i + 1 < n and hira[i:i+2] in KANA_MAP:
            res.append(KANA_MAP[hira[i:i+2]])
            i += 2
        elif hira[i] == 'っ':
            next_two = hira[i+1:i+3]
            next_one = hira[i+1:i+2]
            next_rom = KANA_MAP.get(next_two) or KANA_MAP.get(next_one) or ""
            if next_rom:
                res.append('t' if next_rom.startswith('ch') else next_rom[0])
            i += 1
        elif hira[i] == 'ー':
            if res and res[-1][-1] in 'aeiou':
                res.append(res[-1][-1])
            i += 1
        elif hira[i] in KANA_MAP:
            res.append(KANA_MAP[hira[i]])
            i += 1
        else:
            res.append(hira[i])
            i += 1
    return "".join(res)

def text_to_romaji(text: str) -> str:
    if not text:
        return ""
    converted = kks.convert(text)
    tokens = []
    for item in converted:
        hep = item.get("hepburn", "").strip()
        if hep:
            tokens.append(hep)
    return " ".join(tokens)

def convert_ruby_html_to_romaji(ruby_html: str) -> str:
    if not ruby_html:
        return ""

    def replace_ruby(match):
        attrs = match.group(1)
        inner = match.group(2)

        py_m = re.search(r'data-py="([^"]*)"', attrs)
        defn_m = re.search(r'data-defn="([^"]*)"', attrs)
        word_m = re.search(r'<span class="si">([\s\S]*?)<\/span>', inner)

        py = py_m.group(1) if py_m else ""
        defn = defn_m.group(1) if defn_m else ""
        word = word_m.group(1) if word_m else ""

        romaji = kana_to_romaji(py or word, defn, word)
        if not romaji and word:
            romaji = text_to_romaji(word)

        # Update data-romaji in attrs if missing
        if 'data-romaji=' not in attrs:
            attrs = f'{attrs} data-romaji="{romaji}"'

        # Replace <rt>...</rt> with <rt>{romaji}</rt>
        new_inner = re.sub(r'<rt>[\s\S]*?<\/rt>', f'<rt>{romaji}</rt>', inner)
        return f'<ruby{attrs}>{new_inner}</ruby>'

    return re.sub(r'<ruby\b([^>]*)>([\s\S]*?)<\/ruby>', replace_ruby, ruby_html)

def enrich_play(play_id: str):
    src_file = os.path.join(SRC_PLAYS_DIR, f"{play_id}.json")
    pub_file = os.path.join(PUB_PLAYS_DIR, f"{play_id}.json")

    with open(src_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    total_chunks = 0
    enriched_chunks = 0

    for scene in data.get("scenes", []):
        for chunk in scene.get("chunks", []):
            total_chunks += 1
            is_stage = chunk.get("type") == "stage_direction"
            text_ja = chunk.get("text_ja", "")
            direction_ja = chunk.get("direction_ja", "")
            orig_ruby = chunk.get("ruby", "")

            # 1. Plain Romaji transcription
            if is_stage:
                romaji = text_to_romaji(direction_ja)
            else:
                romaji = text_to_romaji(text_ja)
            chunk["romaji"] = romaji

            # 2. Ruby Romaji HTML markup
            if orig_ruby:
                chunk["ruby_romaji"] = convert_ruby_html_to_romaji(orig_ruby)
                # Also ensure original chunk["ruby"] contains data-romaji attribute for frontend agility
                def add_data_romaji(m):
                    attrs = m.group(1)
                    inner = m.group(2)
                    if 'data-romaji=' in attrs:
                        return m.group(0)
                    py_m = re.search(r'data-py="([^"]*)"', attrs)
                    defn_m = re.search(r'data-defn="([^"]*)"', attrs)
                    word_m = re.search(r'<span class="si">([\s\S]*?)<\/span>', inner)
                    py = py_m.group(1) if py_m else ""
                    defn = defn_m.group(1) if defn_m else ""
                    word = word_m.group(1) if word_m else ""
                    rom = kana_to_romaji(py or word, defn, word) or text_to_romaji(word)
                    return f'<ruby{attrs} data-romaji="{rom}">{inner}</ruby>'
                chunk["ruby"] = re.sub(r'<ruby\b([^>]*)>([\s\S]*?)<\/ruby>', add_data_romaji, orig_ruby)
            else:
                chunk["ruby_romaji"] = ""

            enriched_chunks += 1

    # Dual Data Synchronization: Save to src and public in lockstep
    with open(src_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    with open(pub_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[{play_id}] Successfully enriched {enriched_chunks}/{total_chunks} chunks with Romaji & Kanji.")

def main():
    plays = ["kamifusen", "itsutaka", "highway", "lion", "hansuu", "nemurenai"]
    print("=== Enriching All Plays with Romaji and Kanji ===")
    for pid in plays:
        enrich_play(pid)
    print("\n[+] Romaji enrichment and lockstep dual synchronization complete!")

if __name__ == "__main__":
    main()
