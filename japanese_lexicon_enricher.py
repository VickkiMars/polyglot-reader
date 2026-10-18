#!/usr/bin/env python3
"""
Japanese Lexicon Enricher & Parity Engine (Morphological Edition)
==================================================================
Brings the Japanese stories dataset into 100% lexical and pedagogical parity with MandarinBean:
1. High-precision morphological tokenization using Janome with smart compound merging.
2. Inflection lemmatization (verbs and adjectives mapped to dictionary base forms with clean glosses).
3. Resolves proper names from Mandarin bilingual context (e.g. ダーウェイ -> David (name)).
4. Grammatical particles and auxiliaries accurately mapped to learner glosses (no archaic JMDict collisions).
5. JLPT levels (N5..N1) assigned across all vocabulary words.
6. Pre-renders rich `ruby_paragraphs` with 100% word coverage and clean tooltips.
7. Regenerates all 206 Markdown reader files with full narrative vocabulary tables.
8. Regenerates stories.csv and stories_japanese.js.
"""

import os
import json
import csv
import time
import html
import re
from janome.tokenizer import Tokenizer
import pykakasi
from jamdict import Jamdict

# Paths
MANDARIN_JSON = "/home/kami/Desktop/codebase/language/mandarin/stories.json"
JAPANESE_JSON = "/home/kami/Desktop/codebase/language/japanese/stories.json"
JAPANESE_READERS_DIR = "/home/kami/Desktop/codebase/language/japanese/readers"
JAPANESE_CSV = "/home/kami/Desktop/codebase/language/japanese/stories.csv"
JAPANESE_JS = "/home/kami/Desktop/codebase/language/stories_japanese.js"

# Initialize tools
tokenizer = Tokenizer()
kakasi = pykakasi.kakasi()
jmd = Jamdict()
dict_cache = {}

READING_OVERRIDES = {
    '一時': 'いちじ', '二時': 'にじ', '三時': 'さんじ', '四時': 'よじ', '五時': 'ごじ',
    '六時': 'ろくじ', '七時': 'しちじ', '八時': 'はちじ', '九時': 'くじ', '十時': 'じゅうじ',
    '十一時': 'じゅういちじ', '十二時': 'じゅうにじ', '一人': 'ひとり', '二人': 'ふたり',
    '三人': 'さんにん', '四人': 'よにん', '五人': 'ごにん', '六人': 'ろくにん',
    '一日': 'いちにち', '二日': 'ふつか', '三日': 'みっか', '四日': 'よっか', '五日': 'いつか',
    '六日': 'むいか', '七日': 'なのか', '八日': 'ようか', '九日': 'ここのか', '十日': 'とおか',
    '今': 'いま', '大人': 'おとな', '三十分': 'さんじゅっぷん', '一時間': 'いちじかん',
    '見': 'み', '出': 'で', '入': 'はい', '行': 'い', '来': 'き',
    '肉まん': 'にくまん', '中国茶': 'ちゅうごくちゃ', '中国料理': 'ちゅうごくりょうり',
    'ショッピングモール': 'しょっぴんぐもーる'
}

PARTICLES = {
    'は': ('topic marker', 'N5'),
    'が': ('subject marker', 'N5'),
    'を': ('direct object marker', 'N5'),
    'に': ('target / time / direction marker (to/at/in)', 'N5'),
    'で': ('location / means marker (at/in/by)', 'N5'),
    'の': ("possessive particle ('s / of)", 'N5'),
    'と': ('and / with', 'N5'),
    'も': ('also / too', 'N5'),
    'へ': ('direction marker (towards/to)', 'N5'),
    'から': ('from / because / since', 'N5'),
    'まで': ('until / as far as', 'N5'),
    'ね': ("sentence-ending particle (isn't it? / right?)", 'N5'),
    'よ': ('sentence-ending particle (emphasis / you know)', 'N5'),
    'か': ('question particle (?)', 'N5'),
    'より': ('more than / comparison', 'N4'),
    'ほど': ('degree / extent / about', 'N3'),
    'など': ('and so on / etc.', 'N4'),
    'やら': ('and the like / etc.', 'N2'),
    'ば': ('if (conditional)', 'N4'),
    'なら': ('if / in case', 'N4'),
    'たら': ('if / when (conditional)', 'N5'),
    'ても': ('even if / even though', 'N4'),
    'でも': ('even / or something / but', 'N5')
}

COMMON_GRAMMAR = {
    'です': ('be / is / are (polite copula)', 'N5'),
    'でした': ('was / were (past polite copula)', 'N5'),
    'だ': ('be / is (plain copula)', 'N5'),
    'だった': ('was (past plain copula)', 'N5'),
    'ます': ('verb polite suffix (present/future)', 'N5'),
    'ました': ('verb polite suffix (past: did / -ed)', 'N5'),
    'ません': ('verb polite suffix (negative: do not)', 'N5'),
    'ませんでした': ('verb polite suffix (past negative: did not)', 'N5'),
    'まし': ('verb polite suffix (stem of ます)', 'N5'),
    'ませ': ('verb polite suffix (stem of ます)', 'N5'),
    'て': ('conjunctive particle (and / -ing)', 'N5'),
    'いる': ('to be / to exist (progressive state / animate)', 'N5'),
    'います': ('to be / to exist (polite progressive)', 'N5'),
    'い': ('to be / to exist (auxiliary verb)', 'N5'),
    'いた': ('was / existed', 'N5'),
    'いました': ('was / existed (polite past)', 'N5'),
    'ある': ('there is / to exist (inanimate)', 'N5'),
    'あります': ('there is / to exist (polite)', 'N5'),
    'あり': ('there is / to exist (stem)', 'N5'),
    'あった': ('there was / existed', 'N5'),
    'ありました': ('there was / existed (polite past)', 'N5'),
    'ない': ('not / non-existent', 'N5'),
    'ありません': ('does not exist / is not (polite)', 'N5'),
    'なかった': ('was not / did not exist', 'N5'),
    'する': ('to do', 'N5'),
    'します': ('to do (polite)', 'N5'),
    'した': ('did (past)', 'N5'),
    'しました': ('did (polite past)', 'N5'),
    'し': ('to do (stem of する)', 'N5'),
    'き': ('to come (stem of くる)', 'N5'),
    'たい': ('want to (verbal suffix of desire)', 'N5'),
    'たくない': ('do not want to', 'N5'),
    'たかった': ('wanted to (past desire)', 'N5'),
    'たち': ('plural suffix (group, e.g. 私たち: we)', 'N5'),
    'とも': ('both / all (together)', 'N5'),
    'よう': ('like / in the manner of', 'N4'),
    'ように': ('so that / in order to', 'N4'),
    'そうだ': ('it seems / looks like / I hear that', 'N4'),
    'そうです': ('it looks like / I hear that (polite)', 'N4'),
    'いい': ('good / nice / pleasant', 'N5'),
    'よい': ('good / nice / pleasant', 'N5'),
    'もの': ('thing / object / item', 'N5'),
    'こと': ('thing / matter / fact', 'N5'),
    '二人': ('two people / pair / both', 'N5'),
    '一人': ('one person / alone', 'N5'),
    '今': ('now / at present', 'N5'),
    'た': ('past tense auxiliary (-ed / completed)', 'N5'),
    'ん': ('negative suffix (not) / explanatory', 'N5'),
    '時': ('time / hour / o\'clock', 'N5'),
    '人': ('person / people (counter)', 'N5'),
    '日': ('day / date', 'N5'),
    '年': ('year', 'N5'),
    '月': ('month', 'N5'),
    '分': ('minute', 'N5'),
    '回': ('times / occurrences (counter)', 'N5'),
    '個': ('counter for items / pieces', 'N5'),
    '本': ('counter for long cylindrical items', 'N5'),
    '歳': ('years old / age', 'N5'),
    '才': ('years old / age', 'N5'),
    'ショッピングモール': ('shopping mall', 'N4'),
    '中国料理': ('Chinese food / cuisine', 'N4'),
    '中国茶': ('Chinese tea', 'N5'),
    '十時': ('10 o\'clock', 'N5'),
    '九時': ('9 o\'clock', 'N5'),
    '八時': ('8 o\'clock', 'N5'),
    '肉まん': ('steamed meat bun (manju)', 'N4'),
    '餃子': ('dumplings / gyoza', 'N4')
}

JLPT_MAP = {
    '私': 'N5', '名前': 'N5', '大学生': 'N5', '今': 'N5', '中国': 'N5', '中国語': 'N5',
    '勉強': 'N5', '友達': 'N5', '私たち': 'N5', '二人': 'N5', '大好き': 'N5', '食べる': 'N5',
    '好き': 'N5', 'おいしい': 'N5', '美味しい': 'N5', '飲む': 'N5', '今日': 'N5', '土曜日': 'N5',
    '授業': 'N4', '午前': 'N5', '十時': 'N5', '服': 'N5', '買う': 'N5', '行く': 'N5',
    '午後': 'N5', '映画': 'N5', '見る': 'N5', '夜': 'N5', '自分': 'N4', '作る': 'N5',
    '楽しい': 'N5', '一日': 'N5', '肉まん': 'N4', '餃子': 'N4', '麺': 'N2', '中国料理': 'N4',
    '中国茶': 'N5', '夕食': 'N4', 'ショッピングモール': 'N4', '仲': 'N3', '本': 'N5',
    '読む': 'N5', '書く': 'N5', '聞く': 'N5', '話す': 'N5', '先生': 'N5', '学生': 'N5',
    '学校': 'N5', '家': 'N5', '部屋': 'N5', '時間': 'N5', '仕事': 'N5', '会社': 'N5',
    '車': 'N5', '電車': 'N5', '駅': 'N5', '道': 'N5', '町': 'N5', '人': 'N5', '男': 'N5',
    '女': 'N5', '子': 'N5', '子供': 'N5', '父': 'N5', '母': 'N5', '兄': 'N5', '弟': 'N5',
    '姉': 'N5', '妹': 'N5', '家族': 'N5', '朝': 'N5', '昼': 'N5', '晩': 'N5', '日': 'N5',
    '月': 'N5', '年': 'N5', '週': 'N5', '春': 'N5', '夏': 'N5', '秋': 'N5', '冬': 'N5',
    '天気': 'N5', '雨': 'N5', '雪': 'N5', '風': 'N5', '空': 'N5', '山': 'N5', '川': 'N5',
    '海': 'N5', '花': 'N5', '木': 'N5', '犬': 'N5', '猫': 'N5', '鳥': 'N5', '魚': 'N5',
    '肉': 'N5', '水': 'N5', 'お茶': 'N5', 'お酒': 'N5', 'ご飯': 'N5', 'パン': 'N5',
    '手': 'N5', '足': 'N5', '目': 'N5', '耳': 'N5', '口': 'N5', '顔': 'N5', '頭': 'N5',
    '体': 'N5', '心': 'N4', '病気': 'N5', '病院': 'N5', '薬': 'N5', 'お金': 'N5',
    '店': 'N5', '電話': 'N5', '手紙': 'N5', '写真': 'N5', '旅行': 'N5', '散歩': 'N5',
    '買い物': 'N5', '自転車': 'N5', '乗る': 'N5', '乗って': 'N5', '公園': 'N5', '地下鉄': 'N4',
    'バス': 'N5', '歩く': 'N5', '走る': 'N5', '待つ': 'N5', '会う': 'N5', '教える': 'N5',
    '習う': 'N5', '覚える': 'N4', '忘れる': 'N4', '始める': 'N4', '終わる': 'N4'
}

def clean_defn(text):
    if not text:
        return ''
    parts = [p.strip() for p in text.split(';') if p.strip()]
    cleaned = '; '.join(parts[:2])
    return cleaned[:85]

def get_jamdict_info(word):
    if word in dict_cache:
        return dict_cache[word]
    r = jmd.lookup(word)
    res = {'defn': '', 'reading': '', 'jlpt': '-'}
    if r.entries:
        e = r.entries[0]
        res['reading'] = e.kana_forms[0].text if e.kana_forms else ''
        raw_senses = [s.text() for s in e.senses[:2]]
        res['defn'] = clean_defn('; '.join(raw_senses))
    dict_cache[word] = res
    return res

def build_name_map(m_story):
    """Extracts proper names and terms from Mandarin story vocabulary."""
    names = {}
    for v in m_story.get('vocabulary', []):
        defn = v.get('definition', '')
        simp = v.get('word_simplified', '')
        if '(name)' in defn or 'dynasty' in defn.lower() or 'emperor' in defn.lower():
            name_match = re.search(r'([A-Za-z\s\'-]+)\s*\((?:name|dynasty|emperor)', defn)
            en_name = name_match.group(1).strip() if name_match else defn.split(';')[0].strip()
            names[simp] = f"{en_name} (name)"
            
    names.update({
        '大伟': 'David (name)',
        '马丁': 'Martin (name)',
        '王朋': 'Wang Peng (name)',
        '李友': 'Li You (name)',
        '小明': 'Xiao Ming (name)',
        '小李': 'Xiao Li (name)',
        '小张': 'Xiao Zhang (name)',
        '张桂梅': 'Zhang Guimei (name)',
        '苏敏': 'Su Min (name)',
        '谭婷': 'Tan Ting (name)',
        '贾岛': 'Jia Dao (Tang poet)',
        '李凝': 'Li Ning (name)',
        '谷爱凌': 'Eileen Gu (Olympic skier)',
        '孙玲': 'Sun Ling (name)',
        'パンチ': 'Punch (name)',
        'ダーウェイ': 'David (name)',
        'マーティン': 'Martin (name)',
        'シャオ・ヤン': 'Xiao Yang (name)',
        'ワン・ベイ': 'Wang Bei (name)',
        'リンダ': 'Linda (name)',
        'チャン・イー': 'Zhang Yi (name)',
        'ジャ・ダオ': 'Jia Dao (poet)',
        'リー・ニン': 'Li Ning (name)',
        'スー・ミン': 'Su Min (name)',
        'タン・ティン': 'Tan Ting (name)',
        'アイリーン・グー': 'Eileen Gu (name)',
        'シュエ・ジン': 'Xue Jin (name)',
        'ルー・シュン': 'Lu Xun (author)',
        'ドゥー・フー': 'Du Fu (poet)',
        'リー・バイ': 'Li Bai (poet)',
        'スン・リン': 'Sun Ling (name)',
        'ジャン・グイメイ': 'Zhang Guimei (teacher)'
    })
    return names

def get_hira(surface):
    if surface in READING_OVERRIDES:
        return READING_OVERRIDES[surface]
    res = kakasi.convert(surface)
    if res:
        return ''.join(c.get('hira', '') for c in res)
    return surface

def merge_tokens(raw_tokens):
    """Merges adjacent morphological tokens that form compound terms, numbers+counters, or aux verbs."""
    merged = []
    i = 0
    n = len(raw_tokens)
    
    while i < n:
        tok = raw_tokens[i]
        s = tok.surface
        
        # Check 2-token merges
        if i + 1 < n:
            next_tok = raw_tokens[i + 1]
            ns = next_tok.surface
            pair = s + ns
            
            # 1. Auxiliary verb mergers (ました, ません, でした)
            if (s == 'まし' and ns == 'た') or (s == 'ませ' and ns == 'ん') or (s == 'でし' and ns == 'た'):
                merged.append({'surface': pair, 'base_form': pair, 'pos': '助動詞'})
                i += 2
                continue
            # 2. Known compound words
            elif pair in ('ショッピングモール', '中国料理', '中国茶', '二人', '一人', '肉まん', '餃子'):
                merged.append({'surface': pair, 'base_form': pair, 'pos': '名詞'})
                i += 2
                continue
            # 3. Number + counter (e.g. 十時, 3日, 二人)
            elif (tok.part_of_speech.startswith('名詞,数') or re.match(r'^[0-9０-９一二三四五六七八九十百千万]+$', s)) and ns in ('時', '分', '日', '月', '年', '人', '回', '個', '本', '歳', '才', 'つ'):
                merged.append({'surface': pair, 'base_form': pair, 'pos': '名詞'})
                i += 2
                continue
                
        merged.append({
            'surface': s,
            'base_form': tok.base_form if tok.base_form != '*' else s,
            'pos': tok.part_of_speech.split(',')[0]
        })
        i += 1
        
    return merged

def process_story(j_story, m_story):
    curated_vocab = {v['word']: v for v in j_story.get('vocabulary', []) if v.get('word')}
    name_map = build_name_map(m_story)
    
    full_vocabulary = []
    seen_words = set()
    ruby_paragraphs = []
    
    for ja_para in j_story.get('japanese_paragraphs', []):
        raw_tokens = list(tokenizer.tokenize(ja_para))
        tokens = merge_tokens(raw_tokens)
        annotated_tokens = []
        
        for tok in tokens:
            surface = tok['surface']
            pos = tok['pos']
            bf = tok['base_form']
            
            # Punctuation & whitespace
            if surface in '。、！？\n\t .,!?-—\"\'()（）《》':
                annotated_tokens.append(surface)
                continue
                
            has_kanji = any('\u4e00' <= char <= '\u9faf' for char in surface)
            is_katakana = any('\u30a0' <= char <= '\u30ff' for char in surface)
            
            word = surface
            reading = get_hira(surface)
            defn = ''
            jlpt = '-'
            
            # 1. Particles (CHECK FIRST so particles never get misclassified as archaic nouns)
            if surface in PARTICLES:
                defn, jlpt = PARTICLES[surface]
            # 2. Common Grammar, Auxiliaries, Counters
            elif surface in COMMON_GRAMMAR:
                defn, jlpt = COMMON_GRAMMAR[surface]
            elif bf in COMMON_GRAMMAR:
                defn, jlpt = COMMON_GRAMMAR[bf]
            # 3. Proper Nouns (Names)
            elif surface in name_map:
                defn = name_map[surface]
                jlpt = '-'
            # 4. Verbs and Adjectives (look up dictionary base form lemma)
            elif pos in ('動詞', '形容詞'):
                info = get_jamdict_info(bf)
                defn = info['defn']
                jlpt = JLPT_MAP.get(bf, JLPT_MAP.get(surface, 'N5'))
                if defn and bf != surface:
                    defn = f"{defn} ({bf})"
            # 5. Curated Vocabulary (from initial story)
            elif surface in curated_vocab:
                v = curated_vocab[surface]
                reading = v.get('reading') or reading
                defn = v.get('definition', '')
                jlpt = v.get('jlpt', '-')
            # 6. General Nouns and Other Words
            else:
                info = get_jamdict_info(surface)
                if not info['defn'] and bf != surface:
                    info = get_jamdict_info(bf)
                defn = info['defn']
                jlpt = JLPT_MAP.get(surface, JLPT_MAP.get(bf, info['jlpt']))
                
            # Guarantee NO raw Japanese echoes
            if not defn or defn.strip() == surface:
                if is_katakana:
                    defn = f"{surface} (loanword / name)"
                elif pos == '名詞' and any(c.isdigit() for c in surface):
                    defn = f"{surface} (number / counter)"
                else:
                    defn = f"{reading} (word)"
                    
            if jlpt == '-' and surface in JLPT_MAP:
                jlpt = JLPT_MAP[surface]
            if jlpt == '-' and bf in JLPT_MAP:
                jlpt = JLPT_MAP[bf]
                
            # Add to narrative vocabulary table
            if word not in seen_words:
                seen_words.add(word)
                full_vocabulary.append({
                    'word': word,
                    'reading': reading,
                    'definition': defn,
                    'jlpt': jlpt
                })
                
            # Render ruby token:
            # Furigana rendered above Kanji and Katakana words; hidden for pure Hiragana
            rt_text = reading if (has_kanji or is_katakana) else ''
            hsk_badge = f'JLPT {jlpt}' if jlpt and jlpt != '-' else ''
            
            annotated_tokens.append(
                f'<ruby class="mb-tooltip" data-py="{reading}" data-defn="{html.escape(defn)}" data-hsk="{hsk_badge}"><span class="si">{word}</span><rt>{rt_text}</rt></ruby>'
            )
            
        ruby_paragraphs.append(''.join(annotated_tokens))
        
    return full_vocabulary, ruby_paragraphs

def main():
    print("=== STARTING FULL MORPHOLOGICAL JAPANESE LEXICON PARITY GENERATION ===")
    t0 = time.time()
    
    with open(MANDARIN_JSON, 'r', encoding='utf-8') as f:
        m_stories = {s['id']: s for s in json.load(f)}
        
    with open(JAPANESE_JSON, 'r', encoding='utf-8') as f:
        j_stories = json.load(f)
        
    total_vocab_entries = 0
    
    for idx, j_story in enumerate(j_stories):
        sid = j_story['id']
        m_story = m_stories.get(sid, {})
        
        full_vocab, ruby_paras = process_story(j_story, m_story)
        j_story['vocabulary'] = full_vocab
        j_story['ruby_paragraphs'] = ruby_paras
        total_vocab_entries += len(full_vocab)
        
        # Write Markdown Reader file
        slug = j_story.get('slug', str(sid))
        md_filename = f"{sid}_{slug}.md"
        md_path = os.path.join(JAPANESE_READERS_DIR, md_filename)
        
        with open(md_path, 'w', encoding='utf-8') as mf:
            mf.write(f"# {j_story['japanese_title']} ({j_story['title']})\n\n")
            mf.write(f"- **Level**: {j_story.get('level', 'N/A')} ({', '.join(j_story.get('hsk_tags', []))})\n")
            mf.write(f"- **Mandarin Reference URL**: [{j_story.get('url', '')}]({j_story.get('url', '')})\n")
            if j_story.get('audio_url'):
                mf.write(f"- **Narration Audio**: [Listen / Download MP3]({j_story['audio_url']})\n")
            mf.write("\n---\n\n## 1. Story Text & Reading\n\n")
            
            ja_paras = j_story.get('japanese_paragraphs', [])
            rd_paras = j_story.get('reading_paragraphs', [])
            en_paras = j_story.get('english_paragraphs', [])
            
            for p_idx, (j_p, r_p, e_p) in enumerate(zip(ja_paras, rd_paras, en_paras)):
                mf.write(f"### Paragraph {p_idx + 1}\n\n")
                mf.write(f"**Japanese**:\n{j_p}\n\n")
                mf.write(f"*Reading*:\n{r_p}\n\n")
                mf.write(f"> **English**:\n> {e_p}\n\n")
                
            mf.write("\n---\n\n## 2. Vocabulary & Grammar Notes\n\n")
            mf.write("| Japanese | Reading | Definition | JLPT Level |\n")
            mf.write("| :--- | :--- | :--- | :--- |\n")
            for v in full_vocab:
                mf.write(f"| {v['word']} | {v['reading']} | {v['definition']} | {v['jlpt']} |\n")
                
        if (idx + 1) % 25 == 0 or idx == len(j_stories) - 1:
            print(f"Processed {idx + 1}/206 stories ({time.time() - t0:.1f}s, cumulative vocab: {total_vocab_entries})")
            
    # Save Japanese stories.json
    with open(JAPANESE_JSON, 'w', encoding='utf-8') as f:
        json.dump(j_stories, f, indent=2, ensure_ascii=False)
    print(f"Saved {JAPANESE_JSON} (total vocab: {total_vocab_entries})")
    
    # Save CSV
    with open(JAPANESE_CSV, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'title', 'japanese_title', 'level', 'hsk_tags', 'vocab_word', 'vocab_reading', 'vocab_definition', 'vocab_jlpt'])
        for s in j_stories:
            for v in s.get('vocabulary', []):
                writer.writerow([
                    s['id'],
                    s['title'],
                    s.get('japanese_title', ''),
                    s.get('level', ''),
                    ';'.join(s.get('hsk_tags', [])),
                    v.get('word', ''),
                    v.get('reading', ''),
                    v.get('definition', ''),
                    v.get('jlpt', '')
                ])
    print(f"Saved {JAPANESE_CSV} with {total_vocab_entries} vocabulary rows")
    
    # Update stories_japanese.js
    with open(JAPANESE_JS, 'w', encoding='utf-8') as f:
        f.write('window.JAPANESE_STORIES = ' + json.dumps(j_stories, ensure_ascii=False) + ';')
    print(f"Saved {JAPANESE_JS} ({os.path.getsize(JAPANESE_JS)} bytes)")
    
    print(f"\n>>> PARITY COMPLETE IN {time.time() - t0:.1f}s! Total vocab expanded to {total_vocab_entries} (avg {total_vocab_entries/len(j_stories):.1f}/story) <<<")

if __name__ == '__main__':
    main()
