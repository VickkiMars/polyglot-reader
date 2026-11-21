#!/usr/bin/env python3
"""
Prototype Story Chunk Retranslation & Neural Audio Synthesis Engine
Processes Story 23410 ("A Happy Day"):
1. Segments English story into 12 discrete sentence units.
2. Generates 1:1 aligned Japanese sentences with Kokoro-82M audio and ruby annotations.
3. Generates 1:1 aligned Russian sentences with acute stress marks, Silero v4 audio, and ruby annotations.
4. Computes exact millisecond-precision chunk timestamps (start, end, duration).
5. Assembles master MP3 audio files with natural inter-chunk pauses.
6. Synchronizes data in lockstep across:
   - src/data/japanese_details.json & public/stories/japanese/23410.json
   - src/data/russian_details.json & public/stories/russian/23410.json
   - src/data/audio_sizes.json
"""

import os
import sys
import json
import re
import html
import subprocess
import torch
import numpy as np
import soundfile as sf
import torchaudio

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))

import japanese_lexicon_enricher as jp_enricher
from kokoro import KModel, KPipeline
from russian_dictionary import EnglishToRussianDictionary

# Project Paths
SID = "23410"
SLUG = "a-happy-day"

JAPANESE_DETAILS_JSON = os.path.join(BASE_DIR, "src", "data", "japanese_details.json")
RUSSIAN_DETAILS_JSON = os.path.join(BASE_DIR, "src", "data", "russian_details.json")
AUDIO_SIZES_JSON = os.path.join(BASE_DIR, "src", "data", "audio_sizes.json")

PUB_JP_STORY_JSON = os.path.join(BASE_DIR, "public", "stories", "japanese", f"{SID}.json")
PUB_RU_STORY_JSON = os.path.join(BASE_DIR, "public", "stories", "russian", f"{SID}.json")

JP_AUDIO_MP3 = os.path.join(BASE_DIR, "public", "audio", "japanese", f"{SID}_{SLUG}.mp3")
RU_AUDIO_MP3 = os.path.join(BASE_DIR, "public", "audio", "russian", f"{SID}_{SLUG}.mp3")

KOKORO_MODEL_PATH = os.path.join(BASE_DIR, "data", "Kokoro-82M", "kokoro-v1_0.pth")
KOKORO_CONFIG_PATH = os.path.join(BASE_DIR, "data", "Kokoro-82M", "config.json")
KOKORO_VOICES_DIR = os.path.join(BASE_DIR, "data", "Kokoro-82M", "voices")
SILERO_MODEL_PATH = os.path.join(BASE_DIR, "data", "silero_v4_ru.pt")

SAMPLE_RATE = 24000
INTRA_CHUNK_PAUSE = 0.35  # 350ms natural pause between sentences
INTER_PARA_PAUSE = 0.60   # 600ms pause between paragraphs

# 12 Aligned English Sentences for Story 23410
ENGLISH_SENTENCES = [
    "My name is Dawei and I am a student.",
    "Now I am studying Chinese in China.",
    "I have a good friend named Martin.",
    "We are all college students, and we all like China.",
    "We like to eat Chinese food.",
    "The buns, dumplings and noodles are all delicious.",
    "We also like to drink Chinese tea.",
    "Today is Saturday, we don't have classes.",
    "At ten o'clock in the morning, we went to the mall to buy clothes.",
    "In the afternoon we went to see a movie.",
    "We cook our own meals in the evening.",
    "We are very happy today."
]

# 12 Aligned Japanese Sentences (JLPT Compliant)
JAPANESE_SENTENCES = [
    {
        "text": "私の名前はダーウェイで、学生です。",
        "reading": "わたし の なまえ は だーうぇい で、がくせい です。",
        "romaji": "watashi no namae wa daawei de, gakusei desu."
    },
    {
        "text": "今、中国で中国語を勉強しています。",
        "reading": "いま、ちゅうごく で ちゅうごくご を べんきょう して います。",
        "romaji": "ima, chuugoku de chuugokugo o benkyou shite imasu."
    },
    {
        "text": "仲の良い友達にマーティンがいます。",
        "reading": "なか の いい ともだち に まーてぃん が います。",
        "romaji": "naka no ii tomodachi ni maatin ga imasu."
    },
    {
        "text": "私たちは二人とも大学生で、中国が大好きです。",
        "reading": "わたしたち は ふたり とも だいがくせい で、ちゅうごく が だいすき です。",
        "romaji": "watashitachi wa futari tomo daigakusei de, chuugoku ga daisuki desu."
    },
    {
        "text": "中華料理を食べるのが好きです。",
        "reading": "ちゅうかりょうり を たべる の が すき です。",
        "romaji": "chuukaryouri o taberu no ga suki desu."
    },
    {
        "text": "中華まんも餃子も麺もどれもおいしいです。",
        "reading": "ちゅうかまん も ぎょうざ も めん も どれ も おいしい です。",
        "romaji": "chuukaman mo gyouza mo men mo dore mo oishii desu."
    },
    {
        "text": "中国茶を飲むのも好きです。",
        "reading": "ちゅうごくちゃ を のむ の も すき です。",
        "romaji": "chuugokucha o nomu no mo suki desu."
    },
    {
        "text": "今日は土曜日で、授業はありません。",
        "reading": "きょう は どようび で、じゅぎょう は ありません。",
        "romaji": "kyou wa doyoubi de, jugyou wa arimasen."
    },
    {
        "text": "午前十時に、服を買いにショッピングモールへ行きました。",
        "reading": "ごぜん じゅうじ に、ふく を かい に しょっぴんぐもーる へ いきました。",
        "romaji": "gozen juuji ni, fuku o kai ni shoppingumooru e ikimashita."
    },
    {
        "text": "午後は映画を観に行きました。",
        "reading": "ごご は えいが を み に いきました。",
        "romaji": "gogo wa eiga o mi ni ikimashita."
    },
    {
        "text": "夜は自分たちで食事を作ります。",
        "reading": "よる は じぶんたち で しょくじ を つくります。",
        "romaji": "yoru wa jibuntachi de shokuji o tsukurimasu."
    },
    {
        "text": "今日はとても楽しい一日でした。",
        "reading": "きょう は とても たのしい いちにち でした。",
        "romaji": "kyou wa totemo tanoshii ichinichi deshita."
    }
]

# 12 Aligned Russian Sentences (TORFL Compliant with Acute Stress Marks \u0301)
RUSSIAN_SENTENCES = [
    {
        "text": "Меня́ зову́т Давэ́й, и я студе́нт.",
        "transliteration": "Menyá zovút Davéy, i ya studént."
    },
    {
        "text": "Сейча́с я изуча́ю кита́йский язы́к в Кита́е.",
        "transliteration": "Seychás ya izucháyu kitáyskiy yazýk v Kitáye."
    },
    {
        "text": "У меня́ есть хоро́ший друг по и́мени Ма́ртин.",
        "transliteration": "U menyá yest' khoróshiy drug po ímeni Mártin."
    },
    {
        "text": "Мы о́ба студе́нты университе́та, и мы о́чень лю́бим Кита́й.",
        "transliteration": "My óba studénty universitéta, i my óchen' lyúbim Kitáy."
    },
    {
        "text": "Мы лю́бим есть кита́йскую еду́.",
        "transliteration": "My lyúbim yest' kitáyskuyu yedú."
    },
    {
        "text": "Паровы́е бу́лочки, пельме́ни и лапша́ — всё о́чень вку́сно.",
        "transliteration": "Parovýye búlochki, pel'méni i lapshá — vsyo óchen' vkúsno."
    },
    {
        "text": "Мы та́кже лю́бим пить кита́йский чай.",
        "transliteration": "My tákzhe lyúbim pit' kitáyskiy chay."
    },
    {
        "text": "Сего́дня суббо́та, у нас нет заня́тий.",
        "transliteration": "Segódnya subbóta, u nas net zanyátiy."
    },
    {
        "text": "В де́сять часо́в утра́ мы пошли́ в торго́вый центр покупа́ть оде́жду.",
        "transliteration": "V désyat' chasóv utrá my poshli v torgóvyy tsentr pokupát' odézhdu."
    },
    {
        "text": "Днём мы пошли́ в кино́.",
        "transliteration": "Dnyom my poshli v kinó."
    },
    {
        "text": "Ве́чером мы са́ми гото́вим себе́ еду́.",
        "transliteration": "Vécherom my sámi gotóvim sebé yedú."
    },
    {
        "text": "Сего́дня был о́чень счастли́вый день.",
        "transliteration": "Segódnya byl óchen' schastlívyy den'."
    }
]

# Russian Dictionary & Glossary Mapping
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

RUSSIAN_LEXICON_GLOSS = {
    "меня": ("me (acc./gen.)", "A1"),
    "зовут": ("is named / they call", "A1"),
    "давэй": ("David (name)", "A1"),
    "студент": ("student / university student", "A1"),
    "студенты": ("students", "A1"),
    "сейчас": ("now / at present", "A1"),
    "изучаю": ("I study / learn (изучать)", "A1"),
    "китайский": ("Chinese (language/adj)", "A1"),
    "китайскую": ("Chinese (acc. fem.)", "A1"),
    "язык": ("language / tongue", "A1"),
    "китае": ("China (prepositional: в Китае)", "A1"),
    "китай": ("China", "A1"),
    "хороший": ("good / nice", "A1"),
    "друг": ("friend", "A1"),
    "имени": ("name (gen. of имя)", "A1"),
    "мартин": ("Martin (name)", "A1"),
    "оба": ("both", "A2"),
    "университета": ("university (genitive)", "A1"),
    "очень": ("very / very much", "A1"),
    "любим": ("we love / like (любить)", "A1"),
    "есть": ("to eat / there is", "A1"),
    "еду": ("food / meal (acc. fem.)", "A1"),
    "паровые": ("steamed (adj. pl.)", "A2"),
    "булочки": ("buns / rolls (baozi)", "A2"),
    "пельмени": ("dumplings (jiaozi)", "A1"),
    "лапша": ("noodles", "A1"),
    "всё": ("all / everything", "A1"),
    "вкусно": ("delicious / tasty", "A1"),
    "также": ("also / as well", "A2"),
    "пить": ("to drink", "A1"),
    "чай": ("tea", "A1"),
    "сегодня": ("today", "A1"),
    "суббота": ("Saturday", "A1"),
    "нет": ("no / there are no (+ gen.)", "A1"),
    "занятий": ("classes / lessons (gen. pl.)", "A1"),
    "десять": ("ten", "A1"),
    "часов": ("hours / o'clock (gen. pl.)", "A1"),
    "утра": ("morning / a.m. (gen. of утро)", "A1"),
    "пошли": ("went (on foot, pl. past)", "A1"),
    "торговый": ("shopping / trade (adj)", "A2"),
    "центр": ("center / mall", "A1"),
    "покупать": ("to buy / shop for", "A1"),
    "одежду": ("clothes / clothing (acc.)", "A1"),
    "днём": ("in the afternoon / by day", "A1"),
    "кино": ("cinema / movie", "A1"),
    "вечером": ("in the evening", "A1"),
    "сами": ("ourselves (emphatic)", "A2"),
    "готовим": ("we cook / prepare (готовить)", "A1"),
    "себе": ("for ourselves (dative reflexive)", "A2"),
    "был": ("was (masc. past of быть)", "A1"),
    "счастливый": ("happy / blessed", "A1"),
    "день": ("day", "A1")
}

def transliterate_russian(word: str) -> str:
    res = []
    for ch in word:
        if ch == '\u0301':
            res.append('\u0301')
        elif ch in CYRILLIC_TO_LATIN:
            res.append(CYRILLIC_TO_LATIN[ch])
        else:
            res.append(ch)
    return "".join(res)

def annotate_russian_chunk(text: str, torfl_default: str = "A1") -> str:
    tokens = re.findall(r"[\w\u0301-]+|[^\w\s\u0301-]+|\s+", text)
    annotated = []
    for tok in tokens:
        clean = tok.strip()
        if not clean or re.match(r"^[^\w\u0301]+$", clean):
            annotated.append(tok)
            continue
        unaccented = clean.replace("\u0301", "").lower()
        translit = transliterate_russian(clean)
        
        if unaccented in RUSSIAN_LEXICON_GLOSS:
            defn, level = RUSSIAN_LEXICON_GLOSS[unaccented]
        else:
            defn, level = unaccented, torfl_default

        safe_w = html.escape(clean)
        safe_tr = html.escape(translit)
        safe_df = html.escape(defn)
        tag = f'<ruby class="mb-tooltip" data-py="{safe_tr}" data-defn="{safe_df}" data-hsk="{level}"><span class="si">{safe_w}</span><rt>{safe_tr}</rt></ruby>'
        annotated.append(tag)
    return "".join(annotated)

def annotate_japanese_chunk(text: str) -> str:
    mock_story = {"japanese_paragraphs": [text], "vocabulary": []}
    _, ruby_paras = jp_enricher.process_story(mock_story, {})
    return ruby_paras[0] if ruby_paras else text

def synthesize_japanese_chunks(pipeline, voice_tensor):
    print("\n--- Synthesizing Kokoro-82M Audio for Japanese Chunks ---")
    chunks = []
    timeline_audio = []
    current_time = 0.0

    for idx, (en_sent, ja_item) in enumerate(zip(ENGLISH_SENTENCES, JAPANESE_SENTENCES)):
        ja_text = ja_item["text"]
        print(f"  [{idx+1}/12] Synthesizing: {ja_text}")

        pieces = []
        with torch.inference_mode():
            for gs, ps, audio in pipeline(ja_text, voice=voice_tensor, speed=0.95):
                pieces.append(audio.cpu().numpy() if isinstance(audio, torch.Tensor) else audio)

        if pieces:
            chunk_tensor = np.concatenate(pieces, axis=0)
        else:
            chunk_tensor = np.zeros(int(SAMPLE_RATE * 1.5), dtype=np.float32)

        dur = round(len(chunk_tensor) / SAMPLE_RATE, 2)
        start_t = round(current_time, 2)
        end_t = round(current_time + dur, 2)

        ruby_html = annotate_japanese_chunk(ja_text)

        chunk = {
            "id": f"story_{SID}_p0_c{idx}",
            "chunk_index": idx,
            "paragraph_index": 0,
            "sentence_index": idx,
            "text": ja_text,
            "text_en": en_sent,
            "ruby": ruby_html,
            "reading": ja_item.get("reading", ""),
            "romaji": ja_item.get("romaji", ""),
            "start": start_t,
            "end": end_t,
            "duration": dur
        }
        chunks.append(chunk)
        timeline_audio.append(chunk_tensor)

        # Silence between chunks
        pause_samples = int(SAMPLE_RATE * INTRA_CHUNK_PAUSE)
        timeline_audio.append(np.zeros(pause_samples, dtype=np.float32))
        current_time = end_t + INTRA_CHUNK_PAUSE

    # Encode master MP3
    full_audio = np.concatenate(timeline_audio, axis=0)
    temp_wav = f"/tmp/story_{SID}_ja_master.wav"
    sf.write(temp_wav, full_audio, SAMPLE_RATE)

    os.makedirs(os.path.dirname(JP_AUDIO_MP3), exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-i", temp_wav,
        "-codec:a", "libmp3lame", "-b:a", "64k", "-ar", "24000", "-ac", "1",
        JP_AUDIO_MP3
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(temp_wav):
        os.remove(temp_wav)

    total_duration = round(current_time - INTRA_CHUNK_PAUSE, 2)
    file_size = os.path.getsize(JP_AUDIO_MP3)
    print(f"[+] Japanese Master MP3: {JP_AUDIO_MP3} ({total_duration}s, {file_size:,} bytes)")
    return chunks, total_duration, file_size

def synthesize_russian_chunks(silero_model):
    print("\n--- Synthesizing Silero v4 Audio for Russian Chunks ---")
    chunks = []
    timeline_audio = []
    current_time = 0.0

    for idx, (en_sent, ru_item) in enumerate(zip(ENGLISH_SENTENCES, RUSSIAN_SENTENCES)):
        ru_text = ru_item["text"]
        print(f"  [{idx+1}/12] Synthesizing: {ru_text}")

        # Silero synthesis
        with torch.no_grad():
            audio_tensor = silero_model.apply_tts(text=ru_text, speaker="xenia", sample_rate=SAMPLE_RATE)
            chunk_audio = audio_tensor.cpu().numpy()

        dur = round(len(chunk_audio) / SAMPLE_RATE, 2)
        start_t = round(current_time, 2)
        end_t = round(current_time + dur, 2)

        ruby_html = annotate_russian_chunk(ru_text, torfl_default="A1")

        chunk = {
            "id": f"story_{SID}_p0_c{idx}",
            "chunk_index": idx,
            "paragraph_index": 0,
            "sentence_index": idx,
            "text": ru_text,
            "text_en": en_sent,
            "ruby": ruby_html,
            "transliteration": ru_item.get("transliteration", ""),
            "start": start_t,
            "end": end_t,
            "duration": dur
        }
        chunks.append(chunk)
        timeline_audio.append(chunk_audio)

        # Silence between chunks
        pause_samples = int(SAMPLE_RATE * INTRA_CHUNK_PAUSE)
        timeline_audio.append(np.zeros(pause_samples, dtype=np.float32))
        current_time = end_t + INTRA_CHUNK_PAUSE

    # Encode master MP3
    full_audio = np.concatenate(timeline_audio, axis=0)
    temp_wav = f"/tmp/story_{SID}_ru_master.wav"
    sf.write(temp_wav, full_audio, SAMPLE_RATE)

    os.makedirs(os.path.dirname(RU_AUDIO_MP3), exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-i", temp_wav,
        "-codec:a", "libmp3lame", "-b:a", "64k", "-ar", "24000", "-ac", "1",
        RU_AUDIO_MP3
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(temp_wav):
        os.remove(temp_wav)

    total_duration = round(current_time - INTRA_CHUNK_PAUSE, 2)
    file_size = os.path.getsize(RU_AUDIO_MP3)
    print(f"[+] Russian Master MP3: {RU_AUDIO_MP3} ({total_duration}s, {file_size:,} bytes)")
    return chunks, total_duration, file_size

def synchronize_data(jp_chunks, jp_duration, jp_size, ru_chunks, ru_duration, ru_size):
    print("\n=== Synchronizing Datasets & Audio Sizes ===")

    # 1. Japanese Details Sync
    with open(JAPANESE_DETAILS_JSON, "r", encoding="utf-8") as f:
        jp_details = json.load(f)

    story_jp = jp_details[SID]
    story_jp["chunks"] = jp_chunks
    story_jp["total_chunks"] = len(jp_chunks)
    story_jp["audio_duration"] = jp_duration
    story_jp["has_chunk_audio"] = True

    with open(JAPANESE_DETAILS_JSON, "w", encoding="utf-8") as f:
        json.dump(jp_details, f, ensure_ascii=False, indent=2)
    print(f"[+] Saved {JAPANESE_DETAILS_JSON}")

    os.makedirs(os.path.dirname(PUB_JP_STORY_JSON), exist_ok=True)
    with open(PUB_JP_STORY_JSON, "w", encoding="utf-8") as f:
        json.dump(story_jp, f, ensure_ascii=False, indent=2)
    print(f"[+] Synchronized {PUB_JP_STORY_JSON}")

    # 2. Russian Details Sync
    with open(RUSSIAN_DETAILS_JSON, "r", encoding="utf-8") as f:
        ru_details = json.load(f)

    story_ru = ru_details[SID]
    # Update Russian paragraph to use the refined sentences
    ru_full_para = " ".join([c["text"] for c in ru_chunks])
    story_ru["russian_paragraphs"] = [ru_full_para]
    story_ru["ruby_paragraphs"] = [" ".join([c["ruby"] for c in ru_chunks])]
    story_ru["reading_paragraphs"] = [" ".join([c["transliteration"] for c in ru_chunks])]
    story_ru["chunks"] = ru_chunks
    story_ru["total_chunks"] = len(ru_chunks)
    story_ru["audio_duration"] = ru_duration
    story_ru["has_chunk_audio"] = True

    with open(RUSSIAN_DETAILS_JSON, "w", encoding="utf-8") as f:
        json.dump(ru_details, f, ensure_ascii=False, indent=2)
    print(f"[+] Saved {RUSSIAN_DETAILS_JSON}")

    os.makedirs(os.path.dirname(PUB_RU_STORY_JSON), exist_ok=True)
    with open(PUB_RU_STORY_JSON, "w", encoding="utf-8") as f:
        json.dump(story_ru, f, ensure_ascii=False, indent=2)
    print(f"[+] Synchronized {PUB_RU_STORY_JSON}")

    # 3. Audio Sizes Sync
    with open(AUDIO_SIZES_JSON, "r", encoding="utf-8") as f:
        audio_sizes = json.load(f)

    mp3_name = f"{SID}_{SLUG}.mp3"
    audio_sizes.setdefault("japanese", {})[mp3_name] = jp_size
    audio_sizes.setdefault("russian", {})[mp3_name] = ru_size

    with open(AUDIO_SIZES_JSON, "w", encoding="utf-8") as f:
        json.dump(audio_sizes, f, ensure_ascii=False, indent=2)
    print(f"[+] Updated {AUDIO_SIZES_JSON} with exact byte sizes (JA: {jp_size:,}, RU: {ru_size:,})")

def verify_monotonicity(chunks, name="Chunks"):
    for i in range(len(chunks)):
        c = chunks[i]
        assert c["start"] < c["end"], f"{name} #{i} invalid bounds: start {c['start']} >= end {c['end']}"
        assert abs(round(c["end"] - c["start"], 2) - c["duration"]) <= 0.05, f"{name} #{i} duration mismatch"
        if i < len(chunks) - 1:
            next_c = chunks[i + 1]
            assert c["end"] <= next_c["start"] + 0.01, f"{name} #{i} overlap with #{i+1}: {c['end']} > {next_c['start']}"
    print(f"[✓] {name} passed monotonicity and non-overlap verification ({len(chunks)} chunks)")

def main():
    print("==================================================================")
    print("PROTOTYPE STORY CHUNKS: Retranslation & Audio Synthesis (23410)")
    print("==================================================================")

    # 1. Initialize Japanese Kokoro-82M
    print("[*] Initializing Kokoro-82M...")
    kmodel = KModel(config=KOKORO_CONFIG_PATH, model=KOKORO_MODEL_PATH)
    jp_pipeline = KPipeline(lang_code="j", model=kmodel)
    jp_voice = torch.load(os.path.join(KOKORO_VOICES_DIR, "jf_alpha.pt"), weights_only=True)

    jp_chunks, jp_dur, jp_size = synthesize_japanese_chunks(jp_pipeline, jp_voice)
    verify_monotonicity(jp_chunks, "Japanese Chunks")

    # 2. Initialize Russian Silero v4
    print("\n[*] Initializing Silero v4 PyTorch...")
    device = torch.device("cpu")
    torch.set_num_threads(os.cpu_count() or 4)
    silero_model = torch.package.PackageImporter(SILERO_MODEL_PATH).load_pickle("tts_models", "model")
    silero_model.to(device)

    ru_chunks, ru_dur, ru_size = synthesize_russian_chunks(silero_model)
    verify_monotonicity(ru_chunks, "Russian Chunks")

    # 3. Synchronize All Datasets
    synchronize_data(jp_chunks, jp_dur, jp_size, ru_chunks, ru_dur, ru_size)

    print("\n🎉 SUCCESS! Story 23410 is fully chunked, synthesized, and dual-synchronized.")

if __name__ == "__main__":
    main()
