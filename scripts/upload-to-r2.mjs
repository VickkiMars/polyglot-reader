import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Helper to load .env / .env.local without external dependencies
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch (e) {
    console.debug("Could not read env file:", filePath, e.message);
  }
}

// Load env files from current directory
loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

function getEnvCaseInsensitive(name) {
  const target = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [k, v] of Object.entries(process.env)) {
    if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === target) {
      return v;
    }
  }
  return undefined;
}

// 1. Load credentials from environment or .env with all common aliases
const accountId =
  getEnvCaseInsensitive("CLOUDFLARE_ACCOUNT_ID") ||
  getEnvCaseInsensitive("R2_ACCOUNT_ID") ||
  getEnvCaseInsensitive("ACCOUNT_ID");

const accessKeyId =
  getEnvCaseInsensitive("R2_ACCESS_KEY_ID") ||
  getEnvCaseInsensitive("AWS_ACCESS_KEY_ID") ||
  getEnvCaseInsensitive("ACCESS_KEY_ID");

const secretAccessKey =
  getEnvCaseInsensitive("R2_SECRET_ACCESS_KEY") ||
  getEnvCaseInsensitive("R2_SECRET_ACCESs_KEY") ||
  getEnvCaseInsensitive("AWS_SECRET_ACCESS_KEY") ||
  getEnvCaseInsensitive("SECRET_ACCESS_KEY");

const bucketName =
  getEnvCaseInsensitive("R2_BUCKET_NAME") ||
  getEnvCaseInsensitive("BUCKET_NAME") ||
  "polyglot-audio";

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error("\n❌ Missing required Cloudflare R2 credentials.");
  console.error("Found env variables:", Object.keys(process.env).filter(k => k.includes("R2") || k.includes("ACCOUNT") || k.includes("SECRET") || k.includes("KEY") || k.includes("CLOUDFLARE")));
  console.error("Please ensure the following are provided:");
  console.error("  CLOUDFLARE_ACCOUNT_ID / R2_ACCOUNT_ID");
  console.error("  R2_ACCESS_KEY_ID / ACCESS_KEY_ID");
  console.error("  R2_SECRET_ACCESS_KEY / SECRET_ACCESS_KEY");
  console.error("  R2_BUCKET_NAME (defaults to polyglot-audio)\n");
  process.exit(1);
}

// 2. Initialize S3 client configured for Cloudflare R2
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

function findAudioDir(lang) {
  const candidates = [
    path.resolve(process.cwd(), `../language/${lang}/audio`),
    path.resolve(process.cwd(), `../${lang}/audio`),
    path.resolve(process.cwd(), `public/audio/${lang}`),
    `/home/kami/Desktop/codebase/language/${lang}/audio`,
    `/codebase/language/${lang}/audio`,
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

async function collectFiles() {
  const queue = [];

  const mandarinDir = findAudioDir("mandarin");
  const japaneseDir = findAudioDir("japanese");

  console.log(`Mandarin audio directory: ${mandarinDir || "NOT FOUND"}`);
  console.log(`Japanese audio directory: ${japaneseDir || "NOT FOUND"}`);

  if (mandarinDir && fs.existsSync(mandarinDir)) {
    const files = fs.readdirSync(mandarinDir).filter((f) => f.endsWith(".mp3"));
    for (const file of files) {
      queue.push({
        localPath: path.join(mandarinDir, file),
        key: `audio/mandarin/${file}`,
      });
    }
  }

  if (japaneseDir && fs.existsSync(japaneseDir)) {
    const files = fs.readdirSync(japaneseDir).filter((f) => f.endsWith(".mp3"));
    for (const file of files) {
      queue.push({
        localPath: path.join(japaneseDir, file),
        key: `audio/japanese/${file}`,
      });
    }
  }

  return queue;
}

async function uploadFile(item, index, total) {
  const fileBuffer = fs.readFileSync(item.localPath);
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: item.key,
    Body: fileBuffer,
    ContentType: "audio/mpeg",
  });

  await s3.send(command);
  console.log(`[${index + 1}/${total}] ✓ Uploaded: ${item.key}`);
}

async function main() {
  console.log(`\n🚀 Uploading audio to Cloudflare R2 bucket: "${bucketName}" (endpoint: https://${accountId}.r2.cloudflarestorage.com)...`);
  const files = await collectFiles();
  console.log(`Found ${files.length} total audio files to upload.\n`);

  if (files.length === 0) {
    console.error("❌ No audio files found to upload.");
    process.exit(1);
  }

  const CONCURRENCY = 12;
  let cursor = 0;
  let completed = 0;
  let failed = 0;

  async function worker() {
    while (cursor < files.length) {
      const idx = cursor++;
      const item = files[idx];
      try {
        await uploadFile(item, idx, files.length);
        completed++;
      } catch (err) {
        console.error(`❌ Failed to upload ${item.key}:`, err.message);
        failed++;
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log(`\n🎉 Upload completed!`);
  console.log(`  ✓ Successfully uploaded: ${completed}`);
  if (failed > 0) {
    console.log(`  ⚠ Failed: ${failed}`);
  }
  console.log(`\nNext step: ensure your bucket has Public Access enabled, then set NEXT_PUBLIC_AUDIO_BASE_URL to your public R2 URL!\n`);
}

main().catch(console.error);
