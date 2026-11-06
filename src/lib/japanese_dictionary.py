#!/usr/bin/env python3
"""
English-to-Japanese Dictionary Engine (EJDict SQLite)
=====================================================
A high-performance offline English-to-Japanese dictionary and translation system
backed by the comprehensive EJDict dataset (46,612+ indexed lexical entries).

Features:
- Thread-safe SQLite connections via threading.local.
- Exact and case-insensitive English word lookup.
- Fast indexed n-gram phrase matching (bigrams/trigrams).
- Lemmatization and morphological inflection resolution (-ing, -ed, -s, -es, -ies, -er, -est, -ly).
- Sentence-level vocabulary translation and glossing.
- Integration interface for GPT-6 and audio generation pipelines.
"""

import os
import re
import sqlite3
import threading
import argparse
from typing import Dict, List, Optional, Any, Tuple

DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "dictionary", "ejdict.sqlite3"
)


class EnglishToJapaneseDictionary:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Dictionary database not found at: {self.db_path}")
        self._local = threading.local()

    def _get_cursor(self) -> sqlite3.Cursor:
        if not hasattr(self._local, "conn"):
            self._local.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._local.cur = self._local.conn.cursor()
        return self._local.cur

    def _get_lemma_candidates(self, word: str) -> List[str]:
        w = word.lower().strip()
        candidates = []
        
        # Plural -ies -> -y (stories -> story)
        if w.endswith("ies") and len(w) > 4:
            candidates.append(w[:-3] + "y")
        # Plural -es (boxes -> box, watches -> watch)
        if w.endswith("es") and len(w) > 3:
            candidates.append(w[:-2])
        # Plural -s (farmers -> farmer)
        if w.endswith("s") and len(w) > 2 and not w.endswith("ss"):
            candidates.append(w[:-1])
            
        # Participle -ing (waiting -> wait, making -> make, running -> run)
        if w.endswith("ing") and len(w) > 4:
            candidates.append(w[:-3])
            candidates.append(w[:-3] + "e")
            if len(w) > 5 and w[-4] == w[-5]:
                candidates.append(w[:-4])
                
        # Past tense -ed (crashed -> crash, liked -> like, stopped -> stop)
        if w.endswith("ed") and len(w) > 3:
            candidates.append(w[:-2])
            candidates.append(w[:-1])
            if len(w) > 4 and w[-3] == w[-4]:
                candidates.append(w[:-3])
                
        # Adverb -ly (happily -> happy, quickly -> quick)
        if w.endswith("ly") and len(w) > 3:
            if w.endswith("ily") and len(w) > 4:
                candidates.append(w[:-3] + "y")
            candidates.append(w[:-2])
            
        # Comparatives -er / -est
        if w.endswith("er") and len(w) > 3:
            candidates.append(w[:-2])
            candidates.append(w[:-1])
        if w.endswith("est") and len(w) > 4:
            candidates.append(w[:-3])
            candidates.append(w[:-2])
            
        return candidates

    def lookup_raw(self, word: str) -> Optional[Tuple[str, str]]:
        """Returns (matched_word, raw_translation) or None."""
        w = word.strip().lower()
        if not w:
            return None

        cur = self._get_cursor()

        # 1. Direct match in entries_indexed
        cur.execute("SELECT word, translation FROM entries_indexed WHERE word = ? LIMIT 1", (w,))
        row = cur.fetchone()
        if row:
            return row[0], row[1]

        # 2. Try lemmatization
        for cand in self._get_lemma_candidates(w):
            cur.execute("SELECT word, translation FROM entries_indexed WHERE word = ? LIMIT 1", (cand,))
            row = cur.fetchone()
            if row:
                return row[0], row[1]

        # 3. Direct match in entries (multi-headword)
        cur.execute("SELECT word, translation FROM entries WHERE word = ? LIMIT 1", (w,))
        row = cur.fetchone()
        if row:
            return row[0], row[1]

        return None

    def clean_japanese_gloss(self, raw_translation: str, max_glosses: int = 3) -> str:
        """Parses the EJDict markup to extract clean Japanese vocabulary meanings."""
        if not raw_translation:
            return ""

        # Remove HTML/XML or grammar bracket tags like <C>, <U>, 《米》, 『...』
        cleaned = raw_translation
        cleaned = cleaned.replace("『", "").replace("』", "")
        cleaned = re.sub(r"〈[^〉]*〉", "", cleaned)
        cleaned = re.sub(r"《[^》]*》", "", cleaned)
        cleaned = re.sub(r"\[[^\]]*\]", "", cleaned)
        cleaned = re.sub(r"\(.*?\)", "", cleaned)
        cleaned = re.sub(r"\+[^/]+", "", cleaned)

        # Split on slashes or semicolons
        items = [p.strip() for p in cleaned.split("/") if p.strip()]
        
        extracted = []
        for item in items:
            terms = [t.strip() for t in re.split(r"[,、]", item) if t.strip()]
            for t in terms:
                t = re.sub(r"^[a-zA-Z0-9\s\.\-—'\"=]+", "", t).strip()
                if t and t not in extracted:
                    extracted.append(t)
                    if len(extracted) >= max_glosses:
                        break
            if len(extracted) >= max_glosses:
                break

        if not extracted:
            return re.sub(r"[〈〉《》\(\)\[\]]", "", raw_translation)[:50].strip()

        return " / ".join(extracted)

    def translate_word(self, word: str) -> Optional[Dict[str, str]]:
        """Returns structured dictionary entry for a single English word."""
        res = self.lookup_raw(word)
        if not res:
            return None
        matched_word, raw_trans = res
        clean = self.clean_japanese_gloss(raw_trans)
        return {
            "english": word,
            "matched_headword": matched_word,
            "japanese_gloss": clean,
            "raw_definition": raw_trans
        }

    def translate_phrase_or_sentence(self, text: str) -> Dict[str, Any]:
        """
        Translates an English sentence by decomposing into tokens and n-grams,
        looking up each against the indexed English-to-Japanese dictionary.
        """
        tokens = re.findall(r"\b[A-Za-z0-9'-]+\b", text)
        lexicon_map = {}
        glossary = []
        cur = self._get_cursor()

        stop_words = {"the", "a", "an", "is", "are", "was", "were", "to", "in", "at", "of", "on", "for", "with", "and", "or", "it", "he", "she", "they", "we", "i"}

        # 1. Trigram & Bigram indexed lookups
        words_lower = [t.lower() for t in tokens]
        n = len(words_lower)
        matched_indices = set()

        # Trigrams
        for i in range(n - 2):
            tri = f"{words_lower[i]} {words_lower[i+1]} {words_lower[i+2]}"
            cur.execute("SELECT word, translation FROM entries_indexed WHERE word = ? LIMIT 1", (tri,))
            r = cur.fetchone()
            if r:
                clean = self.clean_japanese_gloss(r[1])
                glossary.append({"english": tri, "japanese": clean})
                lexicon_map[tri] = clean
                matched_indices.update([i, i+1, i+2])

        # Bigrams
        for i in range(n - 1):
            if i in matched_indices and (i+1) in matched_indices:
                continue
            bi = f"{words_lower[i]} {words_lower[i+1]}"
            cur.execute("SELECT word, translation FROM entries_indexed WHERE word = ? LIMIT 1", (bi,))
            r = cur.fetchone()
            if r:
                clean = self.clean_japanese_gloss(r[1])
                glossary.append({"english": bi, "japanese": clean})
                lexicon_map[bi] = clean
                matched_indices.update([i, i+1])

        # Single word lookups
        for i, tok in enumerate(tokens):
            if i in matched_indices:
                continue
            tok_lower = tok.lower()
            if tok_lower in lexicon_map:
                continue
            res = self.lookup_raw(tok)
            if res:
                matched_w, raw_trans = res
                clean = self.clean_japanese_gloss(raw_trans)
                if clean:
                    lexicon_map[tok_lower] = clean
                    if tok_lower not in stop_words:
                        glossary.append({"english": tok, "japanese": clean})

        return {
            "source_english": text,
            "vocabulary_glossary": glossary,
            "dictionary_lookup_count": len(glossary)
        }

    def build_bilingual_prompt_context(self, english_paragraphs: List[str]) -> str:
        """
        Creates a structured lexical grounding prompt for GPT-6 from the English paragraphs.
        """
        lines = []
        lines.append("### English-to-Japanese Dictionary Grounding:")
        seen = set()
        
        for para in english_paragraphs:
            result = self.translate_phrase_or_sentence(para)
            for item in result["vocabulary_glossary"]:
                eng = item["english"].lower()
                if eng not in seen:
                    seen.add(eng)
                    lines.append(f"- {item['english']}: {item['japanese']}")
                    
        return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="English-to-Japanese Dictionary Engine")
    parser.add_argument("query", nargs="?", default="During the Warring States period, there was a farmer who had a tree in his field.", help="English text to translate or lookup")
    parser.add_argument("--word", type=str, help="Single word lookup")
    args = parser.parse_args()

    d = EnglishToJapaneseDictionary()

    if args.word:
        entry = d.translate_word(args.word)
        if entry:
            print(f"Word: {entry['english']}")
            print(f"Matched: {entry['matched_headword']}")
            print(f"Japanese: {entry['japanese_gloss']}")
            print(f"Raw: {entry['raw_definition']}")
        else:
            print(f"Word '{args.word}' not found in dictionary.")
    else:
        print(f"Translating: '{args.query}'\n")
        res = d.translate_phrase_or_sentence(args.query)
        print("Dictionary Vocabulary Translations:")
        for v in res["vocabulary_glossary"]:
            print(f"  • {v['english']}: {v['japanese']}")
        print(f"\nTotal Terms Grounded: {res['dictionary_lookup_count']}")
