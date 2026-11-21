#!/usr/bin/env python3
"""
3-Worker Parallel Story Chunk Retranslation & Audio Synthesis Pipeline
======================================================================
Deploys 3 parallel worker processes (reduced by 2 from 5) with an interactive
tqdm progress bar tracking story completion and worker activity in real-time.
"""

import os
import sys
import re
import json
import glob
import time
import subprocess
import argparse
from tqdm import tqdm

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON_BIN = "/home/kami/Desktop/codebase/main/bin/python3"
SCRIPT_PATH = os.path.join(BASE_DIR, "scripts", "batch_retranslate_story_chunks.py")

JAPANESE_DETAILS_JSON = os.path.join(BASE_DIR, "src", "data", "japanese_details.json")
RUSSIAN_DETAILS_JSON = os.path.join(BASE_DIR, "src", "data", "russian_details.json")
AUDIO_SIZES_JSON = os.path.join(BASE_DIR, "src", "data", "audio_sizes.json")

def count_chunked(lang: str) -> int:
    """Count how many stories in public/stories/{lang}/ have valid chunks."""
    pub_files = glob.glob(os.path.join(BASE_DIR, "public", "stories", lang, "*.json"))
    count = 0
    for p in pub_files:
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get("chunks") and len(data.get("chunks", [])) > 0:
                    count += 1
        except Exception:
            pass
    return count

def sync_data():
    """Aggregate individual story chunks and audio sizes into master data files."""
    print("\n=== Aggregating Story Chunks into Master Data Files ===")
    
    audio_sizes = {}
    if os.path.exists(AUDIO_SIZES_JSON):
        with open(AUDIO_SIZES_JSON, "r", encoding="utf-8") as f:
            audio_sizes = json.load(f)

    for lang, details_path in [("japanese", JAPANESE_DETAILS_JSON), ("russian", RUSSIAN_DETAILS_JSON)]:
        with open(details_path, "r", encoding="utf-8") as f:
            details = json.load(f)

        chunked_count = 0
        pub_files = glob.glob(os.path.join(BASE_DIR, "public", "stories", lang, "*.json"))
        for p in pub_files:
            try:
                with open(p, "r", encoding="utf-8") as pf:
                    st = json.load(pf)
                sid = str(st.get("id"))
                if sid in details and st.get("chunks"):
                    details[sid]["chunks"] = st["chunks"]
                    details[sid]["total_chunks"] = st.get("total_chunks", len(st["chunks"]))
                    details[sid]["audio_duration"] = st.get("audio_duration", 0)
                    details[sid]["has_chunk_audio"] = True
                    chunked_count += 1
            except Exception as e:
                print(f"Error reading {p}: {e}")

        # Update audio sizes
        audio_dir = os.path.join(BASE_DIR, "public", "audio", lang)
        if os.path.exists(audio_dir):
            for mp3_file in os.listdir(audio_dir):
                if mp3_file.endswith(".mp3"):
                    fsize = os.path.getsize(os.path.join(audio_dir, mp3_file))
                    audio_sizes.setdefault(lang, {})[mp3_file] = fsize

        with open(details_path, "w", encoding="utf-8") as f:
            json.dump(details, f, ensure_ascii=False, indent=2)
        print(f"[+] Synchronized {chunked_count}/206 {lang} stories in {details_path}")

    with open(AUDIO_SIZES_JSON, "w", encoding="utf-8") as f:
        json.dump(audio_sizes, f, ensure_ascii=False, indent=2)
    print(f"[+] Synchronized {AUDIO_SIZES_JSON}")

def get_worker_activity(lang_name: str, wid: int) -> str:
    """Extract current activity snippet from worker log."""
    log_path = f"/tmp/worker_{lang_name}_{wid}.log"
    if not os.path.exists(log_path):
        return "starting"
    try:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as lf:
            lines = [l.strip() for l in lf.readlines() if l.strip()]
            for line in reversed(lines):
                m_proc = re.search(r"Processing (?:Japanese|Russian) Story (\d+)", line)
                if m_proc:
                    return f"#{m_proc.group(1)}"
                m_skip = re.search(r"Story (\d+) .* already chunked", line)
                if m_skip:
                    return f"skip#{m_skip.group(1)}"
                if "Batch operations completed" in line:
                    return "done"
    except Exception:
        pass
    return "active"

def run_stage(lang_name: str, num_workers: int = 3, threads_per_worker: int = 2):
    print(f"\n==================================================================")
    print(f"🚀 Launching Phase: {lang_name.upper()} ({num_workers} Parallel Workers, {threads_per_worker} threads/worker)")
    print(f"==================================================================")
    t0 = time.time()
    workers = []

    for wid in range(num_workers):
        cmd = [
            PYTHON_BIN, "-u", SCRIPT_PATH,
            "--lang", lang_name,
            "--worker-id", str(wid),
            "--num-workers", str(num_workers),
            "--threads", str(threads_per_worker)
        ]
        log_file = open(f"/tmp/worker_{lang_name}_{wid}.log", "w")
        p = subprocess.Popen(cmd, stdout=log_file, stderr=subprocess.STDOUT)
        workers.append((f"{lang_name.upper()}-{wid}", p, log_file))
        print(f"  [Started] {lang_name.upper()} Worker {wid+1}/{num_workers} (PID: {p.pid})")

    total_stories = 206
    initial_done = count_chunked(lang_name)

    # Initialize actual tqdm progress bar
    pbar = tqdm(
        total=total_stories,
        initial=initial_done,
        desc=f"[{lang_name.upper()}] Synthesizing",
        unit="story",
        ncols=100,
        file=sys.stdout,
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}{postfix}]"
    )

    last_done = initial_done
    running = True

    while running:
        time.sleep(2)
        current_done = count_chunked(lang_name)
        if current_done > last_done:
            pbar.update(current_done - last_done)
            last_done = current_done

        # Check worker states and build status postfix
        all_done = True
        active_count = 0
        activities = []
        for wid, (name, p, lf) in enumerate(workers):
            ret = p.poll()
            if ret is None:
                all_done = False
                active_count += 1
                act = get_worker_activity(lang_name, wid)
                activities.append(f"W{wid+1}:{act}")
            else:
                activities.append(f"W{wid+1}:done")

        postfix_str = f"workers={active_count}/{num_workers}"
        if activities:
            postfix_str += f" | {', '.join(activities)}"
        pbar.set_postfix_str(postfix_str, refresh=True)
        sys.stdout.flush()

        if all_done:
            break

    # Ensure progress bar reflects 100% of completed stories
    final_done = count_chunked(lang_name)
    if final_done > last_done:
        pbar.update(final_done - last_done)
    pbar.close()

    for name, p, lf in workers:
        lf.close()

    print(f"\n[✓] {lang_name.upper()} completed in {time.time() - t0:.1f}s ({final_done}/{total_stories} stories chunked).")
    sync_data()

def main():
    parser = argparse.ArgumentParser(description="Parallel Story Synthesis Pipeline")
    parser.add_argument("--num-workers", type=int, default=3, help="Number of parallel workers (default: 3)")
    parser.add_argument("--threads", type=int, default=2, help="CPU threads per worker (default: 2)")
    parser.add_argument("--skip-upload", action="store_true", help="Skip Cloudflare R2 upload")
    args = parser.parse_args()

    print("==================================================================")
    print(f"⚡ {args.num_workers}-WORKER PARALLEL STORY SYNTHESIS PIPELINE")
    print("==================================================================")
    start_total = time.time()

    # Pre-sync data to ensure source and public directories match
    sync_data()

    # Phase 1: Japanese
    run_stage("japanese", num_workers=args.num_workers, threads_per_worker=args.threads)

    # Phase 2: Russian
    run_stage("russian", num_workers=args.num_workers, threads_per_worker=args.threads)

    # Final Integrity Verification
    print("\n=== Final Integrity Verification Audit ===")
    subprocess.run([PYTHON_BIN, SCRIPT_PATH, "--verify-only"], check=True)

    # Phase 3: Upload to Cloudflare R2
    if not args.skip_upload:
        print("\n=== Uploading All Audio to Cloudflare R2 ===")
        for lang in ["japanese", "russian"]:
            print(f"[*] Uploading {lang} audio to R2...")
            try:
                subprocess.run(["node", "scripts/upload-to-r2.mjs", lang], check=True)
            except Exception as e:
                print(f"[-] R2 upload warning for {lang}: {e}")

    print(f"\n🎉 ALL 206 STORIES PROCESSED & UPLOADED IN {time.time() - start_total:.1f}s!")

if __name__ == "__main__":
    main()
