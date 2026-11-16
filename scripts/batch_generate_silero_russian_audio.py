#!/usr/bin/env python3
"""
Batch Neural Russian Audio Generation via Silero TTS (v4_ru)
============================================================
World-class local Russian speech synthesis with studio-grade intonation and stress.
- 100% offline, zero network requests, zero rate-limiting.
- Paragraph-by-paragraph tensor synthesis with natural inter-paragraph pauses.
- Encodes directly to high-quality MP3 (128kbps) via ffmpeg.
- Updates audio_sizes.json with exact byte sizes.
"""

import os
import sys
import json
import time
import subprocess
import torch
import torchaudio

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "data", "silero_v4_ru.pt")
RUSSIAN_DETAILS_JSON = os.path.join(BASE_DIR, "src", "data", "russian_details.json")
ALL_STORIES_JSON = os.path.join(BASE_DIR, "src", "data", "all_stories.json")
AUDIO_SIZES_JSON = os.path.join(BASE_DIR, "src", "data", "audio_sizes.json")
AUDIO_OUTPUT_DIR = os.path.join(BASE_DIR, "public", "audio", "russian")

os.makedirs(AUDIO_OUTPUT_DIR, exist_ok=True)

print("=== STARTING SILERO NEURAL RUSSIAN AUDIO GENERATION ===")
t0 = time.time()

# 1. Load Silero v4 Model
print("[*] Loading Silero v4_ru model into PyTorch CPU...")
device = torch.device("cpu")
torch.set_num_threads(os.cpu_count() or 4)
model = torch.package.PackageImporter(MODEL_PATH).load_pickle("tts_models", "model")
model.to(device)

speaker = "xenia"  # Studio-quality female educator voice
sample_rate = 24000
pause_tensor = torch.zeros(int(sample_rate * 0.45))  # 450ms natural paragraph pause

# 2. Load Russian Stories
with open(RUSSIAN_DETAILS_JSON, "r", encoding="utf-8") as f:
    russian_details = json.load(f)

total_stories = len(russian_details)
print(f"[*] Processing {total_stories} stories with speaker '{speaker}' at {sample_rate}Hz...")

generated_count = 0
tmp_wav = "/tmp/silero_temp_render.wav"

for idx, (sid, story) in enumerate(russian_details.items()):
    slug = story.get("slug", str(sid))
    filename = f"{sid}_{slug}.mp3"
    out_mp3 = os.path.join(AUDIO_OUTPUT_DIR, filename)

    paras = story.get("russian_paragraphs", [])
    if not paras:
        continue

    # Synthesize each paragraph and concatenate
    audio_tensors = []
    for p in paras:
        p_text = p.strip()
        if not p_text:
            continue
        try:
            # Silero accepts acute accent or plain text
            p_audio = model.apply_tts(text=p_text, speaker=speaker, sample_rate=sample_rate)
            audio_tensors.append(p_audio)
            audio_tensors.append(pause_tensor)
        except Exception as e:
            # Fallback if specific punctuation or token causes issue
            clean_p = p_text.replace("\u0301", "")
            try:
                p_audio = model.apply_tts(text=clean_p, speaker=speaker, sample_rate=sample_rate)
                audio_tensors.append(p_audio)
                audio_tensors.append(pause_tensor)
            except Exception as e2:
                print(f"[-] Error on story {sid} paragraph: {e2}")

    if not audio_tensors:
        continue

    # Concatenate all paragraphs
    full_audio = torch.cat(audio_tensors, dim=0)

    # Save temporary wav
    torchaudio.save(tmp_wav, full_audio.unsqueeze(0), sample_rate)

    # Convert to MP3 via ffmpeg
    cmd = [
        "ffmpeg", "-y", "-i", tmp_wav,
        "-b:a", "128k", "-ar", str(sample_rate),
        out_mp3
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    generated_count += 1

    if (idx + 1) % 20 == 0 or (idx + 1) == total_stories:
        elapsed = time.time() - t0
        rate = (idx + 1) / elapsed
        print(f"[{idx + 1}/{total_stories}] Synthesized Russian audio ({elapsed:.1f}s, {rate:.1f} stories/sec)...")

if os.path.exists(tmp_wav):
    os.remove(tmp_wav)

# 3. Update audio_sizes.json
print("\n[*] Updating audio_sizes.json with all Russian MP3s...")
if os.path.exists(AUDIO_SIZES_JSON):
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

    print(f"[+] Updated {AUDIO_SIZES_JSON}: {len(mp3_files)} MP3s ({total_bytes / (1024*1024):.2f} MB total)")

total_time = time.time() - t0
print(f"\n[+] COMPLETE: Successfully generated {generated_count}/{total_stories} Russian MP3s in {total_time:.1f}s!")
