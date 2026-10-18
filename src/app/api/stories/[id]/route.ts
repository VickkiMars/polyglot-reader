import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Cache in memory for instant responses
let mandarinStoriesCache: any[] | null = null;
let japaneseStoriesCache: any[] | null = null;

function getMandarinStories() {
  if (!mandarinStoriesCache) {
    const filePath = path.join(process.cwd(), "data", "mandarinbean_stories", "stories.json");
    if (fs.existsSync(filePath)) {
      mandarinStoriesCache = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } else {
      mandarinStoriesCache = [];
    }
  }
  return mandarinStoriesCache;
}

function getJapaneseStories() {
  if (!japaneseStoriesCache) {
    const filePath = path.join(process.cwd(), "data", "japanese_stories", "stories.json");
    if (fs.existsSync(filePath)) {
      japaneseStoriesCache = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } else {
      japaneseStoriesCache = [];
    }
  }
  return japaneseStoriesCache;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  const searchParams = request.nextUrl.searchParams;
  const lang = searchParams.get("lang") || "mandarin";

  if (lang === "japanese") {
    const jStories = getJapaneseStories();
    const story = jStories?.find((s: any) => s.id === numId);
    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: story.id,
      title: story.title,
      japanese_title: story.japanese_title || story.title,
      level: story.level,
      hsk_tags: story.hsk_tags,
      slug: story.slug,
      audio_url: `/audio/japanese/${story.id}_${(story.slug || String(story.id)).split("%")[0].replace(/-+$/, "")}.mp3`,
      english_paragraphs: story.english_paragraphs || [],
      english_full: story.english_full || "",
      japanese_paragraphs: story.japanese_paragraphs || [],
      reading_paragraphs: story.reading_paragraphs || [],
      ruby_paragraphs: story.ruby_paragraphs || [],
      vocabulary: story.vocabulary || [],
    });
  } else {
    const mStories = getMandarinStories();
    const story = mStories?.find((s: any) => s.id === numId);
    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: story.id,
      title: story.title,
      level: story.level,
      hsk_tags: story.hsk_tags,
      slug: story.slug,
      audio_url: `/audio/mandarin/${story.id}_${(story.slug || String(story.id)).split("%")[0].replace(/-+$/, "")}.mp3`,
      simplified_paragraphs: story.simplified_paragraphs || [],
      traditional_paragraphs: story.traditional_paragraphs || [],
      pinyin_paragraphs: story.pinyin_paragraphs || [],
      english_paragraphs: story.english_paragraphs || [],
      english_full: story.english_full || "",
      vocabulary: story.vocabulary || [],
    });
  }
}
