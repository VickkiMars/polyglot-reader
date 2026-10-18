import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

import audioSizesData from "@/data/audio_sizes.json";

export interface AudioManifestItem {
  id: number;
  title: string;
  slug: string;
  url: string;
  filename: string;
  size: number;
}

export interface TextManifestItem {
  id: number;
  title: string;
  url: string;
  size: number;
}

export interface LanguageManifest {
  language: "mandarin" | "japanese";
  languageLabel: string;
  totalStories: number;
  audio: {
    totalFiles: number;
    totalBytes: number;
    totalFormatted: string;
    totalBytesExact: string;
    files: AudioManifestItem[];
  };
  text: {
    totalFiles: number;
    totalBytes: number;
    totalFormatted: string;
    totalBytesExact: string;
    files: TextManifestItem[];
  };
  combined: {
    totalFiles: number;
    totalBytes: number;
    totalFormatted: string;
    totalBytesExact: string;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const mib = bytes / (1024 * 1024);
  return `${mib.toFixed(2)} MB`;
}

// Memory cache for instant response
const manifestCache: Record<string, LanguageManifest> = {};

function buildManifest(lang: "mandarin" | "japanese"): LanguageManifest {
  if (manifestCache[lang]) {
    return manifestCache[lang];
  }

  const catalogPath = path.join(process.cwd(), "src", "data", "all_stories.json");
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8")) as any[];

  const audioBaseUrl = process.env.NEXT_PUBLIC_AUDIO_BASE_URL?.replace(/\/$/, "") || "";
  const audioSizesMap = (audioSizesData as Record<string, Record<string, number>>)[lang] || {};

  const audioFiles: AudioManifestItem[] = [];
  let totalAudioBytes = 0;

  for (const story of catalog) {
    const rawAudioPath = story.audio[lang] as string;
    const filename = path.basename(rawAudioPath);
    const audioUrl = audioBaseUrl ? `${audioBaseUrl}${rawAudioPath}` : rawAudioPath;

    const size = audioSizesMap[filename] || 280000;

    totalAudioBytes += size;
    audioFiles.push({
      id: story.id,
      title: lang === "japanese" ? (story.japanese?.title || story.title) : story.title,
      slug: story.slug || String(story.id),
      url: audioUrl,
      filename,
      size,
    });
  }

  // Pre-calculate story text API sizes
  const storyJsonPath = lang === "japanese"
    ? path.join(process.cwd(), "data", "japanese_stories", "stories.json")
    : path.join(process.cwd(), "data", "mandarin_stories", "stories.json");

  const storiesData = fs.existsSync(storyJsonPath)
    ? JSON.parse(fs.readFileSync(storyJsonPath, "utf-8"))
    : [];

  const textFiles: TextManifestItem[] = [];
  let totalTextBytes = 0;

  for (const s of storiesData) {
    const url = `/api/stories/${s.id}?lang=${lang}`;
    // Approximate JSON serialized size for this story detail
    const samplePayload = lang === "japanese" ? {
      id: s.id,
      title: s.title,
      japanese_title: s.japanese_title || s.title,
      level: s.level,
      hsk_tags: s.hsk_tags,
      slug: s.slug,
      audio_url: `/audio/japanese/${s.id}_${(s.slug || String(s.id)).split("%")[0].replace(/-+$/, "")}.mp3`,
      english_paragraphs: s.english_paragraphs || [],
      english_full: s.english_full || "",
      japanese_paragraphs: s.japanese_paragraphs || [],
      reading_paragraphs: s.reading_paragraphs || [],
      ruby_paragraphs: s.ruby_paragraphs || [],
      vocabulary: s.vocabulary || [],
    } : {
      id: s.id,
      title: s.title,
      level: s.level,
      hsk_tags: s.hsk_tags,
      slug: s.slug,
      audio_url: `/audio/mandarin/${s.id}_${(s.slug || String(s.id)).split("%")[0].replace(/-+$/, "")}.mp3`,
      simplified_paragraphs: s.simplified_paragraphs || [],
      traditional_paragraphs: s.traditional_paragraphs || [],
      pinyin_paragraphs: s.pinyin_paragraphs || [],
      english_paragraphs: s.english_paragraphs || [],
      english_full: s.english_full || "",
      vocabulary: s.vocabulary || [],
    };

    const size = Buffer.byteLength(JSON.stringify(samplePayload), "utf-8");
    totalTextBytes += size;

    textFiles.push({
      id: s.id,
      title: lang === "japanese" ? (s.japanese_title || s.title) : s.title,
      url,
      size,
    });
  }

  const manifest: LanguageManifest = {
    language: lang,
    languageLabel: lang === "japanese" ? "Japanese (JLPT)" : "Mandarin Chinese (HSK)",
    totalStories: catalog.length,
    audio: {
      totalFiles: audioFiles.length,
      totalBytes: totalAudioBytes,
      totalFormatted: formatBytes(totalAudioBytes),
      totalBytesExact: `${totalAudioBytes.toLocaleString()} bytes`,
      files: audioFiles,
    },
    text: {
      totalFiles: textFiles.length,
      totalBytes: totalTextBytes,
      totalFormatted: formatBytes(totalTextBytes),
      totalBytesExact: `${totalTextBytes.toLocaleString()} bytes`,
      files: textFiles,
    },
    combined: {
      totalFiles: audioFiles.length + textFiles.length,
      totalBytes: totalAudioBytes + totalTextBytes,
      totalFormatted: formatBytes(totalAudioBytes + totalTextBytes),
      totalBytesExact: `${(totalAudioBytes + totalTextBytes).toLocaleString()} bytes`,
    },
  };

  manifestCache[lang] = manifest;
  return manifest;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const langParam = searchParams.get("lang") || "mandarin";
  const lang = langParam === "japanese" ? "japanese" : "mandarin";

  const manifest = buildManifest(lang);
  return NextResponse.json(manifest);
}
