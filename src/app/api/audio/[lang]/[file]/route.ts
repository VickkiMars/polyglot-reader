import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

// Initialize S3 client for Cloudflare R2 bucket fallback
const accountId =
  process.env.CLOUDFLARE_ACCOUNT_ID ||
  process.env.R2_ACCOUNT_ID ||
  "ab0fea9bd74c71a790c7d033659bf991";

const accessKeyId =
  process.env.R2_ACCESS_KEY_ID ||
  process.env.AWS_ACCESS_KEY_ID ||
  "72cba76512577416a07d55ba1aca5fa1";

const secretAccessKey =
  process.env.R2_SECRET_ACCESS_KEY ||
  process.env.R2_SECRET_ACCESs_KEY ||
  process.env.AWS_SECRET_ACCESS_KEY ||
  "6421a7c30c38cb1c4752d79a700f419c1440d4efe63cc64508f27fa1946d0a39";

const bucketName = process.env.R2_BUCKET_NAME || "polyglot-audio";

let s3Client: S3Client | null = null;
if (accountId && accessKeyId && secretAccessKey) {
  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function findLocalAudioFile(lang: string, filename: string): string | null {
  const candidates = [
    path.join(process.cwd(), "public", "audio", lang, filename),
    path.join(process.cwd(), "..", "language", lang, "audio", filename),
    path.join("/home/kami/Desktop/codebase/language", lang, "audio", filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
      try {
        const stats = fs.statSync(/*turbopackIgnore: true*/ candidate);
        if (stats.isFile() && stats.size > 0) {
          return candidate;
        }
      } catch (e) {
        // Continue to next candidate
      }
    }
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lang: string; file: string }> }
) {
  const { lang, file } = await params;

  if (lang !== "mandarin" && lang !== "japanese") {
    return new NextResponse("Unsupported language", { status: 400 });
  }

  // Prevent directory traversal
  const filename = path.basename(file);
  if (!filename.endsWith(".mp3")) {
    return new NextResponse("Invalid file type", { status: 400 });
  }

  const range = request.headers.get("range");

  // 1. Try local filesystem first for lightning fast zero-network response
  const localPath = findLocalAudioFile(lang, filename);
  if (localPath) {
    const stats = fs.statSync(/*turbopackIgnore: true*/ localPath);
    const fileSize = stats.size;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse("Requested range not satisfiable", {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(/*turbopackIgnore: true*/ localPath, { start, end });
      const webStream = Readable.toWeb(fileStream);

      return new NextResponse(webStream as unknown as BodyInit, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const fileStream = fs.createReadStream(/*turbopackIgnore: true*/ localPath);
    const webStream = Readable.toWeb(fileStream);

    return new NextResponse(webStream as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // 2. Fetch from Cloudflare R2 bucket via official S3 client (avoids rate-limited public r2.dev domain)
  if (s3Client) {
    try {
      const s3Key = `audio/${lang}/${filename}`;
      const cmd = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Range: range || undefined,
      });

      const s3Res = await s3Client.send(cmd);
      const webStream = (s3Res.Body as any)?.transformToWebStream();

      if (webStream) {
        const headers: Record<string, string> = {
          "Content-Type": s3Res.ContentType || "audio/mpeg",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        };

        if (s3Res.ContentLength) {
          headers["Content-Length"] = String(s3Res.ContentLength);
        }
        if (s3Res.ContentRange) {
          headers["Content-Range"] = s3Res.ContentRange;
        }

        const statusCode = range && s3Res.ContentRange ? 206 : 200;
        return new NextResponse(webStream as unknown as BodyInit, {
          status: statusCode,
          headers,
        });
      }
    } catch (s3Error: any) {
      console.warn(`S3 fallback failed for ${lang}/${filename}:`, s3Error.message);
    }
  }

  // 3. Last-ditch fallback: public CDN URL
  const publicBase = process.env.PUBLIC_DEVELOPMENT_URL?.replace(/\/$/, "");
  if (publicBase) {
    try {
      const publicUrl = `${publicBase}/audio/${lang}/${filename}`;
      const extRes = await fetch(publicUrl, {
        headers: range ? { Range: range } : undefined,
      });
      if (extRes.ok && extRes.body) {
        const headers: Record<string, string> = {
          "Content-Type": extRes.headers.get("Content-Type") || "audio/mpeg",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        };
        const cl = extRes.headers.get("Content-Length");
        if (cl) headers["Content-Length"] = cl;
        const cr = extRes.headers.get("Content-Range");
        if (cr) headers["Content-Range"] = cr;

        return new NextResponse(extRes.body as unknown as BodyInit, {
          status: extRes.status,
          headers,
        });
      }
    } catch (e) {
      // Ignored
    }
  }

  return new NextResponse("Audio file not found", { status: 404 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ lang: string; file: string }> }
) {
  const getRes = await GET(request, context);
  return new NextResponse(null, {
    status: getRes.status,
    headers: getRes.headers,
  });
}
