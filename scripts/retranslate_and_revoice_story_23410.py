#!/usr/bin/env python3
"""
Retranslate Story 23410 ("A Happy Day") with high-precision native Japanese phrasing
and synthesize studio-quality audio via local Kokoro-82M TTS model.
Synchronizes src/data/japanese_details.json, public/stories/japanese/23410.json,
src/data/all_stories.json, and src/data/audio_sizes.json.
"""

import os
import sys
import json
import socket
import subprocess

# Prevent IPv6 hang
socket.has_ipv6 = False
old_gai = socket.getaddrinfo
def gai(host, port, family=0, type=0, proto=0, flags=0):
    return old_gai(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = gai

import torch
import soundfile as sf
from kokoro import KModel, KPipeline

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))

import japanese_lexicon_enricher as enricher

SID = "23410"
JAPANESE_DETAILS_JSON = os.path.join(BASE_DIR, "src", "data", "japanese_details.json")
MANDARIN_DETAILS_JSON = os.path.join(BASE_DIR, "src", "data", "mandarin_details.json")
ALL_STORIES_JSON = os.path.join(BASE_DIR, "src", "data", "all_stories.json")
AUDIO_SIZES_JSON = os.path.join(BASE_DIR, "src", "data", "audio_sizes.json")
PUBLIC_STORY_JSON = os.path.join(BASE_DIR, "public", "stories", "japanese", f"{SID}.json")
RETRANSLATED_CACHE_JSON = os.path.join(BASE_DIR, "data", "retranslated_cache.json")
AUDIO_OUTPUT_MP3 = os.path.join(BASE_DIR, "public", "audio", "japanese", f"{SID}_a-happy-day.mp3")

# Polished, native-grade Japanese translation adhering strictly to all linguistic invariants
NEW_JAPANESE_PARAGRAPHS = [
    "私の名前はダーウェイで、学生です。今、中国で中国語を勉強しています。仲の良い友達にマーティンがいます。私たちは二人とも大学生で、中国が大好きです。中華料理を食べるのが好きです。中華まんも餃子も麺もどれもおいしいです。中国茶を飲むのも好きです。今日は土曜日で、授業はありません。午前十時に、服を買いにショッピングモールへ行きました。午後は映画を観に行きました。夜は自分たちで食事を作ります。今日はとても楽しい一日でした。"
]

# Accurate hiragana reading with pedagogical word spacing
NEW_READING_PARAGRAPHS = [
    "わたし の なまえ は だーうぇい で、がくせい です。いま、ちゅうごく で ちゅうごくご を べんきょう して います。なか の いい ともだち に まーてぃん が います。わたしたち は ふたり とも だいがくせい で、ちゅうごく が だいすき です。ちゅうかりょうり を たべる の が すき です。ちゅうかまん も ぎょうざ も めん も どれ も おいしい です。ちゅうごくちゃ を のむ の も すき です。きょう は どようび で、じゅぎょう は ありません。ごぜん じゅうじ に、ふく を かい に しょっぴんぐもーる へ いきました。ごご は えいが を み に いきました。よる は じぶんたち で しょくじ を つくります。きょう は とても たのしい いちにち でした。"
]

def main():
    print(f"=== 1. Updating Text & Enriching Lexicon for Story {SID} ===")
    
    # Load existing details
    with open(JAPANESE_DETAILS_JSON, "r", encoding="utf-8") as f:
        jp_data = json.load(f)
    
    with open(MANDARIN_DETAILS_JSON, "r", encoding="utf-8") as f:
        m_data = json.load(f)

    story = jp_data[SID]
    m_story = m_data.get(SID, {})

    story["japanese_paragraphs"] = NEW_JAPANESE_PARAGRAPHS
    story["reading_paragraphs"] = NEW_READING_PARAGRAPHS

    # Enrich vocabulary and generate ruby tooltips
    vocab, ruby_paras = enricher.process_story(story, m_story)
    story["vocabulary"] = vocab
    story["ruby_paragraphs"] = ruby_paras

    # 1. Update src/data/japanese_details.json
    with open(JAPANESE_DETAILS_JSON, "w", encoding="utf-8") as f:
        json.dump(jp_data, f, ensure_ascii=False, indent=2)
    print(f"[+] Updated {JAPANESE_DETAILS_JSON}")

    # 2. Update public/stories/japanese/23410.json
    os.makedirs(os.path.dirname(PUBLIC_STORY_JSON), exist_ok=True)
    with open(PUBLIC_STORY_JSON, "w", encoding="utf-8") as f:
        json.dump(story, f, ensure_ascii=False, indent=2)
    print(f"[+] Synchronized {PUBLIC_STORY_JSON}")

    # 3. Update data/retranslated_cache.json
    if os.path.exists(RETRANSLATED_CACHE_JSON):
        with open(RETRANSLATED_CACHE_JSON, "r", encoding="utf-8") as f:
            cache = json.load(f)
        cache[SID] = {
            "japanese_paragraphs": NEW_JAPANESE_PARAGRAPHS,
            "reading_paragraphs": NEW_READING_PARAGRAPHS
        }
        with open(RETRANSLATED_CACHE_JSON, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
        print(f"[+] Updated {RETRANSLATED_CACHE_JSON}")

    # 4. Update src/data/all_stories.json
    if os.path.exists(ALL_STORIES_JSON):
        with open(ALL_STORIES_JSON, "r", encoding="utf-8") as f:
            all_stories = json.load(f)
        for item in all_stories:
            if str(item.get("id")) == SID:
                item["japanese"] = {
                    "title": story.get("japanese_title", "楽しい一日"),
                    "character_preview": NEW_JAPANESE_PARAGRAPHS[0][:40],
                    "reading_preview": NEW_READING_PARAGRAPHS[0][:40],
                    "vocab_count": len(vocab),
                    "para_count": len(NEW_JAPANESE_PARAGRAPHS)
                }
        with open(ALL_STORIES_JSON, "w", encoding="utf-8") as f:
            json.dump(all_stories, f, ensure_ascii=False, indent=2)
        print(f"[+] Updated preview in {ALL_STORIES_JSON}")

    print("\n=== 2. Synthesizing New Audio with Kokoro-82M ===")
    model_path = os.path.abspath(os.path.join(BASE_DIR, "data", "Kokoro-82M", "kokoro-v1_0.pth"))
    config_path = os.path.abspath(os.path.join(BASE_DIR, "data", "Kokoro-82M", "config.json"))
    voice_path = os.path.abspath(os.path.join(BASE_DIR, "data", "Kokoro-82M", "voices", "jf_alpha.pt"))

    kmodel = KModel(config=config_path, model=model_path)
    pipeline = KPipeline(lang_code='j', model=kmodel)

    full_text = " ".join(NEW_JAPANESE_PARAGRAPHS)
    print(f"Generating audio for text ({len(full_text)} chars)...")
    
    audio_chunks = []
    # Natural pause tensor (0.4s silence at 24kHz)
    pause = torch.zeros(int(24000 * 0.4), dtype=torch.float32)

    for i, (gs, ps, audio) in enumerate(pipeline(full_text, voice=voice_path, speed=0.95)):
        print(f"  Chunk {i+1}: {gs}")
        audio_chunks.append(audio)
        audio_chunks.append(pause)

    combined_tensor = torch.cat(audio_chunks, dim=0).numpy()
    duration_s = len(combined_tensor) / 24000
    print(f"[+] Synthesized total audio duration: {duration_s:.2f} seconds")

    # Save to intermediate WAV
    temp_wav = "/tmp/story_23410_kokoro.wav"
    sf.write(temp_wav, combined_tensor, 24000)

    # Encode to high-quality MP3 via ffmpeg
    os.makedirs(os.path.dirname(AUDIO_OUTPUT_MP3), exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-i", temp_wav,
        "-codec:a", "libmp3lame",
        "-b:a", "64k",
        "-ar", "24000",
        "-ac", "1",
        AUDIO_OUTPUT_MP3
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if os.path.exists(temp_wav):
        os.remove(temp_wav)

    file_size = os.path.getsize(AUDIO_OUTPUT_MP3)
    print(f"[+] Generated final MP3: {AUDIO_OUTPUT_MP3} ({file_size:,} bytes)")

    # 5. Update audio_sizes.json
    if os.path.exists(AUDIO_SIZES_JSON):
        with open(AUDIO_SIZES_JSON, "r", encoding="utf-8") as f:
            audio_sizes = json.load(f)
        if "japanese" not in audio_sizes:
            audio_sizes["japanese"] = {}
        filename = f"{SID}_a-happy-day.mp3"
        audio_sizes["japanese"][filename] = file_size
        with open(AUDIO_SIZES_JSON, "w", encoding="utf-8") as f:
            json.dump(audio_sizes, f, ensure_ascii=False, indent=2)
        print(f"[+] Updated {AUDIO_SIZES_JSON} with size {file_size:,} bytes")

    print("\n=== All updates and Kokoro-82M audio generation complete! ===")

if __name__ == "__main__":
    main()
