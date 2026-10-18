#!/usr/bin/env python3
"""
Audio Narration Generation & Synchronizer Engine
=================================================
Generates high-fidelity neural audio readings for both Mandarin and Japanese stories:
- Japanese: ja-JP-NanamiNeural (warm, clear, friendly Japanese narration)
- Mandarin: zh-CN-XiaoxiaoNeural (standard, articulate Putonghua narration)
- Updates audio_url in both JSON databases and JS bundles.
- Updates all Markdown reader files with local audio links.
"""

import os
import json
import asyncio
import time
import re
import edge_tts

# Paths
BASE_DIR = "/home/kami/Desktop/codebase/language"
MANDARIN_JSON = os.path.join(BASE_DIR, "mandarin/stories.json")
MANDARIN_AUDIO_DIR = os.path.join(BASE_DIR, "mandarin/audio")
MANDARIN_READERS_DIR = os.path.join(BASE_DIR, "mandarin/readers")
MANDARIN_JS = os.path.join(BASE_DIR, "stories_mandarin.js")

JAPANESE_JSON = os.path.join(BASE_DIR, "japanese/stories.json")
JAPANESE_AUDIO_DIR = os.path.join(BASE_DIR, "japanese/audio")
JAPANESE_READERS_DIR = os.path.join(BASE_DIR, "japanese/readers")
JAPANESE_JS = os.path.join(BASE_DIR, "stories_japanese.js")

os.makedirs(MANDARIN_AUDIO_DIR, exist_ok=True)
os.makedirs(JAPANESE_AUDIO_DIR, exist_ok=True)

VOICE_JA = "ja-JP-NanamiNeural"
VOICE_ZH = "zh-CN-XiaoxiaoNeural"

async def generate_single_audio(text, voice, out_path, sem, rate="-6%"):
    if os.path.exists(out_path) and os.path.getsize(out_path) > 5000:
        return True
    async with sem:
        for attempt in range(3):
            try:
                comm = edge_tts.Communicate(text, voice, rate=rate)
                await comm.save(out_path)
                return True
            except Exception as e:
                if attempt == 2:
                    print(f"Error generating {out_path}: {e}")
                    return False
                await asyncio.sleep(1.0 + attempt)

async def process_japanese_stories(stories, sem):
    print("--- GENERATING JAPANESE AUDIO NARRATIONS ---")
    tasks = []
    for s in stories:
        sid = s['id']
        slug = s.get('slug', str(sid))
        filename = f"{sid}_{slug}.mp3"
        out_path = os.path.join(JAPANESE_AUDIO_DIR, filename)
        rel_path = f"japanese/audio/{filename}"
        s['audio_url'] = rel_path
        
        paras = s.get('japanese_paragraphs', [])
        text = " ".join(paras)
        tasks.append(generate_single_audio(text, VOICE_JA, out_path, sem, rate="-6%"))
        
    results = await asyncio.gather(*tasks)
    success_count = sum(1 for r in results if r)
    print(f"Generated {success_count}/{len(stories)} Japanese audio files")

async def process_mandarin_stories(stories, sem):
    print("--- GENERATING MANDARIN AUDIO NARRATIONS ---")
    tasks = []
    for s in stories:
        sid = s['id']
        slug = s.get('slug', str(sid))
        filename = f"{sid}_{slug}.mp3"
        out_path = os.path.join(MANDARIN_AUDIO_DIR, filename)
        rel_path = f"mandarin/audio/{filename}"
        if 'audio_url' in s and not s.get('original_audio_url'):
            s['original_audio_url'] = s['audio_url']
        s['audio_url'] = rel_path
        
        paras = s.get('simplified_paragraphs', [])
        text = " ".join(paras)
        tasks.append(generate_single_audio(text, VOICE_ZH, out_path, sem, rate="-5%"))
        
    results = await asyncio.gather(*tasks)
    success_count = sum(1 for r in results if r)
    print(f"Generated {success_count}/{len(stories)} Mandarin audio files")

def update_markdown_readers(dir_path, stories, lang_code):
    updated = 0
    for s in stories:
        sid = s['id']
        slug = s.get('slug', str(sid))
        md_filename = f"{sid}_{slug}.md"
        md_path = os.path.join(dir_path, md_filename)
        if not os.path.exists(md_path):
            continue
            
        with open(md_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        audio_target = f"audio/{sid}_{slug}.mp3"
        # Replace Libsyn or old audio links
        new_content = re.sub(
            r'-\s*\*\*Audio Narration\*\*:[^\n]+',
            f'- **Audio Narration**: [Listen / Download MP3]({audio_target})',
            content
        )
        new_content = re.sub(
            r'-\s*\*\*Narration Audio\*\*:[^\n]+',
            f'- **Narration Audio**: [Listen / Download MP3]({audio_target})',
            new_content
        )
        
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        updated += 1
    print(f"Updated audio links in {updated} {lang_code} Markdown reader files")

async def main():
    t0 = time.time()
    sem = asyncio.Semaphore(8)
    
    # Load Japanese
    with open(JAPANESE_JSON, 'r', encoding='utf-8') as f:
        j_stories = json.load(f)
        
    # Load Mandarin
    with open(MANDARIN_JSON, 'r', encoding='utf-8') as f:
        m_stories = json.load(f)
        
    # Generate Japanese & Mandarin audios
    await process_japanese_stories(j_stories, sem)
    await process_mandarin_stories(m_stories, sem)
    
    # Save Japanese JSON & JS
    with open(JAPANESE_JSON, 'w', encoding='utf-8') as f:
        json.dump(j_stories, f, indent=2, ensure_ascii=False)
    with open(JAPANESE_JS, 'w', encoding='utf-8') as f:
        f.write('window.JAPANESE_STORIES = ' + json.dumps(j_stories, ensure_ascii=False) + ';')
    print(f"Saved {JAPANESE_JSON} and {JAPANESE_JS}")
    
    # Save Mandarin JSON & JS
    with open(MANDARIN_JSON, 'w', encoding='utf-8') as f:
        json.dump(m_stories, f, indent=2, ensure_ascii=False)
    with open(MANDARIN_JS, 'w', encoding='utf-8') as f:
        f.write('window.MANDARIN_STORIES = ' + json.dumps(m_stories, ensure_ascii=False) + ';')
    print(f"Saved {MANDARIN_JSON} and {MANDARIN_JS}")
    
    # Update Readers
    update_markdown_readers(JAPANESE_READERS_DIR, j_stories, "Japanese")
    update_markdown_readers(MANDARIN_READERS_DIR, m_stories, "Mandarin")
    
    print(f"\n>>> ALL READINGS SETUP COMPLETED IN {time.time() - t0:.1f}s! <<<")

if __name__ == '__main__':
    asyncio.run(main())
