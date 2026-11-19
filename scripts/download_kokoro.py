#!/usr/bin/env python3
"""
Download hexgrad/Kokoro-82M model and voice weights locally into data/Kokoro-82M.
Uses IPv4 socket routing to avoid Linux MTU / GRO IPv6 timeouts.
"""

import os
import sys
import socket
import urllib.request
import json
import time

# Force IPv4 to prevent IPv6 network stalls on Hugging Face CDN
old_getaddrinfo = socket.getaddrinfo
def getaddrinfo_v4(*args, **kwargs):
    responses = old_getaddrinfo(*args, **kwargs)
    return [r for r in responses if r[0] == socket.AF_INET]
socket.getaddrinfo = getaddrinfo_v4

REPO_ID = "hexgrad/Kokoro-82M"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_DIR = os.path.join(BASE_DIR, "data", "Kokoro-82M")
VOICES_DIR = os.path.join(TARGET_DIR, "voices")

os.makedirs(VOICES_DIR, exist_ok=True)

def download_file(url: str, dest_path: str, desc: str):
    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
        # Check if remote file size matches
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}, method="HEAD")
            with urllib.request.urlopen(req, timeout=15) as resp:
                remote_size = int(resp.headers.get("Content-Length", 0))
                if remote_size > 0 and os.path.getsize(dest_path) == remote_size:
                    print(f"  [Skipped] {desc} (already complete: {remote_size:,} bytes)")
                    return
        except Exception:
            pass

    print(f"  [Downloading] {desc}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    tmp_path = dest_path + ".tmp"
    with urllib.request.urlopen(req, timeout=60) as resp, open(tmp_path, "wb") as f:
        total_size = int(resp.headers.get("Content-Length", 0))
        downloaded = 0
        chunk_size = 1024 * 512
        t0 = time.time()
        last_print = t0
        while True:
            chunk = resp.read(chunk_size)
            if not chunk:
                break
            f.write(chunk)
            downloaded += len(chunk)
            now = time.time()
            if total_size > 0 and now - last_print > 1.5:
                pct = (downloaded / total_size) * 100
                speed_mb = (downloaded / (1024 * 1024)) / (now - t0 + 1e-6)
                print(f"    -> {pct:.1f}% ({downloaded / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB at {speed_mb:.1f} MB/s)")
                last_print = now

    os.replace(tmp_path, dest_path)
    final_size = os.path.getsize(dest_path)
    print(f"  [Finished] {desc} ({final_size:,} bytes)")

def main():
    print(f"=== Downloading Kokoro-82M into {TARGET_DIR} ===")
    
    # 1. Fetch repo file tree from Hugging Face API
    api_url = f"https://huggingface.co/api/models/{REPO_ID}"
    req = urllib.request.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        repo_data = json.loads(resp.read().decode("utf-8"))

    siblings = repo_data.get("siblings", [])
    filenames = [s["rfilename"] for s in siblings]

    # Essential files
    core_files = ["config.json", "kokoro-v1_0.pth", "VOICES.md", "README.md"]
    voice_files = [f for f in filenames if f.startswith("voices/") and f.endswith(".pt")]

    print(f"Found {len(core_files)} core files and {len(voice_files)} voice files.")

    # Download core files
    for fname in core_files:
        url = f"https://huggingface.co/{REPO_ID}/resolve/main/{fname}"
        dest = os.path.join(TARGET_DIR, fname)
        download_file(url, dest, fname)

    # Download voices
    print(f"\nDownloading {len(voice_files)} voice files into {VOICES_DIR}...")
    for idx, vfile in enumerate(voice_files, 1):
        url = f"https://huggingface.co/{REPO_ID}/resolve/main/{vfile}"
        dest = os.path.join(TARGET_DIR, vfile)
        download_file(url, dest, f"[{idx}/{len(voice_files)}] {vfile}")

    print("\n=== Kokoro-82M Download Complete! ===")

if __name__ == "__main__":
    main()
