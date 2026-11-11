import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import boto3

ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID", "ab0fea9bd74c71a790c7d033659bf991")
ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "72cba76512577416a07d55ba1aca5fa1")
SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "6421a7c30c38cb1c4752d79a700f419c1440d4efe63cc64508f27fa1946d0a39")
BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "polyglot-audio")

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=f'https://{ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=ACCESS_KEY_ID,
        aws_secret_access_key=SECRET_ACCESS_KEY,
        region_name='auto'
    )

def upload_single_file(item):
    local_path, r2_key = item
    s3 = get_s3_client()
    for attempt in range(3):
        try:
            s3.upload_file(
                local_path,
                BUCKET_NAME,
                r2_key,
                ExtraArgs={'ContentType': 'audio/mpeg'}
            )
            return True, r2_key, None
        except Exception as e:
            if attempt == 2:
                return False, r2_key, str(e)
            time.sleep(1.0)
    return False, r2_key, "Unknown"

def main():
    audio_dir = "/home/kami/Desktop/codebase/language/japanese/audio"
    if not os.path.exists(audio_dir):
        audio_dir = os.path.abspath("public/audio/japanese")
    
    mp3_files = [f for f in os.listdir(audio_dir) if f.endswith(".mp3")]
    print(f"[*] Found {len(mp3_files)} Japanese audio files to upload to Cloudflare R2 bucket '{BUCKET_NAME}'...")
    
    items = [(os.path.join(audio_dir, f), f"audio/japanese/{f}") for f in mp3_files]
    
    t0 = time.time()
    completed = 0
    failed = 0
    total = len(items)
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(upload_single_file, it): it for it in items}
        for future in as_completed(futures):
            ok, key, err = future.result()
            if ok:
                completed += 1
                if completed % 25 == 0 or completed == total:
                    print(f"[{completed}/{total}] Uploaded to R2 ({time.time() - t0:.1f}s)...")
            else:
                failed += 1
                print(f"[-] Failed to upload {key}: {err}")
                
    print(f"\n[+] R2 Upload Complete: {completed}/{total} uploaded successfully in {time.time() - t0:.1f}s (Failed: {failed})")

if __name__ == "__main__":
    main()
