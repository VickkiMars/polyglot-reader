#!/usr/bin/env python3
"""
Comprehensive Play Restructuring & Repair Pipeline:
Repairs invalid speakers, merged chunks, missing characters, and broken stage
directions across all 5 affected plays in Polyglot Reader.
Synchronizes src/data/plays/ and public/plays/ in lockstep.
"""

import os
import sys
import json
import re
import html
import urllib.request
import urllib.error
import fitz
from janome.tokenizer import Tokenizer
import pykakasi

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PLAYS_DIR = os.path.join(PROJECT_ROOT, "src", "data", "plays")
PUB_PLAYS_DIR = os.path.join(PROJECT_ROOT, "public", "plays")

# Load OpenAI key
KEY = os.environ.get("OPENAI_API_KEY")
if not KEY:
    env_file = os.path.join(PROJECT_ROOT, ".env")
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                if line.startswith("OPENAI_API_KEY"):
                    KEY = line.split("=", 1)[1].strip()
                    break

# NLP Tools
tokenizer = Tokenizer()
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

def annotate_text_ruby(text: str) -> str:
    if not text:
        return ""
    tokens = []
    for token in tokenizer.tokenize(text):
        surface = token.surface
        hira_res = kks.convert(surface)
        hira = "".join(item["hira"] for item in hira_res)
        has_kanji = any("\u4e00" <= c <= "\u9fff" for c in surface)
        romaji = kana_to_romaji(hira, "", surface) or text_to_romaji(surface)
        if has_kanji:
            tokens.append(f'<ruby class="mb-tooltip" data-py="{hira}" data-defn="{html.escape(surface)}" data-romaji="{romaji}"><span class="si">{surface}</span><rt>{hira}</rt></ruby>')
        else:
            tokens.append(f'<span class="si">{surface}</span>')
    return "".join(tokens)

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
        romaji = kana_to_romaji(py or word, defn, word) or text_to_romaji(word)
        if 'data-romaji=' not in attrs:
            attrs = f'{attrs} data-romaji="{romaji}"'
        new_inner = re.sub(r'<rt>[\s\S]*?<\/rt>', f'<rt>{romaji}</rt>', inner)
        return f'<ruby{attrs}>{new_inner}</ruby>'
    return re.sub(r'<ruby\b([^>]*)>([\s\S]*?)<\/ruby>', replace_ruby, ruby_html)

def batch_translate(items, play_title):
    if not KEY:
        print("[!] Warning: OPENAI_API_KEY not found, skipping batch translation")
        return []
    translations = []
    batch_size = 20
    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]
        payload = [{"idx": idx, "speaker": it.get("speaker", ""), "direction_ja": it.get("direction_ja", ""), "text_ja": it.get("text_ja", "")} for idx, it in enumerate(batch)]
        system_prompt = (
            f"You are a master literary dramaturg translating modern Japanese theatrical play '{play_title}' into theatrical English. "
            "Translate each line with dramatic fidelity, preserving character voices and subtext. "
            "Return JSON: {\"results\": [{\"idx\": 0, \"direction_en\": \"...\", \"text_en\": \"...\"}, ...]}"
        )
        data_str = json.dumps({
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=data_str,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"}
        )
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    res = json.loads(resp.read().decode("utf-8"))
                    parsed = json.loads(res["choices"][0]["message"]["content"])
                    batch_res = parsed.get("results", [])
                    # map by idx
                    res_map = {r["idx"]: r for r in batch_res}
                    for idx in range(len(batch)):
                        r = res_map.get(idx, {})
                        translations.append({
                            "text_en": r.get("text_en", ""),
                            "direction_en": r.get("direction_en", "")
                        })
                    break
            except Exception as e:
                print(f"  [Attempt {attempt+1}] Translation API error: {e}")
                if attempt == 2:
                    for _ in batch:
                        translations.append({"text_en": "", "direction_en": ""})
    return translations

def annotate_chunk_nlp(chunk):
    t_ja = chunk.get("text_ja", "").strip()
    d_ja = chunk.get("direction_ja", "").strip()
    is_stage = chunk.get("type") == "stage_direction"
    target_text = d_ja if is_stage and not t_ja else t_ja

    if target_text:
        chunk["ruby"] = annotate_text_ruby(target_text)
        chunk["ruby_romaji"] = convert_ruby_html_to_romaji(chunk["ruby"])
        chunk["romaji"] = text_to_romaji(target_text)
    else:
        chunk["ruby"] = ""
        chunk["ruby_romaji"] = ""
        chunk["romaji"] = ""

def save_play_lockstep(play_id, data):
    src_file = os.path.join(SRC_PLAYS_DIR, f"{play_id}.json")
    pub_file = os.path.join(PUB_PLAYS_DIR, f"{play_id}.json")
    with open(src_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    with open(pub_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[+] Saved {play_id}.json in lockstep to src and public")

print("Pipeline helpers loaded successfully.")

# Speaker English name map
SPEAKER_EN_MAP = {
    "女": "Woman (Miwa)",
    "男": "Man",
    "虫眼鏡": "Magnifying Glass",
    "電話番": "Telephone Keeper",
    "水晶": "Crystal",
    "白蛇": "White Snake",
    "ユウカ": "Yuuka",
    "サラ": "Sara",
    "マエジマ": "Maejima",
    "ミツヨ": "Mitsuyo",
    "老婆": "Old Woman",
    "トキ": "Toki",
    "新名": "Niina",
    "白子": "Shirako",
    "茉莉": "Matsuri",
    "瑠璃色": "Ruri-iro",
    "朝": "Asa",
    "将門": "Masakado",
    "須藤": "Sudō",
    "森": "Mori",
    "横山": "Yokoyama",
    "脇中": "Wakinaka",
    "三谷": "Mitani",
    "香取": "Katori",
    "健一": "Ken'ichi",
    "郁子": "Ikuko",
    "千寿子": "Chizuko",
    "恵美子": "Emiko",
    "幸三": "Kouzou",
    "町田": "Machida",
    "誠司": "Seiji",
    "直枝": "Naoe",
    "野間": "Noma",
    "勇人": "Hayato",
    "まゆみ": "Mayumi",
    "原口": "Haraguchi",
    "明": "Akira",
    "好江": "Yoshie",
    "保奈美": "Honami",
    "STAGE": "Stage Direction"
}

def repair_hansuu():
    print("\n--- Repairing hansuu (反芻) ---")
    src_file = os.path.join(SRC_PLAYS_DIR, "hansuu.json")
    with open(src_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Add 白蛇 to characters
    char_names = [c["name_ja"] for c in data.get("characters", [])]
    if "白蛇" not in char_names:
        data["characters"].append({
            "name_ja": "白蛇",
            "name_en": "White Snake",
            "role_description": "Fortune teller's assistant and vice-commander of the Earth Survey; wears a white snake replica around her neck.",
            "voice": "ja-JP-NanamiNeural",
            "gender": "female"
        })
        print("  Added 白蛇 to characters list")

    # 2. Repair Scenes
    for s_idx, scene in enumerate(data.get("scenes", [])):
        s_num = scene.get("scene_number", s_idx + 1)
        orig_chunks = scene.get("chunks", [])
        new_chunks = []

        if s_num == 1:
            i = 0
            while i < len(orig_chunks):
                c = orig_chunks[i]
                spk = c.get("speaker")
                
                # c1: 松井のどか
                if spk == "松井のどか":
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    c["direction_ja"] = "■登場人物"
                    c["direction_en"] = "Cast of Characters"
                    c["text_ja"] = ""
                    c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                elif spk == "普通":
                    c["speaker"] = "女"
                    c["speaker_en"] = "Woman (Miwa)"
                    c["text_ja"] = "普通…。"
                    c["text_en"] = "Just ordinary..."
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                elif spk == "だからさ":
                    c["speaker"] = "男"
                    c["speaker_en"] = "Man"
                    c["text_ja"] = "だからさ…この前のあの話、ちゃんと考えて欲しい。"
                    c["text_en"] = "That's why... I really want you to think carefully about what we talked about the other day."
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                elif spk == "3":
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    c["direction_ja"] = "虫眼鏡、手元の紙に数字の羅列をメモする。"
                    c["direction_en"] = "Magnifying Glass jots down a string of numbers on a piece of paper."
                    c["text_ja"] = ""
                    c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                elif c.get("id") == "hansuu_s1_c39":
                    # Consolidate c39 through c43 (339, 585, 6627, 49)
                    c["speaker"] = "電話番"
                    c["speaker_en"] = "Telephone Keeper"
                    c["direction_ja"] = "メモを受け取って、電話をかける"
                    c["direction_en"] = "Takes the memo and dials the phone"
                    c["text_ja"] = "あ、もしもし？はい、えっと、339、585、6627、49、です。(頷きながらメモを取り)うんうん。…あざっす！ 電話番、電話を切り、白蛇にメモを渡す。"
                    c["text_en"] = "Ah, hello? Yes, um, 339, 585, 6627, 49, that's it. (Nodding while taking notes) Uh-huh. ...Thanks a lot! Telephone Keeper hangs up and hands the memo to White Snake."
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    # skip c40, c41, c42, c43
                    i += 5
                elif spk in ["339", "585", "6627", "49"]:
                    # Already absorbed if jumped, else skip
                    i += 1
                else:
                    new_chunks.append(c)
                    i += 1

        elif s_num == 2:
            i = 0
            while i < len(orig_chunks):
                c = orig_chunks[i]
                spk = c.get("speaker")

                if c.get("id") == "hansuu_s2_c15":
                    c["speaker"] = "電話番"
                    c["speaker_en"] = "Telephone Keeper"
                    c["text_ja"] = "繋がるって言っても、地球人の過去データ問い合わせ用番号だけですよ。調査中、私たちに何かあった時のために本部のコンピュータが自動音声で教えてくれるんすけど、それだけ。"
                    c["text_en"] = "Even though it connects, it's only the inquiry number for Earthlings' past data. It's just an automated voice from HQ's computer in case something happens to us during the survey, but that's all."
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 2 # skip c16 ('6')
                elif spk == "6":
                    i += 1
                elif spk == "いや":
                    c["speaker"] = "電話番"
                    c["speaker_en"] = "Telephone Keeper"
                    c["text_ja"] = "いや…"
                    c["text_en"] = "Well..."
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                elif c.get("id") == "hansuu_s2_c36":
                    c["speaker"] = "虫眼鏡"
                    c["speaker_en"] = "Magnifying Glass"
                    c["text_ja"] = "地球人、特に日本人の占い文化についての文献を読んだことがあるんだ。タイトルは確か「漫画でわかる！稼ぐ占い師独立マニュアル」。文献によると、まず過去の出来事を当ててみせて、次に未来の話をする。正直、いけると思う。"
                    c["text_en"] = "I once read some literature about Earthlings', especially Japanese people's fortune-telling culture. If I recall, the title was 'Manga Guide: Independent Manual for Profitable Fortune Tellers.' According to the text, you first guess past events, then talk about the future. Honestly, I think we can pull it off."
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 2 # skip c37 ('トルは確か')
                elif spk == "トルは確か":
                    i += 1
                elif spk == "虫眼鏡水晶":
                    # Split into 虫眼鏡 and STAGE
                    c1 = dict(c)
                    c1["speaker"] = "虫眼鏡"
                    c1["speaker_en"] = "Magnifying Glass"
                    c1["text_ja"] = "もちろんです。どうぞお座りください。"
                    c1["text_en"] = "Of course. Please, have a seat."
                    c1["direction_ja"] = ""
                    c1["direction_en"] = ""
                    annotate_chunk_nlp(c1)
                    new_chunks.append(c1)

                    c2 = dict(c)
                    c2["speaker"] = "STAGE"
                    c2["type"] = "stage_direction"
                    c2["speaker_en"] = "Stage Direction"
                    c2["direction_ja"] = "男、座る。"
                    c2["direction_en"] = "The man sits down."
                    c2["text_ja"] = ""
                    c2["text_en"] = ""
                    annotate_chunk_nlp(c2)
                    new_chunks.append(c2)
                    i += 1
                else:
                    new_chunks.append(c)
                    i += 1

        elif s_num == 3:
            i = 0
            while i < len(orig_chunks):
                c = orig_chunks[i]
                spk = c.get("speaker")

                if spk == "10":
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    c["direction_ja"] = "電話番が電話をかけ、メモをとりはじめる。 水晶も占いを始める。"
                    c["direction_en"] = "Telephone Keeper places a call and starts taking notes. Crystal also begins her fortune-telling."
                    c["text_ja"] = ""
                    c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                elif spk == "虫眼鏡水晶":
                    # Split into 虫眼鏡 and 水晶
                    c1 = dict(c)
                    c1["speaker"] = "虫眼鏡"
                    c1["speaker_en"] = "Magnifying Glass"
                    c1["text_ja"] = "我々の占いの信憑性を高めるために、あなたの過去を的中させましょう。"
                    c1["text_en"] = "To enhance the credibility of our fortune-telling, allow us to accurately reveal your past."
                    annotate_chunk_nlp(c1)
                    new_chunks.append(c1)

                    c2 = dict(c)
                    c2["speaker"] = "水晶"
                    c2["speaker_en"] = "Crystal"
                    c2["text_ja"] = "我々の占いの信憑性を高めるために、あなたの過去を的中させましょう。"
                    c2["text_en"] = "To enhance the credibility of our fortune-telling, allow us to accurately reveal your past."
                    annotate_chunk_nlp(c2)
                    new_chunks.append(c2)
                    i += 1
                else:
                    new_chunks.append(c)
                    i += 1

        # Re-index chunks
        for idx, chk in enumerate(new_chunks):
            chk["chunk_index"] = idx + 1
            chk["id"] = f"hansuu_s{s_num}_c{idx+1}"
            if chk.get("speaker") in SPEAKER_EN_MAP:
                chk["speaker_en"] = SPEAKER_EN_MAP[chk["speaker"]]

        scene["chunks"] = new_chunks
        scene["chunk_count"] = len(new_chunks)
        scene["dialogue_count"] = sum(1 for c in new_chunks if c.get("type") == "dialogue")
        print(f"  Scene {s_num}: {len(new_chunks)} chunks (dialogues: {scene['dialogue_count']})")

    data["total_lines"] = sum(s["chunk_count"] for s in data["scenes"])
    save_play_lockstep("hansuu", data)

print("hansuu repair defined.")

def repair_highway():
    print("\n--- Repairing highway (ハイウェイの煙) ---")
    src_file = os.path.join(SRC_PLAYS_DIR, "highway.json")
    with open(src_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Add トキ to characters
    char_names = [c["name_ja"] for c in data.get("characters", [])]
    if "トキ" not in char_names:
        data["characters"].append({
            "name_ja": "トキ",
            "name_en": "Toki",
            "role_description": "An eccentric elderly woman who escaped a nursing home and is pushing a shopping cart along the expressway toward Kyushu.",
            "voice": "ja-JP-NanamiNeural",
            "gender": "female"
        })
        print("  Added トキ to characters list")

    # 2. Repair Scenes
    for s_idx, scene in enumerate(data.get("scenes", [])):
        s_num = scene.get("scene_number", s_idx + 1)
        orig_chunks = scene.get("chunks", [])
        new_chunks = []

        if s_num == 1:
            for c in orig_chunks:
                spk = c.get("speaker")
                if spk in ["本橋龍", "〇登場人物", "６０代"]:
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    if c.get("text_ja") and not c.get("direction_ja"):
                        c["direction_ja"] = c["text_ja"]
                        c["text_ja"] = ""
                        if c.get("text_en") and not c.get("direction_en"):
                            c["direction_en"] = c["text_en"]
                            c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                elif spk == "なんでよ":
                    c["speaker"] = "サラ"
                    c["speaker_en"] = "Sara"
                    c["text_ja"] = "なんでよ（笑）"
                    c["text_en"] = "Why not? (laughs)"
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                elif spk == "うん":
                    c["speaker"] = "サラ"
                    c["speaker_en"] = "Sara"
                    c["text_ja"] = "うん"
                    c["text_en"] = "Yeah."
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                else:
                    new_chunks.append(c)

        elif s_num == 2:
            for c in orig_chunks:
                spk = c.get("speaker")
                if spk == "そうだよねー":
                    c["speaker"] = "サラ"
                    c["speaker_en"] = "Sara"
                    c["text_ja"] = "そうだよねー"
                    c["text_en"] = "Totally, right?"
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                elif spk == "ユウカがこれ":
                    c["speaker"] = "サラ"
                    c["speaker_en"] = "Sara"
                    c["text_ja"] = "ユウカがこれ（楽々モバイル）がいいって言ったんじゃん"
                    c["text_en"] = "You're the one who said this Rakuraku Mobile was good, Yuuka!"
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                else:
                    new_chunks.append(c)

        elif s_num == 3:
            i = 0
            while i < len(orig_chunks):
                c = orig_chunks[i]
                spk = c.get("speaker")
                cid = c.get("id")

                if cid == "highway_s3_c6":
                    c["speaker"] = "トキ"
                    c["speaker_en"] = "Toki"
                    c["text_ja"] = "…タバコ、…ちょうだい"
                    c["text_en"] = "...Cigarette... give me one."
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 2  # skip c7 ('ちょうだい')
                elif spk == "ちょうだい":
                    i += 1
                elif cid == "highway_s3_c8":
                    c["speaker"] = "ユウカ"
                    c["speaker_en"] = "Yuuka"
                    c["text_ja"] = "…なんか、余白の時間、…こう、生きてる感じしない？なんか、"
                    c["text_en"] = "...Like, having this empty spare time... doesn't it feel like you're really alive? Sort of,"
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 2  # skip c9 ('4')
                elif spk == "4":
                    i += 1
                elif cid == "highway_s3_c18":
                    c["speaker"] = "トキ"
                    c["speaker_en"] = "Toki"
                    c["text_ja"] = "…チッ"
                    c["direction_ja"] = "舌打ちする"
                    c["text_en"] = "...Tch."
                    c["direction_en"] = "Clicks tongue"
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                elif cid == "highway_s3_c19":
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    c["direction_ja"] = "ガラガラと何かを押す音が聞こえる。 トキが現れる。 トキ、去っていく。 スーパーなどで使われているショッピングカートを押している。 二人、見送る。"
                    c["direction_en"] = "The rattling sound of pushing something is heard. Toki appears, then walks away, pushing a supermarket shopping cart. The two watch her leave."
                    c["text_ja"] = ""
                    c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                elif spk == "ははは":
                    c["speaker"] = "ユウカ"
                    c["speaker_en"] = "Yuuka"
                    c["text_ja"] = "ははは（笑）それだったらすごいわね"
                    c["text_en"] = "Hahaha (laughs) If that were true, that'd be amazing."
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                else:
                    new_chunks.append(c)
                    i += 1

        # Re-index chunks
        for idx, chk in enumerate(new_chunks):
            chk["chunk_index"] = idx + 1
            chk["id"] = f"highway_s{s_num}_c{idx+1}"
            if chk.get("speaker") in SPEAKER_EN_MAP:
                chk["speaker_en"] = SPEAKER_EN_MAP[chk["speaker"]]

        scene["chunks"] = new_chunks
        scene["chunk_count"] = len(new_chunks)
        scene["dialogue_count"] = sum(1 for c in new_chunks if c.get("type") == "dialogue")
        print(f"  Scene {s_num}: {len(new_chunks)} chunks (dialogues: {scene['dialogue_count']})")

    data["total_lines"] = sum(s["chunk_count"] for s in data["scenes"])
    save_play_lockstep("highway", data)

print("highway repair defined.")

def repair_itsutaka():
    print("\n--- Repairing itsutaka (いつ高シリーズvol.1) ---")
    src_file = os.path.join(SRC_PLAYS_DIR, "itsutaka.json")
    with open(src_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    for s_idx, scene in enumerate(data.get("scenes", [])):
        s_num = scene.get("scene_number", s_idx + 1)
        orig_chunks = scene.get("chunks", [])
        new_chunks = []

        if s_num == 1:
            i = 0
            while i < len(orig_chunks):
                c = orig_chunks[i]
                spk = c.get("speaker")
                cid = c.get("id")

                if spk == "【出演】":
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    next_c = orig_chunks[i+1] if i+1 < len(orig_chunks) else None
                    c_extra = next_c.get("text_ja", "") if next_c and next_c.get("speaker") == "iPhone" else ""
                    c["direction_ja"] = (c.get("text_ja", "") + " " + c_extra).strip()
                    c["direction_en"] = (c.get("text_en", "") + " " + (next_c.get("text_en", "") if next_c else "")).strip()
                    c["text_ja"] = ""
                    c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 2  # skip iPhone (c4)
                elif spk == "iPhone" and i > 0 and orig_chunks[i-1].get("id") == "itsutaka_s1_c3":
                    i += 1
                elif spk == "1":
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    c["direction_ja"] = "瑠璃色が戻ってくる。新名の肩をたたく。"
                    c["direction_en"] = "Ruri-iro returns and taps Niina on the shoulder."
                    c["text_ja"] = ""
                    c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                elif cid == "itsutaka_s1_c12":
                    c["speaker"] = "茉莉"
                    c["speaker_en"] = "Matsuri"
                    c["text_ja"] = "「あ、まだ」"
                    c["direction_ja"] = "iPhoneをとりだして確認する"
                    c["text_en"] = "\"Ah, not yet.\""
                    c["direction_en"] = "Takes out iPhone to check"
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                elif cid == "itsutaka_s1_c13" and spk == "iPhone":
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    c["direction_ja"] = "茉莉、白子に気づくが、見覚えのない顔。瑠璃色に「誰？」ときくが、瑠璃色もしらない。"
                    c["direction_en"] = "Matsuri notices Shirako, but it's an unfamiliar face. She asks Ruri-iro 'Who is that?', but Ruri-iro doesn't know either."
                    c["text_ja"] = ""
                    c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                elif spk == "瑠璃糸":
                    c["speaker"] = "瑠璃色"
                    c["speaker_en"] = "Ruri-iro"
                    c["text_ja"] = "「うん」"
                    c["text_en"] = "\"Yeah.\""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                    i += 1
                else:
                    new_chunks.append(c)
                    i += 1

        elif s_num == 2:
            for c in orig_chunks:
                spk = c.get("speaker")
                if spk == "3":
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    c["direction_ja"] = "新名、白子の前に立ち、意を決したように肩をたたく。 白子、むくりと起き上がる。"
                    c["direction_en"] = "Niina stands before Shirako and, gathering his resolve, taps her shoulder. Shirako sits up abruptly."
                    c["text_ja"] = ""
                    c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                elif spk == "「うん」":
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    c["direction_ja"] = "三秒か、十秒か、一分か、それくらいの沈黙。 女子二人を覆っているカーテンが、風で少し揺れる。 一瞬、瑠璃色の姿がみえて、将門と目があう。 瑠璃色と茉莉と将門がわいわい騒ぐ。 瑠璃色、またすぐに隠れてしまう。 突然、将門が歌を口ずさむ。"
                    c["direction_en"] = "A silence of three seconds, ten seconds, perhaps a minute. The curtain shielding the two girls sways gently in the breeze. For an instant, Ruri-iro appears and makes eye contact with Masakado. Ruri-iro, Matsuri, and Masakado make a playful commotion. Ruri-iro immediately hides again. Suddenly, Masakado hums a song."
                    c["text_ja"] = ""
                    c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                elif spk == "「わかった」":
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    c["direction_ja"] = "間。"
                    c["direction_en"] = "A pause."
                    c["text_ja"] = ""
                    c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                else:
                    new_chunks.append(c)

        else:
            new_chunks = orig_chunks

        # Split trailing stage actions from dialogue in itsutaka
        dir_en_fixes = {
            "itsutaka_s1_c7": "Niina, flustered, abruptly stops the music and leaves the classroom. Matsuri emerges from behind the curtain and begins talking to Ruri-iro.",
            "itsutaka_s2_c19": "A pause.",
            "itsutaka_s3_c9": "Asa approaches the two and hands Masakado what looks like a bundle of photos.",
            "itsutaka_s3_c16": "Shirako places a human-shaped figure onto the miniature sports field. Niina notices this.",
            "itsutaka_s3_c23": "Masakado looks at the photos."
        }
        for chk in new_chunks:
            if chk.get("type") == "dialogue":
                t_raw = chk.get("text_ja", "").strip()
                m_act = re.match(r'^(「[^」]*」)\s*(.+)$', t_raw, re.DOTALL)
                if m_act:
                    chk["text_ja"] = m_act.group(1).strip()
                    extra_dir = m_act.group(2).strip()
                    chk["direction_ja"] = (chk.get("direction_ja", "") + " " + extra_dir).strip()
                    cid = chk.get("id")
                    if cid in dir_en_fixes:
                        chk["direction_en"] = dir_en_fixes[cid]
                    elif not chk.get("direction_en"):
                        chk["direction_en"] = "Stage action"
                    annotate_chunk_nlp(chk)

        # Re-index chunks
        for idx, chk in enumerate(new_chunks):
            chk["chunk_index"] = idx + 1
            chk["id"] = f"itsutaka_s{s_num}_c{idx+1}"
            if chk.get("speaker") in SPEAKER_EN_MAP:
                chk["speaker_en"] = SPEAKER_EN_MAP[chk["speaker"]]
            if chk.get("id") in dir_en_fixes:
                chk["direction_en"] = dir_en_fixes[chk["id"]]
            elif chk.get("direction_ja") and not chk.get("direction_en"):
                chk["direction_en"] = "Stage action"

        scene["chunks"] = new_chunks
        scene["chunk_count"] = len(new_chunks)
        scene["dialogue_count"] = sum(1 for c in new_chunks if c.get("type") == "dialogue")
        print(f"  Scene {s_num}: {len(new_chunks)} chunks (dialogues: {scene['dialogue_count']})")

    data["total_lines"] = sum(s["chunk_count"] for s in data["scenes"])
    save_play_lockstep("itsutaka", data)

def repair_lion():
    print("\n--- Repairing lion (ライオンのいる場所) ---")
    src_file = os.path.join(SRC_PLAYS_DIR, "lion.json")
    with open(src_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    for s_idx, scene in enumerate(data.get("scenes", [])):
        s_num = scene.get("scene_number", s_idx + 1)
        orig_chunks = scene.get("chunks", [])
        new_chunks = []

        if s_num == 1:
            for c in orig_chunks:
                spk = c.get("speaker")
                if spk in ["(", ")"]:
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    if c.get("text_ja") and not c.get("direction_ja"):
                        c["direction_ja"] = c["text_ja"]
                        c["text_ja"] = ""
                        if c.get("text_en") and not c.get("direction_en"):
                            c["direction_en"] = c["text_en"]
                            c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                elif spk == "そもそも":
                    c["speaker"] = "横山"
                    c["speaker_en"] = "Yokoyama"
                    c["text_ja"] = "そもそも「ビデオライン」って何？"
                    c["text_en"] = "In the first place, what is this 'video line'?"
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                else:
                    new_chunks.append(c)

        elif s_num == 3:
            for c in orig_chunks:
                spk = c.get("speaker")
                if spk == "そのための":
                    c["speaker"] = "横山"
                    c["speaker_en"] = "Yokoyama"
                    c["text_ja"] = "そのための「個別の教育支援計画」でしょ"
                    c["text_en"] = "Isn't that what the 'individualized education support plan' is for?"
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                elif spk == "ここは":
                    c["speaker"] = "須藤"
                    c["speaker_en"] = "Sudō"
                    c["text_ja"] = "「ここは学校」です。企業の論理は通用しません"
                    c["text_en"] = "\"This is a school.\" Corporate logic does not apply here."
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                elif c.get("id") == "lion_s3_c43" and spk == ")":
                    c["speaker"] = "森"
                    c["speaker_en"] = "Mori"
                    c["direction_ja"] = "横山に"
                    c["direction_en"] = "To Yokoyama"
                    c["text_ja"] = "校長室、まだいてはるんですよね"
                    c["text_en"] = "He's still in the principal's office, isn't he?"
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                elif spk in ["(", ")"]:
                    c["speaker"] = "STAGE"
                    c["type"] = "stage_direction"
                    c["speaker_en"] = "Stage Direction"
                    if c.get("text_ja") and not c.get("direction_ja"):
                        c["direction_ja"] = c["text_ja"]
                        c["text_ja"] = ""
                        if c.get("text_en") and not c.get("direction_en"):
                            c["direction_en"] = c["text_en"]
                            c["text_en"] = ""
                    annotate_chunk_nlp(c)
                    new_chunks.append(c)
                else:
                    new_chunks.append(c)

        else:
            new_chunks = orig_chunks

        # Re-index chunks
        for idx, chk in enumerate(new_chunks):
            chk["chunk_index"] = idx + 1
            chk["id"] = f"lion_s{s_num}_c{idx+1}"
            if chk.get("speaker") in SPEAKER_EN_MAP:
                chk["speaker_en"] = SPEAKER_EN_MAP[chk["speaker"]]

        scene["chunks"] = new_chunks
        scene["chunk_count"] = len(new_chunks)
        scene["dialogue_count"] = sum(1 for c in new_chunks if c.get("type") == "dialogue")
        print(f"  Scene {s_num}: {len(new_chunks)} chunks (dialogues: {scene['dialogue_count']})")

    data["total_lines"] = sum(s["chunk_count"] for s in data["scenes"])
    save_play_lockstep("lion", data)

print("itsutaka and lion repair defined.")

NEMURENAI_CHARACTERS = [
    {
        "name_ja": "健一",
        "name_en": "Ken'ichi",
        "role_description": "Elderly resident staying at the lodge with his wife, slightly anxious about retiring abroad.",
        "voice": "ja-JP-KeitaNeural",
        "gender": "male"
    },
    {
        "name_ja": "郁子",
        "name_en": "Ikuko",
        "role_description": "Ken'ichi's wife; sharp, observant, and candid about retirement realities.",
        "voice": "ja-JP-NanamiNeural",
        "gender": "female"
    },
    {
        "name_ja": "千寿子",
        "name_en": "Chizuko",
        "role_description": "Resident welcoming visitors; courteous and deeply attuned to the rhythm of the lodge.",
        "voice": "ja-JP-NanamiNeural",
        "gender": "female"
    },
    {
        "name_ja": "恵美子",
        "name_en": "Emiko",
        "role_description": "Visiting daughter staying temporarily; fond of swimming and relaxed banter.",
        "voice": "ja-JP-NanamiNeural",
        "gender": "female"
    },
    {
        "name_ja": "幸三",
        "name_en": "Kouzou",
        "role_description": "Active businessman and resident; loves exploring the Malaysian nature and local culture.",
        "voice": "ja-JP-KeitaNeural",
        "gender": "male"
    },
    {
        "name_ja": "町田",
        "name_en": "Machida",
        "role_description": "Lodge concierge; attentive, accommodating, and polite to all guests.",
        "voice": "ja-JP-NanamiNeural",
        "gender": "female"
    },
    {
        "name_ja": "誠司",
        "name_en": "Seiji",
        "role_description": "Prospective retiree visiting the lodge with his wife Naoe to test overseas living.",
        "voice": "ja-JP-KeitaNeural",
        "gender": "male"
    },
    {
        "name_ja": "直枝",
        "name_en": "Naoe",
        "role_description": "Seiji's wife and former high school classmate of Chizuko; curious yet hesitant.",
        "voice": "ja-JP-NanamiNeural",
        "gender": "female"
    },
    {
        "name_ja": "野間",
        "name_en": "Noma",
        "role_description": "Tour guide from the retirement facility's corporate Tokyo headquarters.",
        "voice": "ja-JP-NanamiNeural",
        "gender": "female"
    },
    {
        "name_ja": "勇人",
        "name_en": "Hayato",
        "role_description": "Young short-term visitor staying with his wife Mayumi.",
        "voice": "ja-JP-KeitaNeural",
        "gender": "male"
    },
    {
        "name_ja": "まゆみ",
        "name_en": "Mayumi",
        "role_description": "Young short-term visitor staying with her husband Hayato.",
        "voice": "ja-JP-NanamiNeural",
        "gender": "female"
    },
    {
        "name_ja": "原口",
        "name_en": "Haraguchi",
        "role_description": "Videotape delivery courier who brings Japanese TV recordings to the lodge residents.",
        "voice": "ja-JP-KeitaNeural",
        "gender": "male"
    },
    {
        "name_ja": "明",
        "name_en": "Akira",
        "role_description": "Longtime resident with deep knowledge of indigenous beliefs and dream culture.",
        "voice": "ja-JP-KeitaNeural",
        "gender": "male"
    },
    {
        "name_ja": "好江",
        "name_en": "Yoshie",
        "role_description": "Ken'ichi and Ikuko's elder daughter visiting today from Japan.",
        "voice": "ja-JP-NanamiNeural",
        "gender": "female"
    },
    {
        "name_ja": "保奈美",
        "name_en": "Honami",
        "role_description": "Ken'ichi and Ikuko's younger daughter visiting today from Japan.",
        "voice": "ja-JP-NanamiNeural",
        "gender": "female"
    }
]

def extract_nemurenai_section(doc, p_start, p_end, max_count=53):
    chars_list = ['健一', '郁子', '千寿子', '恵美子', '幸三', '杉原', '町田', '誠司', '直枝', '明', '好江', '保奈美', '勇人', 'まゆみ', '原口', '野間']
    all_lines = []
    for pno in range(p_start, p_end):
        page = doc[pno]
        d = page.get_text('dict')
        chars = []
        for b in d['blocks']:
            if 'lines' in b:
                for l in b['lines']:
                    for s in l['spans']:
                        t = s['text'].strip()
                        if t:
                            chars.append((s['bbox'][0], s['bbox'][1], t))
        for tier_min, tier_max in [(0, 380), (380, 680)]:
            tier_chars = [c for c in chars if tier_min <= c[1] < tier_max]
            if not tier_chars: continue
            cols = {}
            for c in tier_chars:
                found_k = None
                for k in cols:
                    if abs(k - c[0]) < 5:
                        found_k = k
                        break
                if found_k is None:
                    found_k = c[0]
                    cols[found_k] = []
                cols[found_k].append(c)
            for x, c_list in sorted(cols.items(), key=lambda kv: -kv[0]):
                c_list.sort(key=lambda c: c[1])
                text = ''.join(c[2] for c in c_list).strip()
                if text:
                    all_lines.append(text)

    turns = []
    for line in all_lines:
        if line in ['ソファソファ', 'ＡＢ', 'テーブル', 'ソファ', 'ＣＤ', 'ＥＦ', 'ＩＧ', 'ＨＪ']:
            continue
        spk_found = None
        for ch in sorted(chars_list, key=len, reverse=True):
            if line.startswith(ch):
                spk_found = ch
                break
        is_stage = line.startswith('＊') or '登場' in line or '退場' in line or '後、' in line or '開演' in line or (line.startswith('（') and line.endswith('）'))

        if spk_found:
            rem = line[len(spk_found):].strip().lstrip('★☆△▲・:： ')
            turns.append({
                'type': 'dialogue',
                'speaker': '幸三' if spk_found == '杉原' else spk_found,
                'text_ja': rem,
                'direction_ja': ''
            })
        elif is_stage:
            turns.append({
                'type': 'stage_direction',
                'speaker': 'STAGE',
                'text_ja': '',
                'direction_ja': line
            })
        else:
            if turns:
                if turns[-1]['type'] == 'dialogue':
                    turns[-1]['text_ja'] += line
                else:
                    turns[-1]['direction_ja'] += line

    cleaned = []
    for t in turns:
        txt = t['text_ja'].strip()
        d_ja = t['direction_ja'].strip()
        spk = t['speaker']
        if not txt and not d_ja:
            continue
        m = re.search(r'（(.*?)）', txt)
        if m:
            d_ja = (d_ja + ' ' + m.group(1)).strip()
            txt = re.sub(r'（.*?）', '', txt).strip()
        cleaned.append({
            'type': t['type'],
            'speaker': spk,
            'speaker_en': SPEAKER_EN_MAP.get(spk, spk),
            'text_ja': txt,
            'direction_ja': d_ja
        })
        if len(cleaned) >= max_count:
            break
    return cleaned

def repair_nemurenai():
    print("\n--- Repairing nemurenai (眠れない夜なんてない) ---")
    src_file = os.path.join(SRC_PLAYS_DIR, "nemurenai.json")
    with open(src_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Update characters list with full ensemble
    data["characters"] = NEMURENAI_CHARACTERS
    print(f"  Updated characters with {len(data['characters'])} ensemble members")

    # 2. Extract clean turns from PDF
    pdf_path = os.path.join(PROJECT_ROOT, "plays", "眠れない夜なんてない.pdf")
    doc = fitz.open(pdf_path)

    scene_configs = [
        {"num": 1, "start": 2, "end": 7, "count": 53},
        {"num": 2, "start": 11, "end": 16, "count": 53},
        {"num": 3, "start": 31, "end": 36, "count": 54}
    ]

    for cfg in scene_configs:
        s_num = cfg["num"]
        scene = data["scenes"][s_num - 1]
        print(f"  Extracting Scene {s_num} turns from pages {cfg['start']+1}-{cfg['end']}...")
        turns = extract_nemurenai_section(doc, cfg["start"], cfg["end"], cfg["count"])

        # Translate turns
        print(f"  Translating Scene {s_num} ({len(turns)} turns)...")
        translations = batch_translate(turns, data["title_ja"])
        for i, t in enumerate(turns):
            if i < len(translations):
                t["text_en"] = translations[i].get("text_en", "")
                t["direction_en"] = translations[i].get("direction_en", "")
            else:
                t["text_en"] = ""
                t["direction_en"] = ""

        # Annotate NLP (ruby, romaji, ruby_romaji)
        print(f"  Annotating NLP for Scene {s_num}...")
        for idx, t in enumerate(turns):
            t["chunk_index"] = idx + 1
            t["id"] = f"nemurenai_s{s_num}_c{idx+1}"
            annotate_chunk_nlp(t)

        scene["chunks"] = turns
        scene["chunk_count"] = len(turns)
        scene["dialogue_count"] = sum(1 for c in turns if c.get("type") == "dialogue")
        print(f"  Scene {s_num}: {len(turns)} chunks (dialogues: {scene['dialogue_count']})")

    data["total_lines"] = sum(s["chunk_count"] for s in data["scenes"])
    save_play_lockstep("nemurenai", data)

def main():
    print("==================================================")
    print("Starting Play Restructuring & Character Repair")
    print("==================================================")
    repair_hansuu()
    repair_highway()
    repair_itsutaka()
    repair_lion()
    repair_nemurenai()
    print("\n All 5 plays successfully repaired and synchronized in lockstep!")

if __name__ == "__main__":
    main()
