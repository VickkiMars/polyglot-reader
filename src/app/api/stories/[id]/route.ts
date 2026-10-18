import { NextRequest, NextResponse } from "next/server";
import mandarinStoriesMap from "@/data/mandarin_details.json";
import japaneseStoriesMap from "@/data/japanese_details.json";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const lang = searchParams.get("lang") || "mandarin";

  const map = lang === "japanese" ? (japaneseStoriesMap as Record<string, any>) : (mandarinStoriesMap as Record<string, any>);
  const story = map[id];

  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  return NextResponse.json(story, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
    },
  });
}
