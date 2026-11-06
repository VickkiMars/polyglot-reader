#!/usr/bin/env python3
"""
Japanese Play Pipeline: Script Parsing, Bilingual Translation,
Ruby Furigana Annotation, Audio Synthesis & Segment Map Construction.
"""

import os
import sys
import json
import re
import html
import asyncio
import subprocess
from bs4 import BeautifulSoup
from openai import OpenAI
import pykakasi
from janome.tokenizer import Tokenizer
import edge_tts

# Environment setup
KEY = os.environ.get("OPENAI_API_KEY")
if not KEY:
    for env_path in [".env", ".env.local", "/home/kami/Desktop/codebase/sental/translation_sandbox/.env"]:
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("OPENAI_API_KEY"):
                        KEY = line.split("=", 1)[1].strip()
                        break
        if KEY:
            break

client = OpenAI(api_key=KEY) if KEY else None

# Directories
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PLAYS_DIR = os.path.join(PROJECT_ROOT, "src", "data", "plays")
PUB_PLAYS_DIR = os.path.join(PROJECT_ROOT, "public", "plays")
PUB_AUDIO_DIR = os.path.join(PROJECT_ROOT, "public", "audio", "plays")
SCRATCH_DIR = os.path.join(PROJECT_ROOT, "tmp_play_audio")

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

def parse_kamifusen_html(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    title = soup.find("h1", class_="title").get_text().strip()
    author = soup.find("h2", class_="author").get_text().strip()
    main = soup.find("div", class_="main_text")
    raw_nodes = [c.get_text().strip() for c in main.children if hasattr(c, "get_text") and c.get_text().strip()]

    cleaned = [n for n in raw_nodes if not n.startswith("［＃") and n not in ["人物", "夫", "妻", "時　　晴れた日曜の午後", "所　　庭に面した座敷"]]

    items = []
    for el in cleaned:
        m = re.match(r"^(夫|妻)\s*(?:（(.*?)）)?\s*(.*)", el, re.DOTALL)
        if m:
            speaker = m.group(1)
            direction = m.group(2) or ""
            text = m.group(3) or ""
            items.append({"speaker": speaker, "direction": direction, "text": text.strip()})
        elif el.startswith("（") and el.endswith("）"):
            items.append({"speaker": "STAGE", "direction": el[1:-1].strip(), "text": ""})
        elif el == "――幕――":
            items.append({"speaker": "STAGE", "direction": "幕 (Curtain)", "text": ""})
        elif items and items[-1]["speaker"] != "STAGE":
            items[-1]["text"] += ("\n" if items[-1]["text"] else "") + el.strip()
        else:
            items.append({"speaker": "STAGE", "direction": el.strip(), "text": ""})

    return title, author, items

def partition_scenes(items):
    # Scene 1: 0 to 65
    # Scene 2: 66 to 140
    # Scene 3: 141 to 205
    # Scene 4: 206 to end
    scenes_data = [
        {
            "id": 1,
            "title_ja": "第一場：けだるい日曜日",
            "title_en": "Scene 1: The Languid Sunday Afternoon",
            "description_ja": "日曜日のお茶の間。夫は新聞の目白文化村の広告を読み、妻は縁側で編物をしている。退屈を持て余した二人の何気ない会話。",
            "description_en": "A quiet Sunday sitting room. The husband reads an advertisement for the Mejiro Cultural Village from the paper while the wife knits by the veranda. A languid domestic dialogue.",
            "items": items[0:66]
        },
        {
            "id": 2,
            "title_ja": "第二場：旅への憧憬と海辺",
            "title_en": "Scene 2: Daydreams of Travel & The Seaside",
            "description_ja": "どこかへ汽車で出かけようと持ちかける夫。鎌倉や逗子の海岸、テニスやサンドウヰツチの空想が膨らむ。",
            "description_en": "The husband proposes taking a train trip somewhere. Fantasies of Kamakura, seaside strolls in Zushi, tennis, and train sandwiches begin to blossom.",
            "items": items[66:141]
        },
        {
            "id": 3,
            "title_ja": "第三場：お金の現実と富くじ",
            "title_en": "Scene 3: Financial Realities & The Lottery Ticket",
            "description_ja": "空想から一転、旅費や貯金通帳の残高、給料の現実に引き戻される二人。夫の買つた富くじ（宝くじ）を巡る微妙な心理戦。",
            "description_en": "Coming down from fantasy, the couple is confronted by the costs of travel, bank balances, and salary constraints. A subtle sparring over a lottery ticket.",
            "items": items[141:206]
        },
        {
            "id": 4,
            "title_ja": "第四場：紙風船の行方",
            "title_en": "Scene 4: The Flight of the Paper Balloon",
            "description_ja": "二人が初めて出会った郊外の停車場の思い出。突然、庭に大きな紙風船が飛んで来て、二人は夢中で風船をつき合ふ。",
            "description_en": "Reminiscing about how they first met at a suburban train station. Suddenly, a large paper balloon rolls into the garden, and the two bat it back and forth with unspoken affection.",
            "items": items[206:]
        }
    ]
    return scenes_data

def batch_translate_items(items, cache_file):
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached = json.load(f)
            if len(cached) == len(items):
                print(f"Loaded {len(cached)} translations from cache: {cache_file}")
                return cached
        except Exception as e:
            print("Cache load error:", e)

    translations = []
    chunk_size = 20
    print(f"Translating {len(items)} items using GPT-4o-mini...")

    for i in range(0, len(items), chunk_size):
        batch = items[i:i+chunk_size]
        prompt_lines = []
        for idx, it in enumerate(batch):
            prompt_lines.append({
                "index": idx,
                "speaker": it["speaker"],
                "direction": it["direction"],
                "text": it["text"]
            })

        system_prompt = (
            "You are an expert theatrical translator specializing in modern Japanese drama (Taisho/Showa era). "
            "Translate the given dialogue turns and stage directions into natural, dramatic stage English. "
            "Maintain the tone: the husband (夫) is a somewhat bored, affectionate, slightly pompous young company worker; "
            "the wife (妻) is wry, quick-witted, and practical. "
            "Return JSON object: {\"translations\": [{\"index\": 0, \"direction_en\": \"...\", \"text_en\": \"...\"}, ...]}"
        )

        try:
            res = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(prompt_lines, ensure_ascii=False)}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            data = json.loads(res.choices[0].message.content)
            batch_trans = {t["index"]: t for t in data.get("translations", [])}
            for idx, it in enumerate(batch):
                t_info = batch_trans.get(idx, {})
                translations.append({
                    "direction_en": t_info.get("direction_en", ""),
                    "text_en": t_info.get("text_en", "")
                })
            print(f"  Translated {min(i+chunk_size, len(items))}/{len(items)} items")
        except Exception as e:
            print(f"Translation batch failed at {i}:", e)
            for it in batch:
                translations.append({"direction_en": "", "text_en": it["text"]})

    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(translations, f, ensure_ascii=False, indent=2)

    return translations

async def synthesize_turn_audio(text, voice, out_path):
    if os.path.exists(out_path) and os.path.getsize(out_path) > 500:
        return
    communicate = edge_tts.Communicate(text, voice, rate="-4%")
    await communicate.save(out_path)

def get_audio_duration_seconds(file_path):
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", file_path
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        return float(res.stdout.strip())
    except:
        return 0.0

def generate_silence_mp3(duration_sec, out_path):
    cmd = [
        "ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r=24000:cl=mono",
        "-t", str(duration_sec), "-q:a", "9", "-acodec", "libmp3lame", out_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

async def build_scene_audio_and_chunks(scene_idx, scene_items, scene_trans):
    scene_audio_file = os.path.join(PUB_AUDIO_DIR, f"kamifusen_scene_{scene_idx}.mp3")
    silence_short = os.path.join(SCRATCH_DIR, "silence_0.5s.mp3")
    silence_pause = os.path.join(SCRATCH_DIR, "silence_1.5s.mp3")
    generate_silence_mp3(0.5, silence_short)
    generate_silence_mp3(1.5, silence_pause)

    chunks = []
    audio_segments_to_concat = []
    current_time = 0.0

    print(f"\nProcessing Scene {scene_idx} Audio ({len(scene_items)} items)...")

    for idx, (it, tr) in enumerate(zip(scene_items, scene_trans)):
        speaker = it["speaker"]
        direction_ja = it["direction"]
        direction_en = tr.get("direction_en", "")
        text_ja = it["text"]
        text_en = tr.get("text_en", "")
        ruby = annotate_text_ruby(text_ja)

        speaker_en = "Husband" if speaker == "夫" else ("Wife" if speaker == "妻" else "Stage")

        if speaker == "STAGE" or not text_ja:
            # Stage direction chunk
            start_time = current_time
            pause_dur = 1.5 if "間" in direction_ja or "沈黙" in direction_ja else 0.8
            end_time = current_time + pause_dur
            current_time = end_time
            audio_segments_to_concat.append(silence_pause if pause_dur >= 1.0 else silence_short)

            chunks.append({
                "id": f"s{scene_idx}_c{idx+1}",
                "chunk_index": idx + 1,
                "type": "stage_direction",
                "speaker": speaker,
                "speaker_en": speaker_en,
                "direction_ja": direction_ja,
                "direction_en": direction_en,
                "text_ja": "",
                "text_en": "",
                "ruby": "",
                "start": round(start_time, 2),
                "end": round(end_time, 2),
                "duration": round(end_time - start_time, 2)
            })
            continue

        # Voice mapping: 夫 -> ja-JP-KeitaNeural, 妻 -> ja-JP-NanamiNeural
        voice = "ja-JP-KeitaNeural" if speaker == "夫" else "ja-JP-NanamiNeural"
        turn_file = os.path.join(SCRATCH_DIR, f"s{scene_idx}_turn_{idx+1}.mp3")

        await synthesize_turn_audio(text_ja, voice, turn_file)
        dur = get_audio_duration_seconds(turn_file)

        start_time = current_time
        end_time = current_time + dur

        audio_segments_to_concat.append(turn_file)
        # add a small natural gap between lines (0.5s)
        audio_segments_to_concat.append(silence_short)
        current_time = end_time + 0.5

        chunks.append({
            "id": f"s{scene_idx}_c{idx+1}",
            "chunk_index": idx + 1,
            "type": "dialogue",
            "speaker": speaker,
            "speaker_en": speaker_en,
            "direction_ja": direction_ja,
            "direction_en": direction_en,
            "text_ja": text_ja,
            "text_en": text_en,
            "ruby": ruby,
            "start": round(start_time, 2),
            "end": round(end_time, 2),
            "duration": round(dur, 2)
        })

    # Concatenate all audio files into single scene master audio file
    concat_list_file = os.path.join(SCRATCH_DIR, f"concat_scene_{scene_idx}.txt")
    with open(concat_list_file, "w") as f:
        for p in audio_segments_to_concat:
            f.write(f"file '{p}'\n")

    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_list_file, "-c", "copy", scene_audio_file
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    total_dur = get_audio_duration_seconds(scene_audio_file)
    print(f"  Scene {scene_idx} master audio created: {scene_audio_file} ({total_dur:.1f}s)")

    return chunks, f"/audio/plays/kamifusen_scene_{scene_idx}.mp3", round(total_dur, 2)

async def main():
    print("=== POLYGLOT READER JAPANESE PLAY PIPELINE ===")
    html_path = os.path.join(PROJECT_ROOT, "plays", "kamifusen.html")
    if not os.path.exists(html_path):
        html_path = "/home/kami/Desktop/2026/JP/kamifusen.html"

    title, author, items = parse_kamifusen_html(html_path)
    print(f"Loaded play: {title} by {author} ({len(items)} items)")

    scenes_raw = partition_scenes(items)

    cache_file = os.path.join(PROJECT_ROOT, "plays", "kamifusen_translations.json")
    all_translations = batch_translate_items(items, cache_file)

    # Distribute translations to scenes
    processed_scenes = []
    offset = 0
    for s in scenes_raw:
        s_items = s["items"]
        s_trans = all_translations[offset : offset + len(s_items)]
        offset += len(s_items)

        chunks, audio_url, total_dur = await build_scene_audio_and_chunks(s["id"], s_items, s_trans)

        processed_scenes.append({
            "id": s["id"],
            "scene_number": s["id"],
            "title_ja": s["title_ja"],
            "title_en": s["title_en"],
            "description_ja": s["description_ja"],
            "description_en": s["description_en"],
            "audio_url": audio_url,
            "duration": total_dur,
            "chunk_count": len(chunks),
            "dialogue_count": sum(1 for c in chunks if c["type"] == "dialogue"),
            "chunks": chunks
        })

    play_metadata = {
        "id": "kamifusen",
        "title_ja": "紙風船（一幕）",
        "title_en": "Paper Balloon (One Act)",
        "author_ja": "岸田國士",
        "author_en": "Kunio Kishida",
        "year": 1925,
        "jlpt_level": "N3-N2",
        "category": "Classic Modern Drama",
        "characters": [
            {
                "name_ja": "夫",
                "name_en": "Husband",
                "role_description": "Salaried company worker in suburban Tokyo; slightly pompous yet tenderly attached to his wife.",
                "voice": "ja-JP-KeitaNeural / OpenAI onyx",
                "gender": "male"
            },
            {
                "name_ja": "妻",
                "name_en": "Wife",
                "role_description": "Young homemaker; sharp, witty, practical, and secretly fond of whimsical daydreams.",
                "voice": "ja-JP-NanamiNeural / OpenAI nova",
                "gender": "female"
            }
        ],
        "setting": {
            "time_ja": "晴れた日曜の午後",
            "time_en": "A clear, sunny Sunday afternoon",
            "place_ja": "庭に面した座敷",
            "place_en": "A traditional Japanese sitting room (tatami) facing the garden"
        },
        "synopsis_en": (
            "Kamifusen (1925) is Kunio Kishida's seminal modernist one-act masterpiece. Set in a quiet Tokyo home "
            "on a lazy Sunday afternoon, a young married couple spars over newspaper ads, dreams of a spontaneous "
            "holiday to Kamakura, worries about their monthly budget, and ultimately finds genuine tenderness "
            "when a colorful paper balloon floats unexpectedly into their garden."
        ),
        "synopsis_ja": (
            "大正末期の東京郊外。晴れた日曜の午後、縁側でお茶を濁す若夫婦の何気ない会話から、"
            "目白文化村の広告、鎌倉への小旅行の夢、現実の生活苦や富くじをめぐる心理の綾が軽妙に描かれる。"
            "突然庭へ舞い込んできた紙風船が、二人の心の距離をふわりと縮める名作戯曲。"
        ),
        "total_scenes": len(processed_scenes),
        "total_lines": len(items),
        "scenes": processed_scenes
    }

    # Save to src/data/plays and public/plays
    src_out = os.path.join(SRC_PLAYS_DIR, "kamifusen.json")
    pub_out = os.path.join(PUB_PLAYS_DIR, "kamifusen.json")
    with open(src_out, "w", encoding="utf-8") as f:
        json.dump(play_metadata, f, ensure_ascii=False, indent=2)
    with open(pub_out, "w", encoding="utf-8") as f:
        json.dump(play_metadata, f, ensure_ascii=False, indent=2)

    # Plays Catalog
    catalog = [{
        "id": "kamifusen",
        "title_ja": "紙風船（一幕）",
        "title_en": "Paper Balloon",
        "author_ja": "岸田國士",
        "author_en": "Kunio Kishida",
        "year": 1925,
        "jlpt_level": "N3-N2",
        "scene_count": len(processed_scenes),
        "total_chunks": sum(s["chunk_count"] for s in processed_scenes),
        "total_duration": sum(s["duration"] for s in processed_scenes),
        "cover_image": "/plays/kamifusen_cover.jpg",
        "summary": "Modernist domestic masterwork exploring intimacy, dreams, and domestic reality through witty dialogue and a drifting paper balloon."
    }]
    with open(os.path.join(SRC_PLAYS_DIR, "plays_catalog.json"), "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    with open(os.path.join(PUB_PLAYS_DIR, "plays_catalog.json"), "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    print(f"\n[SUCCESS] Generated play data saved to {src_out} and {pub_out}")
    print(f"[SUCCESS] Plays catalog saved to {SRC_PLAYS_DIR}/plays_catalog.json")

if __name__ == "__main__":
    asyncio.run(main())
