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

export interface PlayChunk {
  id: string;
  chunk_index: number;
  type: "dialogue" | "stage_direction";
  speaker: string;
  speaker_en: string;
  direction_ja: string;
  direction_en: string;
  text_ja: string;
  text_en: string;
  ruby: string;
  start: number;
  end: number;
  duration: number;
}

export interface PlayScene {
  id: number;
  scene_number: number;
  title_ja: string;
  title_en: string;
  description_ja: string;
  description_en: string;
  audio_url: string;
  duration: number;
  chunk_count: number;
  dialogue_count: number;
  chunks: PlayChunk[];
}

export interface PlayCharacter {
  name_ja: string;
  name_en: string;
  role_description: string;
  voice: string;
  gender: string;
}

export interface PlayMetadata {
  id: string;
  title_ja: string;
  title_en: string;
  author_ja: string;
  author_en: string;
  year: number;
  jlpt_level: string;
  category: string;
  characters: PlayCharacter[];
  setting: {
    time_ja: string;
    time_en: string;
    place_ja: string;
    place_en: string;
  };
  synopsis_en: string;
  synopsis_ja: string;
  total_scenes: number;
  total_lines: number;
  scenes: PlayScene[];
}

export interface PlayCatalogItem {
  id: string;
  title_ja: string;
  title_en: string;
  author_ja: string;
  author_en: string;
  year: number;
  jlpt_level: string;
  scene_count: number;
  total_chunks: number;
  total_duration: number;
  cover_image: string;
  summary: string;
}

