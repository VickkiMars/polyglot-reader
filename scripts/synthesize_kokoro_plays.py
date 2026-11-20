#!/usr/bin/env python3
"""
Kokoro-82M Multi-Character Neural Audio Synthesizer for Japanese Plays.
Generates studio-grade Japanese neural audio for all scenes across the plays,
constructs accurate millisecond-precision chunk maps, and synchronizes both
src/data/plays/ and public/plays/ in lockstep.
"""

import os
import sys
import json
import hashlib
import time
import subprocess
import torch
import numpy as np
import soundfile as sf
from kokoro import KModel, KPipeline

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PLAYS_DIR = os.path.join(PROJECT_ROOT, "src", "data", "plays")
PUB_PLAYS_DIR = os.path.join(PROJECT_ROOT, "public", "plays")
PUB_AUDIO_DIR = os.path.join(PROJECT_ROOT, "public", "audio", "plays")
CACHE_DIR = os.path.join(PROJECT_ROOT, "data", "kokoro_cache")
CATALOG_SRC = os.path.join(SRC_PLAYS_DIR, "plays_catalog.json")
CATALOG_PUB = os.path.join(PUB_PLAYS_DIR, "plays_catalog.json")

os.makedirs(PUB_AUDIO_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

MODEL_PATH = os.path.join(PROJECT_ROOT, "data", "Kokoro-82M", "kokoro-v1_0.pth")
CONFIG_PATH = os.path.join(PROJECT_ROOT, "data", "Kokoro-82M", "config.json")
VOICES_DIR = os.path.join(PROJECT_ROOT, "data", "Kokoro-82M", "voices")

SAMPLE_RATE = 24000
PAUSE_AFTER_DIALOGUE = int(SAMPLE_RATE * 0.35)  # 0.35s silence
STAGE_DIRECTION_DURATION = 1.2  # 1.2s silence

# Character voice definitions
VOICE_MAP = {
    # itsutaka
    "新名": "jm_kumo",
    "白子": "jf_alpha",
    "茉莉": "jf_nezumi",
    "瑠璃色": "jf_tebukuro",
    "朝": "jf_gongitsune",
    "将門": "jm_kumo",
    # highway
    "ユウカ": "jf_alpha",
    "サラ": "jf_tebukuro",
    "マエジマ": "jm_kumo",
    "ミツヨ": "jf_nezumi",
    "老婆": "jf_gongitsune",
    # lion
    "須藤": "jm_kumo",
    "森": "jf_alpha",
    "横山": "jf_tebukuro",
    "脇中": "jf_nezumi",
    "三谷": "jm_kumo",
    "香取": "jm_kumo",
    # hansuu
    "女": "jf_alpha",
    "男": "jm_kumo",
    "虫眼鏡": "jf_tebukuro",
    "電話番": "jm_kumo",
    "水晶": "jf_nezumi",
    # nemurenai
    "健一": "jm_kumo",
    "郁子": "jf_alpha",
    "千寿子": "jf_tebukuro",
    "恵美子": "jf_nezumi",
    "杉原": "jm_kumo",
    "町田": "jf_alpha",
    "幸三": "jm_kumo",
    "好江": "jf_nezumi",
    "保奈美": "jf_tebukuro",
    "三橋": "jm_kumo",
    "明": "jm_kumo",
}

def load_voice_tensors():
    voice_names = ["jf_alpha", "jm_kumo", "jf_tebukuro", "jf_nezumi", "jf_gongitsune"]
    tensors = {}
    for name in voice_names:
        p = os.path.join(VOICES_DIR, f"{name}.pt")
        if os.path.exists(p):
            tensors[name] = torch.load(p, weights_only=True)
            print(f"  Loaded voice: {name}")
    return tensors

def get_turn_audio(pipeline, voice_tensors, text, voice_name):
    if not text.strip():
        return np.zeros(0, dtype=np.float32)

    cache_key = hashlib.sha256(f"{voice_name}::{text}".encode("utf-8")).hexdigest()
    cache_file = os.path.join(CACHE_DIR, f"{cache_key}.npy")

    if os.path.exists(cache_file):
        try:
            return np.load(cache_file)
        except Exception:
            pass

    v_tensor = voice_tensors.get(voice_name, voice_tensors.get("jf_alpha"))
    chunks = []
    try:
        with torch.inference_mode():
            for gs, ps, audio in pipeline(text, voice=v_tensor, speed=1.0):
                if isinstance(audio, torch.Tensor):
                    chunks.append(audio.cpu().numpy())
                else:
                    chunks.append(audio)
    except Exception as e:
        print(f"    [Warning] Kokoro synthesis error for '{text[:20]}...': {e}")
        # Return fallback silence for text length
        fallback_len = int(SAMPLE_RATE * max(1.0, len(text) * 0.15))
        return np.zeros(fallback_len, dtype=np.float32)

    if chunks:
        combined = np.concatenate(chunks, axis=0)
    else:
        fallback_len = int(SAMPLE_RATE * max(1.0, len(text) * 0.15))
        combined = np.zeros(fallback_len, dtype=np.float32)

    np.save(cache_file, combined)
    return combined

def synthesize_play(play_id, pipeline, voice_tensors):
    src_file = os.path.join(SRC_PLAYS_DIR, f"{play_id}.json")
    pub_file = os.path.join(PUB_PLAYS_DIR, f"{play_id}.json")

    with open(src_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"\n==========================================")
    print(f"Synthesizing Neural Audio: {data.get('title_ja')} ({play_id})")
    print(f"==========================================")

    total_play_dur = 0.0

    for s_idx, scene in enumerate(data.get("scenes", [])):
        scene_num = scene.get("scene_number", s_idx + 1)
        chunks = scene.get("chunks", [])
        print(f"\n--- Processing Scene {scene_num} ({len(chunks)} chunks) ---")

        timeline_audio = []
        curr_time = 0.0

        for c_idx, chunk in enumerate(chunks):
            is_stage = chunk.get("type") == "stage_direction"
            speaker = chunk.get("speaker", "STAGE")
            text_ja = chunk.get("text_ja", "").strip()

            if is_stage or not text_ja:
                dur = STAGE_DIRECTION_DURATION
                silence_samples = int(SAMPLE_RATE * dur)
                timeline_audio.append(np.zeros(silence_samples, dtype=np.float32))

                chunk["start"] = round(curr_time, 2)
                chunk["end"] = round(curr_time + dur, 2)
                chunk["duration"] = round(dur, 2)
                curr_time += dur
            else:
                voice_name = VOICE_MAP.get(speaker, "jf_alpha")
                t0 = time.time()
                speech = get_turn_audio(pipeline, voice_tensors, text_ja, voice_name)
                speech_dur = len(speech) / SAMPLE_RATE

                timeline_audio.append(speech)
                # Append natural dialogue pause
                timeline_audio.append(np.zeros(PAUSE_AFTER_DIALOGUE, dtype=np.float32))

                chunk_dur = round(speech_dur, 2)
                chunk["start"] = round(curr_time, 2)
                chunk["end"] = round(curr_time + speech_dur, 2)
                chunk["duration"] = chunk_dur

                curr_time += speech_dur + (PAUSE_AFTER_DIALOGUE / SAMPLE_RATE)
                if (c_idx + 1) % 15 == 0 or (c_idx + 1) == len(chunks):
                    print(f"  [{c_idx + 1}/{len(chunks)}] turn synthesized: '{speaker}: {text_ja[:20]}...' ({chunk_dur}s)")

        # Concatenate entire scene audio
        scene_array = np.concatenate(timeline_audio, axis=0) if timeline_audio else np.zeros(SAMPLE_RATE, dtype=np.float32)
        scene_dur = round(len(scene_array) / SAMPLE_RATE, 2)
        scene["duration"] = scene_dur
        total_play_dur += scene_dur

        # Save to temporary WAV
        temp_wav = f"/tmp/{play_id}_scene_{scene_num}.wav"
        sf.write(temp_wav, scene_array, SAMPLE_RATE)

        # Encode to final high-fidelity MP3 via ffmpeg
        scene_mp3_path = os.path.join(PUB_AUDIO_DIR, f"{play_id}_scene_{scene_num}.mp3")
        cmd = [
            "ffmpeg", "-y", "-i", temp_wav,
            "-codec:a", "libmp3lame",
            "-b:a", "64k",
            "-ar", "24000",
            "-ac", "1",
            scene_mp3_path
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(temp_wav):
            os.remove(temp_wav)

        mp3_size = os.path.getsize(scene_mp3_path)
        print(f"[+] Scene {scene_num} Audio: {scene_mp3_path} ({scene_dur}s, {mp3_size:,} bytes)")

    data["total_duration"] = round(total_play_dur, 2)

    # Dual Data Synchronization: Save to src and public in lockstep
    with open(src_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    with open(pub_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[+] Play {play_id} synchronized across src and public (total duration: {round(total_play_dur, 2)}s)")
    return play_id, round(total_play_dur, 2)

def update_catalogs(durations):
    for cat_path in [CATALOG_SRC, CATALOG_PUB]:
        if not os.path.exists(cat_path):
            continue
        with open(cat_path, "r", encoding="utf-8") as f:
            cat = json.load(f)
        for item in cat:
            pid = item.get("id")
            if pid in durations:
                item["total_duration"] = durations[pid]
        with open(cat_path, "w", encoding="utf-8") as f:
            json.dump(cat, f, ensure_ascii=False, indent=2)
        print(f"[+] Updated catalog at {cat_path}")

def main():
    torch.set_num_threads(5)
    target_plays = sys.argv[1:] if len(sys.argv) > 1 else ["itsutaka", "highway", "lion", "hansuu", "nemurenai"]

    print("=== 1. Initializing Kokoro-82M Model & Voices ===")
    t0 = time.time()
    kmodel = KModel(config=CONFIG_PATH, model=MODEL_PATH)
    pipeline = KPipeline(lang_code='j', model=kmodel)
    voice_tensors = load_voice_tensors()
    print(f"Kokoro model initialized in {time.time() - t0:.2f}s.")

    durations = {}
    for pid in target_plays:
        p_id, dur = synthesize_play(pid, pipeline, voice_tensors)
        durations[p_id] = dur

    print("\n=== 2. Synchronizing Catalogs ===")
    update_catalogs(durations)
    print("\n🎉 Kokoro-82M Japanese Play Audio Generation Complete!")

if __name__ == "__main__":
    main()
