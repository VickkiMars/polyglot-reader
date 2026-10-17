#!/usr/bin/env python3
"""
Mandarin Bean Story Extractor & Translation Pipeline
====================================================
Extracts all stories from mandarinbean.com/tag/story/ including:
- Metadata: Title, Level (Beginner/Intermediate/Advanced), HSK tags, Date, Audio URL
- Texts: Simplified Chinese, Traditional Chinese, Pinyin with tone marks
- Vocabulary: Per-token English definitions and HSK levels
- English Version: Both per-word native definitions and full English prose translation
- Formats: JSON, CSV, and formatted Markdown readers
"""

import os
import re
import json
import csv
import time
import argparse
import html
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.parse
from bs4 import BeautifulSoup
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE_URL = "https://mandarinbean.com"
WP_API_URL = f"{BASE_URL}/wp-json/wp/v2"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
HEADERS = {"User-Agent": USER_AGENT}


class MandarinBeanPipeline:
    def __init__(self, output_dir="output", translate=True, workers=4):
        self.output_dir = output_dir
        self.translate_enabled = translate
        self.workers = workers
        self.categories_map = {}
        self.tags_map = {}
        self._translate_lock = threading.Semaphore(6)  # High throughput concurrent translation

        # Resilient requests session with retries and connection pooling
        self.session = requests.Session()
        retries = Retry(
            total=5,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            raise_on_status=False
        )
        adapter = HTTPAdapter(max_retries=retries, pool_connections=10, pool_maxsize=20)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        self.session.headers.update(HEADERS)

    def _http_get(self, url, as_json=True, retries=5, delay=1.0):
        for attempt in range(retries):
            try:
                resp = self.session.get(url, timeout=30)
                if resp.status_code == 200:
                    if as_json:
                        return resp.json(), dict(resp.headers)
                    return resp.text, dict(resp.headers)
                time.sleep(delay * (attempt + 1))
            except Exception as e:
                if attempt == retries - 1:
                    raise e
                time.sleep(delay * (attempt + 1))
        raise RuntimeError(f"Failed to fetch {url}")

    def load_taxonomies(self):
        """Fetch categories and tags to map taxonomy IDs to human-readable names."""
        print("[*] Fetching categories and tags taxonomies...")
        try:
            cats, _ = self._http_get(f"{WP_API_URL}/categories?per_page=100")
            self.categories_map = {c["id"]: c["name"] for c in cats}
        except Exception as e:
            print(f"[-] Warning: Failed to fetch categories: {e}")

        try:
            tags, headers = self._http_get(f"{WP_API_URL}/tags?per_page=100&page=1")
            self.tags_map = {t["id"]: t["name"] for t in tags}
            headers_lower = {k.lower(): v for k, v in headers.items()}
            total_pages = int(headers_lower.get("x-wp-totalpages", "1"))
            for page in range(2, total_pages + 1):
                more_tags, _ = self._http_get(f"{WP_API_URL}/tags?per_page=100&page={page}")
                self.tags_map.update({t["id"]: t["name"] for t in more_tags})
        except Exception as e:
            print(f"[-] Warning: Failed to fetch tags: {e}")

        print(f"[+] Loaded {len(self.categories_map)} categories and {len(self.tags_map)} tags.")

    def fetch_story_posts(self, limit=None):
        """Fetch story posts (Tag ID 7: Story) using WP REST API."""
        print("[*] Querying story archive via WordPress REST API...")
        posts = []
        page = 1
        per_page = 100

        while True:
            url = f"{WP_API_URL}/posts?tags=7&per_page={per_page}&page={page}"
            try:
                page_posts, headers = self._http_get(url)
                if not page_posts:
                    break
                posts.extend(page_posts)

                headers_lower = {k.lower(): v for k, v in headers.items()}
                total_posts = int(headers_lower.get("x-wp-total", str(len(posts))))
                total_pages = int(headers_lower.get("x-wp-totalpages", "1"))
                print(f"    Page {page}/{total_pages}: Retrieved {len(page_posts)} posts (Progress: {len(posts)}/{total_posts})")

                if limit and len(posts) >= limit:
                    posts = posts[:limit]
                    break

                if page >= total_pages:
                    break
                page += 1
            except Exception as e:
                print(f"[-] Error fetching page {page}: {e}")
                break

        print(f"[+] Total story posts retrieved: {len(posts)}")
        return posts

    def extract_audio_url(self, post):
        """Extract audio narration MP3 URL from Yoast metadata or post structure."""
        yoast = post.get("yoast_head_json", {})
        og_images = yoast.get("og_image", [])
        if og_images and isinstance(og_images, list):
            img_url = og_images[0].get("url", "")
            match = re.search(r"/(\d+)\.(?:jpg|png|webp)", img_url)
            if match:
                audio_id = match.group(1)
                return f"https://traffic.libsyn.com/secure/learnchinese/{audio_id}.mp3"

        # Fallback regex on content or yoast_head
        match = re.search(r"https?://traffic\.libsyn\.com/secure/learnchinese/\d+\.mp3", str(post))
        if match:
            return match.group(0)

        return None

    def parse_story_content(self, html_content):
        """
        Parses the story HTML containing ruby elements:
        - Simplified Chinese text
        - Traditional Chinese text
        - Pinyin transcription
        - Word-level glossary (word, pinyin, definition, HSK level)
        """
        soup = BeautifulSoup(html_content, "html.parser")
        paragraphs = soup.find_all("p")

        simplified_paragraphs = []
        traditional_paragraphs = []
        pinyin_paragraphs = []
        vocabulary = []
        seen_words = set()

        for p in paragraphs:
            # Skip member lock text or buttons if present
            if "lock_content" in p.get("class", []) or "Already a subscriber" in p.get_text():
                continue

            sim_para = []
            tr_para = []
            py_para = []

            for child in p.children:
                if child.name == "ruby":
                    si_elem = child.find("span", class_="si")
                    tr_elem = child.find("span", class_="tr")
                    rt_elem = child.find("rt")

                    si_text = si_elem.get_text().strip() if si_elem else ""
                    tr_text = tr_elem.get_text().strip() if tr_elem else ""
                    py_text = rt_elem.get_text().strip() if rt_elem else child.get("data-mb-pinyin", "").strip()

                    defn = child.get("data-mb-definition", "").strip()
                    old_hsk = child.get("data-mb-oldhsk", "").strip()
                    new_hsk = child.get("data-mb-newhsk", "").strip()

                    sim_para.append(si_text)
                    tr_para.append(tr_text if tr_text else si_text)
                    if py_text:
                        py_para.append(py_text)

                    if si_text and si_text not in seen_words and defn:
                        seen_words.add(si_text)
                        vocabulary.append({
                            "word_simplified": si_text,
                            "word_traditional": tr_text,
                            "pinyin": py_text,
                            "definition": html.unescape(defn),
                            "old_hsk": old_hsk,
                            "new_hsk": new_hsk
                        })
                elif isinstance(child, str):
                    text = child
                    if text.strip() or text in "，。！？；：、“”‘’（）《》 \n":
                        sim_para.append(text)
                        tr_para.append(text)
                        py_para.append(text)

            sim_joined = "".join(sim_para).strip()
            tr_joined = "".join(tr_para).strip()
            py_joined = " ".join(py_para).strip()

            # Clean up extra spacing around Chinese punctuation in pinyin
            py_joined = re.sub(r"\s+([，。！？；：、“”‘’（）《》])", r"\1", py_joined)

            if sim_joined:
                simplified_paragraphs.append(sim_joined)
                traditional_paragraphs.append(tr_joined)
                pinyin_paragraphs.append(py_joined)

        return {
            "simplified_paragraphs": simplified_paragraphs,
            "traditional_paragraphs": traditional_paragraphs,
            "pinyin_paragraphs": pinyin_paragraphs,
            "simplified_full": "\n\n".join(simplified_paragraphs),
            "traditional_full": "\n\n".join(traditional_paragraphs),
            "pinyin_full": "\n\n".join(pinyin_paragraphs),
            "vocabulary": vocabulary
        }

    def translate_to_english(self, text, retries=4):
        """Translates Chinese text into English using Google Translate web service."""
        if not text or not self.translate_enabled:
            return ""

        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=en&dt=t&q={urllib.parse.quote(text)}"

        for attempt in range(retries):
            try:
                with self._translate_lock:
                    resp = self.session.get(url, timeout=15)
                    if resp.status_code == 200:
                        data = resp.json()
                        translated_segments = [seg[0] for seg in data[0] if seg and seg[0]]
                        time.sleep(0.05)
                        return "".join(translated_segments).strip()
                time.sleep(1.0 * (attempt + 1))
            except Exception as e:
                if attempt == retries - 1:
                    print(f"[-] Translation failed for text segment: {e}")
                    return ""
                time.sleep(1.5 * (attempt + 1))
        return ""

    def process_story(self, post):
        """Processes a single raw post dictionary into a comprehensive story record."""
        post_id = post["id"]
        raw_title = post.get("title", {}).get("rendered", "")
        clean_title = html.unescape(raw_title)
        link = post.get("link", "")
        slug = post.get("slug", "")
        date = post.get("date", "")

        # Map taxonomies
        cats = [self.categories_map.get(cid, str(cid)) for cid in post.get("categories", [])]
        tags = [self.tags_map.get(tid, str(tid)) for tid in post.get("tags", [])]

        # Determine difficulty level
        level = "Unspecified"
        for c in cats:
            if c in ["Beginner", "Intermediate", "Advanced"]:
                level = c
                break

        hsk_levels = [t for t in tags if "HSK" in t]

        # Extract audio link
        audio_url = self.extract_audio_url(post)

        # Parse Chinese content
        raw_html = post.get("content", {}).get("rendered", "")
        parsed = self.parse_story_content(raw_html)

        # Generate English translation for the story in a single batched request
        english_paragraphs = []
        english_full = ""
        if self.translate_enabled and parsed["simplified_paragraphs"]:
            joined_text = "\n\n".join(parsed["simplified_paragraphs"])
            english_full = self.translate_to_english(joined_text)
            if english_full:
                parts = [p.strip() for p in english_full.split("\n\n") if p.strip()]
                if len(parts) == len(parsed["simplified_paragraphs"]):
                    english_paragraphs = parts
                else:
                    lines = [p.strip() for p in english_full.split("\n") if p.strip()]
                    if len(lines) == len(parsed["simplified_paragraphs"]):
                        english_paragraphs = lines
                    else:
                        english_paragraphs = parts if parts else [english_full]

        return {
            "id": post_id,
            "title": clean_title,
            "slug": slug,
            "url": link,
            "date": date,
            "level": level,
            "categories": cats,
            "tags": tags,
            "hsk_tags": hsk_levels,
            "audio_url": audio_url,
            "simplified_paragraphs": parsed["simplified_paragraphs"],
            "traditional_paragraphs": parsed["traditional_paragraphs"],
            "pinyin_paragraphs": parsed["pinyin_paragraphs"],
            "english_paragraphs": english_paragraphs,
            "simplified_full": parsed["simplified_full"],
            "traditional_full": parsed["traditional_full"],
            "pinyin_full": parsed["pinyin_full"],
            "english_full": english_full,
            "vocabulary": parsed["vocabulary"]
        }

    def download_audio_file(self, audio_url, filename):
        """Optionally download MP3 narration audio file."""
        if not audio_url:
            return None
        audio_dir = os.path.join(self.output_dir, "audio")
        os.makedirs(audio_dir, exist_ok=True)
        local_path = os.path.join(audio_dir, filename)

        if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            return local_path

        try:
            resp = self.session.get(audio_url, timeout=30)
            if resp.status_code == 200:
                with open(local_path, "wb") as f:
                    f.write(resp.content)
                return local_path
        except Exception as e:
            print(f"[-] Warning: Failed to download audio from {audio_url}: {e}")
        return None

    def export_data(self, stories):
        """Exports extracted stories into JSON, CSV, and Markdown readers."""
        if not stories:
            print("[-] Warning: No stories to export.")
            return

        os.makedirs(self.output_dir, exist_ok=True)
        md_dir = os.path.join(self.output_dir, "readers")
        os.makedirs(md_dir, exist_ok=True)

        # 1. Export JSON
        json_path = os.path.join(self.output_dir, "stories.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(stories, f, ensure_ascii=False, indent=2)
        print(f"[+] Saved complete JSON archive ({len(stories)} stories) to: {json_path}")

        # 2. Export CSV
        csv_path = os.path.join(self.output_dir, "stories.csv")
        with open(csv_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "ID", "Title", "Level", "HSK Tags", "Date", "URL", "Audio URL",
                "Simplified Text", "Pinyin Text", "English Translation", "Vocabulary Count"
            ])
            for s in stories:
                writer.writerow([
                    s["id"],
                    s["title"],
                    s["level"],
                    "; ".join(s["hsk_tags"]),
                    s["date"],
                    s["url"],
                    s["audio_url"] or "",
                    s["simplified_full"],
                    s["pinyin_full"],
                    s["english_full"],
                    len(s["vocabulary"])
                ])
        print(f"[+] Saved summary CSV to: {csv_path}")

        # 3. Export Markdown readers
        for s in stories:
            filename = f"{s['id']}_{s['slug']}.md"
            filepath = os.path.join(md_dir, filename)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(f"# {s['title']}\n\n")
                f.write(f"- **Level**: {s['level']} ({', '.join(s['hsk_tags']) if s['hsk_tags'] else 'N/A'})\n")
                f.write(f"- **URL**: [{s['url']}]({s['url']})\n")
                if s["audio_url"]:
                    f.write(f"- **Audio Narration**: [Listen / Download MP3]({s['audio_url']})\n")
                f.write("\n---\n\n")

                f.write("## 1. Story Text & Pinyin\n\n")
                for i in range(len(s["simplified_paragraphs"])):
                    sim = s["simplified_paragraphs"][i]
                    py = s["pinyin_paragraphs"][i] if i < len(s["pinyin_paragraphs"]) else ""
                    en = s["english_paragraphs"][i] if i < len(s["english_paragraphs"]) else ""

                    f.write(f"**Chinese**:\n{sim}\n\n")
                    if py:
                        f.write(f"*Pinyin*:\n{py}\n\n")
                    if en:
                        f.write(f"> **English Translation**:\n> {en}\n\n")

                if s["vocabulary"]:
                    f.write("\n---\n\n## 2. Vocabulary & Grammar Notes\n\n")
                    f.write("| Simplified | Traditional | Pinyin | Definition | HSK Level |\n")
                    f.write("| --- | --- | --- | --- | --- |\n")
                    for v in s["vocabulary"]:
                        hsk = v["old_hsk"] or v["new_hsk"] or "-"
                        f.write(f"| {v['word_simplified']} | {v['word_traditional']} | {v['pinyin']} | {v['definition']} | HSK {hsk} |\n")

        print(f"[+] Exported {len(stories)} Markdown readers to: {md_dir}")

    def run(self, limit=None, download_audio=False):
        self.load_taxonomies()
        posts = self.fetch_story_posts(limit=limit)

        cache_file = os.path.join(self.output_dir, "stories_cache.json")
        cached_stories = {}
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    for s in json.load(f):
                        cached_stories[s["id"]] = s
                print(f"[+] Loaded {len(cached_stories)} existing stories from cache.")
            except Exception:
                pass

        total_posts = len(posts)
        print(f"[*] Processing and translating {total_posts} stories with {self.workers} worker threads...")

        def _worker(post):
            pid = post["id"]
            title = html.unescape(post.get("title", {}).get("rendered", ""))
            if pid in cached_stories:
                story_data = cached_stories[pid]
                if self.translate_enabled and not story_data.get("english_full") and story_data.get("simplified_full"):
                    print(f"[*] Retrying missing translation for story {pid}: {title[:35]}")
                    trans = self.translate_to_english(story_data["simplified_full"])
                    if trans:
                        story_data["english_full"] = trans
                        story_data["english_paragraphs"] = [p.strip() for p in trans.split("\n\n") if p.strip()]
                        cached_stories[pid] = story_data
            else:
                story_data = self.process_story(post)
                cached_stories[pid] = story_data

            if download_audio and story_data.get("audio_url"):
                audio_file = f"{story_data['id']}_{story_data['slug']}.mp3"
                local_audio = self.download_audio_file(story_data["audio_url"], audio_file)
                story_data["local_audio"] = local_audio

            return post["id"], story_data

        stories_by_id = {}
        completed_count = 0

        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            future_to_post = {executor.submit(_worker, post): post for post in posts}
            for future in as_completed(future_to_post):
                post = future_to_post[future]
                completed_count += 1
                try:
                    pid, story_data = future.result()
                    stories_by_id[pid] = story_data
                    title = story_data.get("title", "")
                    print(f"[{completed_count}/{total_posts}] Completed story ID {pid}: {title[:40]}")
                except Exception as e:
                    print(f"[-] Error processing post {post.get('id')}: {e}")

                if completed_count % 15 == 0 or completed_count == total_posts:
                    os.makedirs(self.output_dir, exist_ok=True)
                    with open(cache_file, "w", encoding="utf-8") as f:
                        json.dump(list(cached_stories.values()), f, ensure_ascii=False, indent=2)

        # Preserve original post ordering
        stories = [stories_by_id[p["id"]] for p in posts if p["id"] in stories_by_id]

        self.export_data(stories)
        print(f"[+] Successfully extracted and exported all {len(stories)} stories!")
        return stories


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Mandarin Bean Story Extractor & Translation Pipeline")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of stories to process (e.g. --limit 5)")
    parser.add_argument("--output-dir", type=str, default="data/mandarinbean_stories", help="Output directory")
    parser.add_argument("--no-translate", action="store_true", help="Disable automatic English translation")
    parser.add_argument("--download-audio", action="store_true", help="Download MP3 audio narration files locally")
    parser.add_argument("--workers", type=int, default=8, help="Number of concurrent worker threads (default: 8)")
    args = parser.parse_args()

    pipeline = MandarinBeanPipeline(
        output_dir=args.output_dir,
        translate=not args.no_translate,
        workers=args.workers
    )
    pipeline.run(limit=args.limit, download_audio=args.download_audio)
