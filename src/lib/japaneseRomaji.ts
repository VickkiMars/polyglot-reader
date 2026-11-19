/**
 * Japanese Kana to Hepburn Romaji Converter
 * High-precision transliteration for Japanese ruby annotations and vocabulary display.
 */

const KANA_MAP: Record<string, string> = {
  // Hiragana Single Vowels & Consonants
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
  'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  'わ': 'wa', 'を': 'o', 'ん': 'n',

  // Voiced & Semi-voiced (Dakuten / Handakuten)
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',

  // Digraphs (Yōon)
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'ぢゃ': 'ja', 'ぢゅ': 'ju', 'ぢょ': 'jo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',

  // Modern Katakana-derived loanword sound combinations
  'うぇ': 'we', 'うぃ': 'wi', 'うぉ': 'wo',
  'しぇ': 'she', 'じぇ': 'je', 'ちぇ': 'che',
  'てぃ': 'ti', 'でぃ': 'di', 'とぅ': 'tu', 'どぅ': 'du',
  'ふぁ': 'fa', 'ふぃ': 'fi', 'ふぇ': 'fe', 'ふぉ': 'fo',
  'ゔ': 'vu', 'ゔぁ': 'va', 'ゔぃ': 'vi', 'ゔぇ': 've', 'ゔぉ': 'vo'
};

/**
 * Converts Katakana to Hiragana string for unified phonetic processing.
 */
export function katakanaToHiragana(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x30a1 && code <= 0x30f6) {
      result += String.fromCharCode(code - 0x60);
    } else {
      result += text[i];
    }
  }
  return result;
}

/**
 * Converts Japanese Kana to Hepburn Romaji, considering grammatical particle contexts and names.
 */
export function kanaToRomaji(kana: string, defn: string = '', word: string = ''): string {
  if (!kana) return '';

  const cleanDefn = (defn || '').toLowerCase();
  const cleanWord = word || '';

  // Contextual particle overrides
  if (cleanWord === 'は' && (cleanDefn.includes('topic marker') || cleanDefn.includes('particle'))) {
    return 'wa';
  }
  if (cleanWord === 'へ' && (cleanDefn.includes('direction marker') || cleanDefn.includes('particle'))) {
    return 'e';
  }
  if (cleanWord === 'を' && (cleanDefn.includes('object marker') || cleanDefn.includes('particle'))) {
    return 'o';
  }

  // Proper names handling
  if (cleanDefn.includes('david (name)') || cleanWord === 'ダーウェイ') {
    return 'Dawei';
  }
  if (cleanDefn.includes('martin (name)') || cleanWord === 'マーティン') {
    return 'Martin';
  }

  const hira = katakanaToHiragana(kana);
  let res = '';
  let i = 0;

  while (i < hira.length) {
    // 1. Two-character combination (Digraphs like きゃ, しょ, うぇ)
    if (i + 1 < hira.length && KANA_MAP[hira.slice(i, i + 2)]) {
      res += KANA_MAP[hira.slice(i, i + 2)];
      i += 2;
    }
    // 2. Sokuon (Small tsu: っ) -> doubles following consonant
    else if (hira[i] === 'っ') {
      const nextTwo = hira.slice(i + 1, i + 3);
      const nextOne = hira.slice(i + 1, i + 2);
      const nextRomaji = KANA_MAP[nextTwo] || KANA_MAP[nextOne] || '';
      if (nextRomaji) {
        // 'ch' becomes 'tch' in standard Hepburn (e.g., matcha)
        res += nextRomaji.startsWith('ch') ? 't' : nextRomaji[0];
      }
      i++;
    }
    // 3. Chōonpu (Long vowel mark: ー)
    else if (hira[i] === 'ー') {
      const lastChar = res[res.length - 1];
      if (lastChar && 'aeiou'.includes(lastChar)) {
        res += lastChar;
      }
      i++;
    }
    // 4. Single Kana character
    else if (KANA_MAP[hira[i]]) {
      res += KANA_MAP[hira[i]];
      i++;
    }
    // 5. Pass-through for punctuation, latin characters, or unrecognized characters
    else {
      res += hira[i];
      i++;
    }
  }

  return res;
}

/**
 * Transforms Japanese ruby paragraph HTML to replace <rt> furigana with Romaji.
 * Works seamlessly with existing data-py, data-defn, and data-romaji attributes.
 */
export function convertRubyHtmlToRomaji(html: string): string {
  if (!html) return '';

  return html.replace(/<ruby\b([^>]*)>([\s\S]*?)<\/ruby>/g, (_match, attrs, inner) => {
    // Check if pre-existing data-romaji is already set
    const dataRomajiMatch = attrs.match(/data-romaji="([^"]*)"/);
    if (dataRomajiMatch && dataRomajiMatch[1]) {
      const romaji = dataRomajiMatch[1];
      return `<ruby${attrs}>${inner.replace(/<rt>[\s\S]*?<\/rt>/, `<rt>${romaji}</rt>`)}</ruby>`;
    }

    const pyMatch = attrs.match(/data-py="([^"]*)"/);
    const defnMatch = attrs.match(/data-defn="([^"]*)"/);
    const wordMatch = inner.match(/<span class="si">([\s\S]*?)<\/span>/);

    const py = pyMatch ? pyMatch[1] : '';
    const defn = defnMatch ? defnMatch[1] : '';
    const word = wordMatch ? wordMatch[1] : '';

    const romaji = kanaToRomaji(py || word, defn, word);
    return `<ruby${attrs}>${inner.replace(/<rt>[\s\S]*?<\/rt>/, `<rt>${romaji}</rt>`)}</ruby>`;
  });
}
