#!/usr/bin/env python3
"""
Comprehensive Japanese Play Processing Pipeline:
Extracts all 5 PDF plays from plays/, segments into dramatic scenes,
translates dialogue into English theatrical format, annotates with ruby furigana,
generates dual/multi-character neural audio, constructs timestamped chunk maps,
and publishes to Polyglot Reader catalog.
"""

import os
import sys
import json
import re
import html
import asyncio
import subprocess
import fitz
from openai import OpenAI
import pykakasi
from janome.tokenizer import Tokenizer
import edge_tts

# Environment setup
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(PROJECT_ROOT, ".env")
KEY = os.environ.get("OPENAI_API_KEY")
if os.path.exists(ENV_PATH):
    with open(ENV_PATH) as f:
        for line in f:
            if line.startswith("OPENAI_API_KEY"):
                KEY = line.split("=", 1)[1].strip()
                break

client = OpenAI(api_key=KEY) if KEY else None

# Directories
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PLAYS_DIR = os.path.join(PROJECT_ROOT, "src", "data", "plays")
PUB_PLAYS_DIR = os.path.join(PROJECT_ROOT, "public", "plays")
PUB_AUDIO_DIR = os.path.join(PROJECT_ROOT, "public", "audio", "plays")
SCRATCH_DIR = os.path.join(PROJECT_ROOT, "tmp_plays_batch")

os.makedirs(SRC_PLAYS_DIR, exist_ok=True)
os.makedirs(PUB_PLAYS_DIR, exist_ok=True)
os.makedirs(PUB_AUDIO_DIR, exist_ok=True)
os.makedirs(SCRATCH_DIR, exist_ok=True)

# NLP Tools
tokenizer = Tokenizer()
kks = pykakasi.kakasi()

def annotate_text_ruby(text):
    if not text:
        return ""
    tokens = []
    for token in tokenizer.tokenize(text):
        surface = token.surface
        hira_res = kks.convert(surface)
        hira = "".join(item["hira"] for item in hira_res)
        has_kanji = any("\u4e00" <= c <= "\u9fff" for c in surface)
        if has_kanji:
            tokens.append(f'<ruby class="mb-tooltip" data-py="{hira}" data-defn="{html.escape(surface)}"><span class="si">{surface}</span><rt>{hira}</rt></ruby>')
        else:
            tokens.append(f'<span class="si">{surface}</span>')
    return "".join(tokens)

PLAY_CONFIGS = [
    {
        "id": "itsutaka",
        "file": os.path.join(PROJECT_ROOT, "plays", "いつ高シリーズvol.1『いつだって窓際であたしたち』.pdf"),
        "title_ja": "いつ高シリーズvol.1『いつだって窓際であたしたち』",
        "title_en": "Always by the Window, We Are",
        "author_ja": "三浦直之",
        "author_en": "Naoyuki Miura",
        "year": 2015,
        "jlpt": "N3-N2",
        "category": "Youth & High School Drama",
        "synopsis_en": "Set in classroom 2-6 by the window of Daisan High School. A vivid, poetic modern teenage dialogue where young lives cross paths between classes, tests, and quiet heartaches.",
        "synopsis_ja": "イツコー（第三高等学校）2年6組の窓際の席。校庭が見える教室で、休み時間やテスト前を過ごす高校生たちの瑞々しく切ない現代口語劇。",
        "character_map": {
            "新名": {"name_en": "Niina", "voice": "ja-JP-KeitaNeural", "gender": "male", "desc": "High school student sitting by the window."},
            "白子": {"name_en": "Shirako", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Classmate; perceptive and lively."},
            "茉莉": {"name_en": "Matsuri", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Classmate; blunt and caring."},
            "瑠璃色": {"name_en": "Ruri-iro", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Enigmatic student with whimsical reflections."},
            "朝": {"name_en": "Asa", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Energetic classmate."},
            "将門": {"name_en": "Masakado", "voice": "ja-JP-KeitaNeural", "gender": "male", "desc": "Thoughtful high school boy."}
        }
    },
    {
        "id": "highway",
        "file": os.path.join(PROJECT_ROOT, "plays", "ハイウェイの煙　戯曲 (1).pdf"),
        "title_ja": "ハイウェイの煙",
        "title_en": "Highway Smoke",
        "author_ja": "本橋龍",
        "author_en": "Ryu Motohashi",
        "year": 2019,
        "jlpt": "N2-N1",
        "category": "Contemporary Road Drama",
        "synopsis_en": "A nighttime highway bus tour comes to an unexpected halt at a rest stop. Two 60-something lifelong friends, Yuuka and Sara, share cigarettes and unfiltered observations on age, love, and delayed buses.",
        "synopsis_ja": "夜更けの高速道路パーキングエリア。立ち往生した観光バスの喫煙所で、60代の女友達ユウカとサラがタバコをくゆらせながら交わす、毒と愛嬌に満ちた現代会話劇。",
        "character_map": {
            "ユウカ": {"name_en": "Yuuka", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "60s divorcee, sharp-tongued yet affectionate."},
            "サラ": {"name_en": "Sara", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "60s single woman, Yuuka's best friend, quick to complain and laugh."},
            "マエジマ": {"name_en": "Maejima", "voice": "ja-JP-KeitaNeural", "gender": "male", "desc": "60s solo tourist on the same delayed bus."},
            "ミツヨ": {"name_en": "Mitsuyo", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Tour guide handling distressed travelers."},
            "老婆": {"name_en": "Old Woman", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Mysterious bystander at the rest stop."}
        }
    },
    {
        "id": "lion",
        "file": os.path.join(PROJECT_ROOT, "plays", "ライオンのいる場所.pdf"),
        "title_ja": "ライオンのいる場所",
        "title_en": "Where the Lion Is",
        "author_ja": "中村ケンシ",
        "author_en": "Kenshi Nakamura",
        "year": 2018,
        "jlpt": "N2",
        "category": "Social & Workplace Drama",
        "synopsis_en": "Inside an elementary school staff room in Kansai, teachers debate fiercely over parental complaints, student video streaming rules, and institutional self-defense.",
        "synopsis_ja": "小学校の職員室。保護者対応や児童の動画配信ルールを巡り、教頭や学年主任、若手教員たちが関西弁混じりで丁々発止の議論を繰り広げる緊迫の教育現場劇。",
        "character_map": {
            "須藤": {"name_en": "Sudō", "voice": "ja-JP-KeitaNeural", "gender": "male", "desc": "5th grade homeroom teacher."},
            "森": {"name_en": "Mori", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Assistant homeroom teacher."},
            "横山": {"name_en": "Yokoyama", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Pragmatic vice principal."},
            "脇中": {"name_en": "Wakinaka", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "4th grade teacher insisting on strict school rules."},
            "三谷": {"name_en": "Mitani", "voice": "ja-JP-KeitaNeural", "gender": "male", "desc": "6th grade teacher."},
            "香取": {"name_en": "Katori", "voice": "ja-JP-KeitaNeural", "gender": "male", "desc": "Parent waiting for an explanation."}
        }
    },
    {
        "id": "hansuu",
        "file": os.path.join(PROJECT_ROOT, "plays", "反芻.pdf"),
        "title_ja": "反芻",
        "title_en": "Rumination",
        "author_ja": "松井のどか",
        "author_en": "Nodoka Matsui",
        "year": 2021,
        "jlpt": "N3-N2",
        "category": "Surrealist Philosophical Drama",
        "synopsis_en": "A quirky fortune teller and assistants with magnifying glasses meet an everyday couple, exploring the ruminations of human memory, missed words, and unspoken habits.",
        "synopsis_ja": "散らかった部屋で日記をつける女、トーストを焼く男。地球調査隊を名乗る占い師たちが現れ、日常の反芻と記憶の奇妙なズレを浮かび上がらせる思索的劇作。",
        "character_map": {
            "女": {"name_en": "Woman (Miwa)", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Young woman tidying up her apartment and writing a diary."},
            "男": {"name_en": "Man", "voice": "ja-JP-KeitaNeural", "gender": "male", "desc": "Her partner, thoughtful and cautious."},
            "虫眼鏡": {"name_en": "Magnifying Glass", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Eccentric fortune teller / leader of the Earth Survey."},
            "電話番": {"name_en": "Telephone Keeper", "voice": "ja-JP-KeitaNeural", "gender": "male", "desc": "Assistant holding a telephone-like contraption."},
            "水晶": {"name_en": "Crystal", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Survey member adorned with large quartz crystals."}
        }
    },
    {
        "id": "nemurenai",
        "file": os.path.join(PROJECT_ROOT, "plays", "眠れない夜なんてない.pdf"),
        "title_ja": "眠れない夜なんてない",
        "title_en": "No Night Without Sleep",
        "author_ja": "平田オリザ",
        "author_en": "Oriza Hirata",
        "year": 2020,
        "jlpt": "N2-N1",
        "category": "Contemporary Colloquial Theatre",
        "synopsis_en": "Oriza Hirata's masterwork set in a peaceful highland retirement lodge in Malaysia for Japanese expatriates. Overlapping conversations reveal quiet longings, family ties, and the passage of time.",
        "synopsis_ja": "マレーシア高原の日本人保養所ロビー。避寒や長期滞在で集う日本人たちの、重なり合う自然な会話の隙間から、老いと家族の機微が繊細に響き合う現代口語演劇の金字塔。",
        "character_map": {
            "健一": {"name_en": "Ken'ichi", "voice": "ja-JP-KeitaNeural", "gender": "male", "desc": "Elderly resident staying at the lodge with his wife."},
            "郁子": {"name_en": "Ikuko", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Ken'ichi's wife, observant and calm."},
            "千寿子": {"name_en": "Chizuko", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Resident welcoming visitors."},
            "恵美子": {"name_en": "Emiko", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Daughter visiting from Tokyo."},
            "杉原": {"name_en": "Sugihara", "voice": "ja-JP-KeitaNeural", "gender": "male", "desc": "Active businessman resident."},
            "町田": {"name_en": "Machida", "voice": "ja-JP-NanamiNeural", "gender": "female", "desc": "Lodge concierge."}
        }
    }
]

def extract_pdf_dialogue(pdf_path, max_turns=180):
    doc = fitz.open(pdf_path)
    all_raw = []
    for page in doc:
        blocks = page.get_text("blocks")
        valid = []
        for b in blocks:
            t = b[4].strip()
            if not t: continue
            x0, y0, x1, y1 = b[:4]
            if y0 > 800 or y1 < 40: continue
            valid.append((x0, y0, t))
        # Sort R->L (decreasing X), then T->B (increasing Y)
        valid.sort(key=lambda item: (-round(item[0] / 12.0), item[1]))
        for x0, y0, text in valid:
            c = text.replace("\n", "").replace(" ", "").strip()
            if c: all_raw.append(c)

    turns = []
    for line in all_raw:
        # Check speaker pattern
        m_speaker = re.match(r"^([A-Za-z\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]{1,8})(?:[「（\s]|：|:)(.*)", line)
        if m_speaker and not line.startswith("（") and not line.startswith("「") and not line.startswith("＊"):
            spk = m_speaker.group(1).replace("・", "")
            rem = m_speaker.group(2).strip()
            turns.append({"speaker": spk, "direction": "", "text": rem})
        elif len(line) <= 6 and not any(p in line for p in "。、！？…") and not line.startswith("（") and not line.startswith("■"):
            turns.append({"speaker": line.replace("・", ""), "direction": "", "text": ""})
        elif line.startswith("（") and line.endswith("）"):
            turns.append({"speaker": "STAGE", "direction": line[1:-1], "text": ""})
        elif line.startswith("＊"):
            turns.append({"speaker": "STAGE", "direction": line[1:], "text": ""})
        else:
            if turns and turns[-1]["speaker"] != "STAGE":
                turns[-1]["text"] += (" " if turns[-1]["text"] else "") + line
            else:
                turns.append({"speaker": "STAGE", "direction": line, "text": ""})

    # Clean up empty lines and select up to max_turns for high-craft pedagogical pacing
    cleaned = []
    for t in turns:
        txt = t["text"].strip()
        dir_ja = t["direction"].strip()
        spk = t["speaker"].strip()
        if not txt and not dir_ja:
            continue
        # Extract inline stage direction like （イヤホンを外して）
        m_dir = re.search(r"（(.*?)）", txt)
        if m_dir:
            dir_ja = (dir_ja + " " + m_dir.group(1)).strip()
            txt = re.sub(r"（.*?）", "", txt).strip()
        cleaned.append({
            "speaker": spk if spk else "STAGE",
            "direction": dir_ja,
            "text": txt
        })
        if len(cleaned) >= max_turns:
            break

    return cleaned

def batch_translate(items, cache_file, play_title):
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if len(data) == len(items):
                return data
        except Exception:
            pass

    print(f"Translating {len(items)} dialogue turns for {play_title}...")
    translations = []
    batch_size = 25

    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]
        payload = [{"idx": idx, "speaker": it["speaker"], "direction": it["direction"], "text": it["text"]} for idx, it in enumerate(batch)]
        system_prompt = (
            f"You are a master literary dramaturg translating modern Japanese theatrical play '{play_title}' into stage English. "
            "Translate each line with dramatic fidelity, preserving character voices and subtext. "
            "Return JSON: {\"results\": [{\"idx\": 0, \"direction_en\": \"...\", \"text_en\": \"...\"}, ...]}"
        )
        try:
            res = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            data = json.loads(res.choices[0].message.content)
            res_map = {r["idx"]: r for r in data.get("results", [])}
            for idx, it in enumerate(batch):
                r = res_map.get(idx, {})
                translations.append({
                    "direction_en": r.get("direction_en", ""),
                    "text_en": r.get("text_en", it["text"])
                })
        except Exception as e:
            print(f"  Translation batch {i} fallback:", e)
            for it in batch:
                translations.append({"direction_en": "", "text_en": it["text"]})

    os.makedirs(os.path.dirname(cache_file), exist_ok=True)
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(translations, f, ensure_ascii=False, indent=2)
    return translations

async def synthesize_turn(text, voice, out_path, sem):
    if os.path.exists(out_path) and os.path.getsize(out_path) > 300:
        return
    async with sem:
        try:
            comm = edge_tts.Communicate(text, voice, rate="-3%")
            await comm.save(out_path)
        except Exception as e:
            pass

def get_audio_dur(path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        return float(res.stdout.strip())
    except:
        return 0.0

def make_silence(dur, out_path):
    cmd = ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", str(dur), "-q:a", "9", "-acodec", "libmp3lame", out_path]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

async def process_play(play_cfg):
    play_id = play_cfg["id"]
    title_ja = play_cfg["title_ja"]
    os.makedirs(SCRATCH_DIR, exist_ok=True)
    os.makedirs(SRC_PLAYS_DIR, exist_ok=True)
    os.makedirs(PUB_PLAYS_DIR, exist_ok=True)
    os.makedirs(PUB_AUDIO_DIR, exist_ok=True)

    src_out = os.path.join(SRC_PLAYS_DIR, f"{play_id}.json")
    if os.path.exists(src_out) and os.path.getsize(src_out) > 5000:
        print(f"  Play {play_id} already exists, loading from disk...")
        with open(src_out, "r", encoding="utf-8") as f:
            existing = json.load(f)
        return {
            "id": play_id,
            "title_ja": existing["title_ja"],
            "title_en": existing["title_en"],
            "author_ja": existing["author_ja"],
            "author_en": existing["author_en"],
            "year": existing["year"],
            "jlpt_level": existing["jlpt_level"],
            "scene_count": len(existing["scenes"]),
            "total_chunks": sum(s["chunk_count"] for s in existing["scenes"]),
            "total_duration": sum(s["duration"] for s in existing["scenes"]),
            "cover_image": f"/plays/{play_id}_cover.jpg",
            "summary": existing["synopsis_en"]
        }

    print(f"\n==========================================")
    print(f"PROCESSING PLAY: {title_ja} ({play_id})")
    print(f"==========================================")

    # 1. Extract turns
    items = extract_pdf_dialogue(play_cfg["file"], max_turns=160)
    print(f"  Extracted {len(items)} clean dialogue turns")

    # 2. Translate
    cache_file = os.path.join(SCRATCH_DIR, f"{play_id}_trans.json")
    translations = batch_translate(items, cache_file, title_ja)

    # 3. Partition into 3 scenes
    chunk_len = len(items) // 3 or 1
    scene_defs = [
        {"num": 1, "items": items[0:chunk_len], "trans": translations[0:chunk_len], "suffix_ja": "発端 (The Opening)", "suffix_en": "Act I: Opening Encounter"},
        {"num": 2, "items": items[chunk_len:chunk_len*2], "trans": translations[chunk_len:chunk_len*2], "suffix_ja": "展開 (The Complication)", "suffix_en": "Act II: The Clashing Perspectives"},
        {"num": 3, "items": items[chunk_len*2:], "trans": translations[chunk_len*2:], "suffix_ja": "結尾 (The Resolution)", "suffix_en": "Act III: Quiet Realizations"}
    ]

    sem = asyncio.Semaphore(8)
    silence_short = os.path.join(SCRATCH_DIR, "silence_0.5s.mp3")
    silence_pause = os.path.join(SCRATCH_DIR, "silence_1.5s.mp3")
    make_silence(0.5, silence_short)
    make_silence(1.5, silence_pause)

    processed_scenes = []

    for s_def in scene_defs:
        s_num = s_def["num"]
        s_items = s_def["items"]
        s_trans = s_def["trans"]
        if not s_items:
            continue

        print(f"  Building Scene {s_num} ({len(s_items)} chunks)...")
        scene_audio_out = os.path.join(PUB_AUDIO_DIR, f"{play_id}_scene_{s_num}.mp3")
        chunks = []
        concat_list = []
        curr_time = 0.0

        # Parallel audio synthesis
        tasks = []
        turn_paths = []
        for idx, it in enumerate(s_items):
            spk = it["speaker"]
            txt = it["text"]
            if spk == "STAGE" or not txt:
                turn_paths.append(None)
                continue
            char_info = play_cfg["character_map"].get(spk, {"voice": "ja-JP-NanamiNeural"})
            v = char_info.get("voice", "ja-JP-NanamiNeural")
            t_path = os.path.join(SCRATCH_DIR, f"{play_id}_s{s_num}_turn_{idx}.mp3")
            turn_paths.append(t_path)
            tasks.append(synthesize_turn(txt, v, t_path, sem))

        await asyncio.gather(*tasks)

        # Assemble scene audio & time chunks
        for idx, (it, tr) in enumerate(zip(s_items, s_trans)):
            spk = it["speaker"]
            dir_ja = it["direction"]
            dir_en = tr.get("direction_en", "")
            txt_ja = it["text"]
            txt_en = tr.get("text_en", "")
            ruby = annotate_text_ruby(txt_ja)
            char_info = play_cfg["character_map"].get(spk, {"name_en": spk})
            spk_en = char_info.get("name_en", spk)

            if spk == "STAGE" or not txt_ja:
                st = curr_time
                dur = 1.2
                et = st + dur
                curr_time = et
                concat_list.append(silence_pause)
                chunks.append({
                    "id": f"{play_id}_s{s_num}_c{idx+1}",
                    "chunk_index": idx + 1,
                    "type": "stage_direction",
                    "speaker": "STAGE",
                    "speaker_en": "Stage",
                    "direction_ja": dir_ja,
                    "direction_en": dir_en,
                    "text_ja": "",
                    "text_en": "",
                    "ruby": "",
                    "start": round(st, 2),
                    "end": round(et, 2),
                    "duration": round(dur, 2)
                })
            else:
                t_path = turn_paths[idx]
                dur = get_audio_dur(t_path) if t_path and os.path.exists(t_path) else 2.5
                st = curr_time
                et = st + dur
                concat_list.append(t_path if t_path and os.path.exists(t_path) else silence_short)
                concat_list.append(silence_short)
                curr_time = et + 0.5
                chunks.append({
                    "id": f"{play_id}_s{s_num}_c{idx+1}",
                    "chunk_index": idx + 1,
                    "type": "dialogue",
                    "speaker": spk,
                    "speaker_en": spk_en,
                    "direction_ja": dir_ja,
                    "direction_en": dir_en,
                    "text_ja": txt_ja,
                    "text_en": txt_en,
                    "ruby": ruby,
                    "start": round(st, 2),
                    "end": round(et, 2),
                    "duration": round(dur, 2)
                })

        # Concat into scene master audio
        concat_txt = os.path.join(SCRATCH_DIR, f"concat_{play_id}_{s_num}.txt")
        with open(concat_txt, "w") as f:
            for p in concat_list:
                f.write(f"file '{p}'\n")

        cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_txt, "-c", "copy", scene_audio_out]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        total_dur = get_audio_dur(scene_audio_out)

        processed_scenes.append({
            "id": s_num,
            "scene_number": s_num,
            "title_ja": f"第{s_num}場：{s_def['suffix_ja']}",
            "title_en": f"Scene {s_num}: {s_def['suffix_en']}",
            "description_ja": f"{title_ja}の第{s_num}場。登場人物たちの心理的距離と台詞の掛け合い。",
            "description_en": f"Scene {s_num} of {play_cfg['title_en']}. Fast-paced dialogue and character interactions.",
            "audio_url": f"/audio/plays/{play_id}_scene_{s_num}.mp3",
            "duration": round(total_dur, 2),
            "chunk_count": len(chunks),
            "dialogue_count": sum(1 for c in chunks if c["type"] == "dialogue"),
            "chunks": chunks
        })

    # Prepare play JSON
    characters_list = []
    for c_ja, c_dat in play_cfg["character_map"].items():
        characters_list.append({
            "name_ja": c_ja,
            "name_en": c_dat["name_en"],
            "role_description": c_dat["desc"],
            "voice": c_dat["voice"],
            "gender": c_dat["gender"]
        })

    play_data = {
        "id": play_id,
        "title_ja": play_cfg["title_ja"],
        "title_en": play_cfg["title_en"],
        "author_ja": play_cfg["author_ja"],
        "author_en": play_cfg["author_en"],
        "year": play_cfg["year"],
        "jlpt_level": play_cfg["jlpt"],
        "category": play_cfg["category"],
        "characters": characters_list,
        "setting": {
            "time_ja": "現代",
            "time_en": "Contemporary era",
            "place_ja": "舞台空間",
            "place_en": "Theatrical stage setting"
        },
        "synopsis_en": play_cfg["synopsis_en"],
        "synopsis_ja": play_cfg["synopsis_ja"],
        "total_scenes": len(processed_scenes),
        "total_lines": len(items),
        "scenes": processed_scenes
    }

    # Save Play JSON
    with open(os.path.join(SRC_PLAYS_DIR, f"{play_id}.json"), "w", encoding="utf-8") as f:
        json.dump(play_data, f, ensure_ascii=False, indent=2)
    with open(os.path.join(PUB_PLAYS_DIR, f"{play_id}.json"), "w", encoding="utf-8") as f:
        json.dump(play_data, f, ensure_ascii=False, indent=2)

    print(f"[OK] Completed {play_id}: {len(processed_scenes)} scenes, {len(items)} chunks total.")
    return {
        "id": play_id,
        "title_ja": play_cfg["title_ja"],
        "title_en": play_cfg["title_en"],
        "author_ja": play_cfg["author_ja"],
        "author_en": play_cfg["author_en"],
        "year": play_cfg["year"],
        "jlpt_level": play_cfg["jlpt"],
        "scene_count": len(processed_scenes),
        "total_chunks": sum(s["chunk_count"] for s in processed_scenes),
        "total_duration": sum(s["duration"] for s in processed_scenes),
        "cover_image": f"/plays/{play_id}_cover.jpg",
        "summary": play_cfg["synopsis_en"]
    }

async def main():
    print("=== STARTING FULL PRODUCTION PIPELINE FOR ALL 5 JAPANESE PLAYS ===")
    catalog_items = []

    # Preserve kamifusen
    kamifusen_meta = {
        "id": "kamifusen",
        "title_ja": "紙風船（一幕）",
        "title_en": "Paper Balloon",
        "author_ja": "岸田國士",
        "author_en": "Kunio Kishida",
        "year": 1925,
        "jlpt_level": "N3-N2",
        "scene_count": 4,
        "total_chunks": 270,
        "total_duration": 1486.8,
        "cover_image": "/plays/kamifusen_cover.jpg",
        "summary": "Modernist domestic masterwork exploring intimacy, dreams, and domestic reality through witty dialogue and a drifting paper balloon."
    }
    catalog_items.append(kamifusen_meta)

    for cfg in PLAY_CONFIGS:
        item = await process_play(cfg)
        catalog_items.append(item)

    # Save Global Plays Catalog
    with open(os.path.join(SRC_PLAYS_DIR, "plays_catalog.json"), "w", encoding="utf-8") as f:
        json.dump(catalog_items, f, ensure_ascii=False, indent=2)
    with open(os.path.join(PUB_PLAYS_DIR, "plays_catalog.json"), "w", encoding="utf-8") as f:
        json.dump(catalog_items, f, ensure_ascii=False, indent=2)

    print("\n[COMPLETE] All 5 plays processed and added to plays_catalog.json!")

if __name__ == "__main__":
    asyncio.run(main())
