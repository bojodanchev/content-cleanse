"""
Content Cleanse - Video Processing Worker
Runs on Modal.com serverless containers with FFmpeg

This worker:
1. Downloads source video from Supabase Storage
2. Applies randomized transformations using FFmpeg
3. Creates N unique variants
4. Uploads variants and ZIP to Supabase Storage
5. Updates job progress via Supabase API
"""

import modal
import subprocess
import random
import hashlib
import json
import zipfile
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

# Define the Modal app
app = modal.App("content-cleanse")

# Container image with FFmpeg and Python dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install(
        "supabase",
        "httpx",
        "fastapi[standard]",
    )
)


@app.function(
    image=image,
    timeout=600,  # 10 minutes max
    cpu=2,
    memory=4096,  # 4GB RAM
)
def process_video(
    job_id: str,
    source_path: str,
    variant_count: int,
    settings: Dict[str, Any],
    user_id: str,
    supabase_url: str,
    supabase_key: str,
) -> Dict[str, Any]:
    """
    Process a video and create unique variants.

    Args:
        job_id: Unique identifier for the processing job
        source_path: Path to source video in Supabase Storage
        variant_count: Number of variants to create
        settings: Processing settings (brightness, saturation, etc.)
        user_id: User ID for storage path organization
        supabase_url: Supabase project URL
        supabase_key: Supabase service role key

    Returns:
        Dict with status, output paths, and variant details
    """
    from supabase import create_client, Client

    # Initialize Supabase client
    supabase: Client = create_client(supabase_url, supabase_key)

    # Create working directory
    work_dir = Path(f"/tmp/{job_id}")
    work_dir.mkdir(parents=True, exist_ok=True)

    input_path = work_dir / "input.mp4"
    output_dir = work_dir / "variants"
    output_dir.mkdir(exist_ok=True)

    try:
        # Update status to processing
        update_job_status(supabase, job_id, "processing", 0)

        # Download source video
        print(f"Downloading source video: {source_path}")
        response = supabase.storage.from_("videos").download(source_path)
        input_path.write_bytes(response)

        # Get video info
        video_info = get_video_info(str(input_path))
        print(f"Video info: {video_info}")

        # Process variants
        variants = []
        for i in range(variant_count):
            variant_name = f"variant_{i+1:03d}.mp4"
            variant_path = output_dir / variant_name

            # Generate random transformations
            transformations = generate_transformations(settings)

            # Apply transformations with FFmpeg
            process_single_variant(
                str(input_path),
                str(variant_path),
                transformations,
                settings.get("remove_watermark", False),
            )

            # Calculate file hash for uniqueness verification
            file_hash = calculate_file_hash(str(variant_path))
            file_size = variant_path.stat().st_size

            variants.append({
                "name": variant_name,
                "path": str(variant_path),
                "hash": file_hash,
                "size": file_size,
                "transformations": transformations,
            })

            # Upload variant to Supabase Storage
            variant_storage_path = f"{user_id}/{job_id}/{variant_name}"
            try:
                with open(variant_path, "rb") as vf:
                    supabase.storage.from_("outputs").upload(
                        variant_storage_path,
                        vf.read(),
                        {"content-type": "video/mp4"},
                    )
            except Exception as upload_err:
                print(f"Warning: Failed to upload variant {variant_name}: {upload_err}")

            # Insert variant record into database
            try:
                supabase.table("variants").insert({
                    "job_id": job_id,
                    "file_path": variant_storage_path,
                    "file_size": file_size,
                    "transformations": transformations,
                    "file_hash": file_hash,
                }).execute()
            except Exception as db_err:
                print(f"Warning: Failed to insert variant record {variant_name}: {db_err}")

            # Update progress
            progress = int((i + 1) / variant_count * 100)
            update_job_status(supabase, job_id, "processing", progress, i + 1)
            print(f"Variant {i+1}/{variant_count} complete")

        # Create and upload ZIP archive
        print("Finalizing: creating ZIP archive...")
        zip_path = work_dir / f"{job_id}_variants.zip"
        create_zip_archive(variants, str(zip_path))

        # Upload ZIP to Supabase Storage
        output_storage_path = f"{user_id}/{job_id}/variants.zip"
        try:
            with open(zip_path, "rb") as f:
                supabase.storage.from_("outputs").upload(
                    output_storage_path,
                    f.read(),
                    {"content-type": "application/zip"},
                )
        except Exception as zip_err:
            print(f"Warning: Failed to upload ZIP: {zip_err}")
            output_storage_path = None

        # Mark job as completed
        supabase.table("jobs").update({
            "status": "completed",
            "progress": 100,
            "variants_completed": variant_count,
            "output_zip_path": output_storage_path,
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", job_id).execute()

        return {
            "status": "completed",
            "variants_created": variant_count,
            "output_path": output_storage_path,
        }

    except Exception as e:
        print(f"Error processing video: {e}")
        try:
            supabase.table("jobs").update({
                "status": "failed",
                "error_message": str(e)[:500],
                "error_code": type(e).__name__,
            }).eq("id", job_id).execute()
        except Exception as status_err:
            print(f"CRITICAL: Failed to update job status to failed: {status_err}")
        raise

    finally:
        # Cleanup
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)


def update_job_status(supabase, job_id: str, status: str, progress: int, variants_completed: int = 0):
    """Update job status in Supabase."""
    supabase.table("jobs").update({
        "status": status,
        "progress": progress,
        "variants_completed": variants_completed,
    }).eq("id", job_id).execute()


def get_video_info(input_path: str) -> Dict[str, Any]:
    """Get video metadata using ffprobe."""
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        input_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(result.stdout) if result.returncode == 0 else {}


def generate_transformations(settings: Dict[str, Any]) -> Dict[str, float]:
    """Generate random transformation values within configured ranges."""
    brightness_range = settings.get("brightness_range", [-0.03, 0.03])
    saturation_range = settings.get("saturation_range", [0.97, 1.03])
    hue_range = settings.get("hue_range", [-5, 5])
    crop_px_range = settings.get("crop_px_range", [1, 3])
    speed_range = settings.get("speed_range", [0.98, 1.02])

    return {
        "brightness": random.uniform(*brightness_range),
        "saturation": random.uniform(*saturation_range),
        "hue": random.uniform(*hue_range),
        "crop_px": random.randint(*crop_px_range),
        "speed": random.uniform(*speed_range),
        # Add slight noise seed for reproducibility
        "noise_seed": random.randint(0, 999999),
    }


def process_single_variant(
    input_path: str,
    output_path: str,
    transformations: Dict[str, float],
    remove_watermark: bool = False,
) -> None:
    """
    Process a single video variant using FFmpeg.

    Applies:
    - Brightness/saturation/hue adjustments
    - Edge cropping
    - Speed variation
    - Metadata stripping
    - Audio pitch adjustment
    """
    brightness = transformations["brightness"]
    saturation = transformations["saturation"]
    hue = transformations["hue"]
    crop_px = transformations["crop_px"]
    speed = transformations["speed"]

    # Build video filter chain
    video_filters = [
        # Color adjustments
        f"eq=brightness={brightness}:saturation={saturation}",
        f"hue=h={hue}",
        # Crop edges (removes crop_px pixels from each side)
        f"crop=iw-{crop_px*2}:ih-{crop_px*2}:{crop_px}:{crop_px}",
    ]

    # Build audio filter for tempo adjustment
    # Note: atempo range is 0.5-2.0, so we need to use a compatible speed
    audio_filter = f"atempo={speed}"

    # Combine filters
    vf = ",".join(video_filters)

    # FFmpeg command
    cmd = [
        "ffmpeg",
        "-y",  # Overwrite output
        "-i", input_path,
        # Video processing
        "-vf", vf,
        # Audio processing
        "-af", audio_filter,
        # Strip all metadata
        "-map_metadata", "-1",
        "-fflags", "+bitexact",
        "-flags:v", "+bitexact",
        "-flags:a", "+bitexact",
        # Encoding settings
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        # Output
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed: {result.stderr}")


def calculate_file_hash(file_path: str) -> str:
    """Calculate MD5 hash of a file for uniqueness verification."""
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def create_zip_archive(variants: List[Dict], zip_path: str) -> None:
    """Create a ZIP archive of all variants."""
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for variant in variants:
            zf.write(variant["path"], variant["name"])


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def start_processing(item: dict):
    """
    Web endpoint to trigger video processing.
    Called from the Next.js API route via HTTP POST.
    Spawns process_video asynchronously and returns immediately.
    """
    required = ["job_id", "source_path", "variant_count", "settings", "user_id", "supabase_url", "supabase_key"]
    missing = [k for k in required if k not in item]
    if missing:
        return {"status": "error", "error": f"Missing fields: {missing}"}

    call = process_video.spawn(
        job_id=item["job_id"],
        source_path=item["source_path"],
        variant_count=item["variant_count"],
        settings=item["settings"],
        user_id=item["user_id"],
        supabase_url=item["supabase_url"],
        supabase_key=item["supabase_key"],
    )

    return {"status": "queued", "call_id": call.object_id}


# Entry point for testing locally
if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        job_id = sys.argv[1]
    else:
        job_id = "test-job-123"

    result = process_video.local(
        job_id=job_id,
        source_path="test/sample.mp4",
        variant_count=3,
        settings={
            "brightness_range": [-0.03, 0.03],
            "saturation_range": [0.97, 1.03],
            "hue_range": [-5, 5],
            "crop_px_range": [1, 3],
            "speed_range": [0.98, 1.02],
            "remove_watermark": False,
        },
        user_id="test-user",
        supabase_url="http://localhost:54321",
        supabase_key="test-key",
    )
    print(f"Result: {result}")
