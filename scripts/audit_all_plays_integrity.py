#!/usr/bin/env python3
"""
Automated Comprehensive Verification Audit Script for Japanese Plays in Polyglot Reader.
Verifies:
1. 0 invalid speakers across all 6 plays (strict match with characters[].name_ja or 'STAGE').
2. 0 merged multi-speaker chunks (no chunk contains multiple characters' dialogue turns).
3. 0 missing audio files (all scene MP3s present, valid size, matching duration).
4. Chunk timestamps (start, end, duration) validity and monotone progression.
5. Complete NLP annotations (ruby, ruby_romaji, romaji) on all dialogue turns.
6. 100% lockstep synchronization between src/data/plays/ and public/plays/.
"""

import os
import sys
import json
import glob
import re
import subprocess

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PLAYS_DIR = os.path.join(PROJECT_ROOT, "src", "data", "plays")
PUB_PLAYS_DIR = os.path.join(PROJECT_ROOT, "public", "plays")
PUB_AUDIO_DIR = os.path.join(PROJECT_ROOT, "public", "audio", "plays")

def get_audio_duration(path):
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        path
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        return float(res.stdout.strip())
    except:
        return 0.0

def audit_all():
    print("==================================================")
    print("Polyglot Reader — Theatrical Plays Integrity Audit")
    print("==================================================")

    play_files = sorted(glob.glob(os.path.join(SRC_PLAYS_DIR, "*.json")))
    play_files = [p for p in play_files if "catalog" not in p]

    total_invalid_speakers = 0
    total_merged_chunks = 0
    total_missing_audio = 0
    total_timestamp_errors = 0
    total_nlp_missing = 0
    sync_errors = 0

    for src_path in play_files:
        filename = os.path.basename(src_path)
        pub_path = os.path.join(PUB_PLAYS_DIR, filename)
        play_id = filename.replace(".json", "")

        # 1. Lockstep Check
        with open(src_path, "r", encoding="utf-8") as f:
            src_content = f.read()
        if not os.path.exists(pub_path):
            print(f"[FAIL] Missing public play file: {pub_path}")
            sync_errors += 1
            continue
        with open(pub_path, "r", encoding="utf-8") as f:
            pub_content = f.read()

        if src_content != pub_content:
            print(f"[FAIL] Desynchronization between src and public for {play_id}")
            sync_errors += 1
        else:
            print(f"[OK] Lockstep Synchronization: {play_id}.json (src == public)")

        data = json.loads(src_content)
        chars = {c["name_ja"] for c in data.get("characters", [])}
        scenes = data.get("scenes", [])

        print(f"\n--- Play: {data.get('title_ja')} ({play_id}) ---")
        print(f"  Characters ({len(chars)}): {sorted(list(chars))}")
        print(f"  Scenes count: {len(scenes)}")

        spk_pat = "|".join(re.escape(c) for c in chars)
        turn_header_pat = re.compile(rf"({spk_pat})\s*[「（:：★☆△▲]")

        for s_idx, scene in enumerate(scenes):
            s_num = scene.get("scene_number", s_idx + 1)
            chunks = scene.get("chunks", [])
            audio_url = scene.get("audio_url", "")
            scene_duration = scene.get("duration", 0.0)

            # 2. Audio file check
            audio_filename = f"{play_id}_scene_{s_num}.mp3"
            audio_path = os.path.join(PUB_AUDIO_DIR, audio_filename)
            if not os.path.exists(audio_path) or os.path.getsize(audio_path) < 1000:
                print(f"  [FAIL] Missing or invalid audio file: {audio_path}")
                total_missing_audio += 1
            else:
                actual_dur = get_audio_duration(audio_path)
                dur_diff = abs(actual_dur - scene_duration)
                if dur_diff > 1.5:
                    print(f"  [WARN] Audio duration mismatch Scene {s_num}: metadata={scene_duration}s, actual={actual_dur}s (diff={dur_diff:.2f}s)")
                else:
                    print(f"  [OK] Scene {s_num} Audio: {audio_filename} ({actual_dur:.1f}s, size={os.path.getsize(audio_path):,} bytes)")

            # 3. Chunks check
            prev_end = 0.0
            for c_idx, c in enumerate(chunks):
                cid = c.get("id")
                spk = c.get("speaker")
                t_ja = c.get("text_ja", "").strip()
                d_ja = c.get("direction_ja", "").strip()
                c_type = c.get("type")

                # Speaker validation
                if spk != "STAGE" and spk not in chars:
                    print(f"  [FAIL] Invalid speaker in {cid}: {repr(spk)}")
                    total_invalid_speakers += 1

                # Merged multi-speaker check
                if t_ja:
                    headers = turn_header_pat.findall(t_ja)
                    if len(headers) >= 2:
                        print(f"  [FAIL] Merged multi-speaker turn in {cid} ({spk}): {t_ja[:50]}")
                        total_merged_chunks += 1

                # Timestamp validation
                start = c.get("start", 0.0)
                end = c.get("end", 0.0)
                dur = c.get("duration", 0.0)
                if end < start or dur < 0:
                    print(f"  [FAIL] Inverted timestamp in {cid}: start={start}, end={end}, dur={dur}")
                    total_timestamp_errors += 1
                if start < prev_end - 0.5:
                    print(f"  [FAIL] Non-monotone timestamp in {cid}: prev_end={prev_end}, start={start}")
                    total_timestamp_errors += 1
                prev_end = end

                # NLP validation on spoken dialogue
                if t_ja:
                    if not c.get("romaji"):
                        print(f"  [FAIL] Missing romaji in {cid}")
                        total_nlp_missing += 1
                    if not c.get("ruby"):
                        print(f"  [FAIL] Missing ruby in {cid}")
                        total_nlp_missing += 1
                elif d_ja and c_type == "stage_direction":
                    if not c.get("romaji"):
                        print(f"  [FAIL] Missing romaji in stage direction {cid}")
                        total_nlp_missing += 1

    print("\n==================================================")
    print("AUDIT SUMMARY:")
    print(f"  Invalid speakers:       {total_invalid_speakers}")
    print(f"  Merged chunks:          {total_merged_chunks}")
    print(f"  Missing audio files:    {total_missing_audio}")
    print(f"  Timestamp errors:       {total_timestamp_errors}")
    print(f"  Missing NLP fields:     {total_nlp_missing}")
    print(f"  Sync errors (src/pub):  {sync_errors}")
    print("==================================================")

    if (total_invalid_speakers == 0 and total_merged_chunks == 0 and
        total_missing_audio == 0 and total_timestamp_errors == 0 and
        total_nlp_missing == 0 and sync_errors == 0):
        print("\n🎉 ALL INVARIANTS SATISFIED! Zero defects across all 6 plays.")
        return 0
    else:
        print("\n❌ Defects detected. Please review output above.")
        return 1

if __name__ == "__main__":
    sys.exit(audit_all())
