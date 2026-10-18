export interface StoryCatalogItem {
  id: number;
  title: string;
  slug: string;
  url: string;
  level: string;
  hsk: string;
  hsk_tags: string[];
  jlpt: string;
  categories: string[];
  tags: string[];
  image: string;
  audio: {
    mandarin: string;
    japanese: string;
  };
  mandarin: {
    character_preview: string;
    pinyin_preview: string;
    vocab_count: number;
    para_count: number;
  };
  japanese: {
    title: string;
    character_preview: string;
    reading_preview: string;
    vocab_count: number;
    para_count: number;
  };
}

export interface VocabularyItem {
  word: string;
  pinyin?: string;
  reading?: string;
  translation: string;
  hsk?: string;
  jlpt?: string;
}

export interface StoryDetail {
  id: number;
  title: string;
  japanese_title?: string;
  level: string;
  hsk_tags: string[];
  slug: string;
  audio_url: string;
  english_paragraphs: string[];
  english_full: string;
  simplified_paragraphs?: string[];
  traditional_paragraphs?: string[];
  pinyin_paragraphs?: string[];
  japanese_paragraphs?: string[];
  reading_paragraphs?: string[];
  ruby_paragraphs?: string[];
  vocabulary: VocabularyItem[];
}

export interface FilterState {
  search: string;
  level: string;
  language: "mandarin" | "japanese";
  selectedHsk: string[];
  selectedJlpt: string[];
  audioOnly: boolean;
}
