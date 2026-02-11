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

# Worker directory for local file references
_worker_dir = Path(__file__).parent

# Container image with FFmpeg, Pillow, InsightFace, GFPGAN, and bundled helpers
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "supabase",
        "httpx",
        "fastapi[standard]",
        "Pillow",
        "numpy",
        "insightface",
        "onnxruntime",
        "opencv-python-headless",
        "torch",
        "torchvision",
        "gfpgan",
        "basicsr",
        "facexlib",
    )
    .pip_install("huggingface_hub")
    .apt_install("wget", "unzip")
    .run_commands(
        # Download InsightFace buffalo_l model pack from GitHub releases (official source)
        "mkdir -p /root/.insightface/models/buffalo_l && "
        "wget -O /tmp/buffalo_l.zip "
        "'https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip' && "
        "unzip -o /tmp/buffalo_l.zip -d /root/.insightface/models/buffalo_l/ && "
        "ls -la /root/.insightface/models/buffalo_l/ && "
        "rm /tmp/buffalo_l.zip",
        # Download inswapper_128 model from Hugging Face (public mirror)
        "mkdir -p /models && "
        "wget -O /models/inswapper_128.onnx "
        "'https://huggingface.co/ezioruan/inswapper_128.onnx/resolve/main/inswapper_128.onnx'",
        # Download GFPGAN model
        "wget -O /models/GFPGANv1.4.pth "
        "'https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth'",
    )
    .add_local_dir(str(_worker_dir / "fonts"), remote_path="/assets/fonts")
    .add_local_file(str(_worker_dir / "text_renderer.py"), remote_path="/helpers/text_renderer.py")
    .add_local_file(str(_worker_dir / "image_augmenter.py"), remote_path="/helpers/image_augmenter.py")
    .add_local_file(str(_worker_dir / "face_swapper.py"), remote_path="/helpers/face_swapper.py")
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


# ============================================================
# Photo Captions Processing
# ============================================================

@app.function(
    image=image,
    timeout=600,
    cpu=2,
    memory=4096,
)
def process_captions(
    job_id: str,
    source_path: str,
    captions: List[str],
    font_size: str,
    position: str,
    generate_video: bool,
    user_id: str,
    supabase_url: str,
    supabase_key: str,
) -> Dict[str, Any]:
    """
    Process a photo with captions to create unique image variants.

    For each caption:
    1. Resize/crop source photo to 1080x1920
    2. Render caption text with Pillow
    3. Apply light augmentation (brightness, saturation, color tint)
    4. Strip metadata and save with randomized JPEG quality
    5. Upload variant to Supabase Storage

    Optionally generates a slideshow video from all variants.
    """
    from supabase import create_client, Client
    from PIL import Image
    import sys

    # Add the mount path so Python can find our helper modules
    sys.path.insert(0, "/helpers")
    from text_renderer import resize_and_crop, render_caption
    from image_augmenter import augment_image, save_clean

    supabase: Client = create_client(supabase_url, supabase_key)

    work_dir = Path(f"/tmp/{job_id}")
    work_dir.mkdir(parents=True, exist_ok=True)
    output_dir = work_dir / "variants"
    output_dir.mkdir(exist_ok=True)

    font_path = "/assets/fonts/Anton-Regular.ttf"
    if not Path(font_path).exists():
        raise FileNotFoundError(f"Font not found: {font_path}. Check Modal font mount.")
    variant_count = len(captions)

    try:
        update_job_status(supabase, job_id, "processing", 0)

        # Download source photo from images bucket
        print(f"Downloading source photo: {source_path}")
        response = supabase.storage.from_("images").download(source_path)
        input_path = work_dir / "input.jpg"
        input_path.write_bytes(response)

        # Resize/crop once (all variants share the same base)
        base_img = Image.open(input_path).convert("RGB")
        base_img = resize_and_crop(base_img)

        variants = []
        for i, caption in enumerate(captions):
            variant_name = f"variant_{i+1:03d}.jpg"
            variant_path = output_dir / variant_name

            # Render caption on a copy of the base image
            captioned = render_caption(base_img, caption, font_path, font_size, position)

            # Apply light augmentation
            augmented = augment_image(captioned)

            # Save with metadata stripped
            save_clean(augmented, variant_path)

            file_size = variant_path.stat().st_size
            file_hash = calculate_file_hash(str(variant_path))

            variants.append({
                "name": variant_name,
                "path": str(variant_path),
                "hash": file_hash,
                "size": file_size,
                "caption": caption,
            })

            # Upload variant to Supabase Storage
            variant_storage_path = f"{user_id}/{job_id}/{variant_name}"
            try:
                with open(variant_path, "rb") as vf:
                    supabase.storage.from_("outputs").upload(
                        variant_storage_path,
                        vf.read(),
                        {"content-type": "image/jpeg"},
                    )
            except Exception as upload_err:
                print(f"Warning: Failed to upload variant {variant_name}: {upload_err}")

            # Insert variant record
            try:
                supabase.table("variants").insert({
                    "job_id": job_id,
                    "file_path": variant_storage_path,
                    "file_size": file_size,
                    "file_hash": file_hash,
                    "caption_text": caption,
                    "transformations": {"font_size": font_size, "position": position},
                }).execute()
            except Exception as db_err:
                print(f"Warning: Failed to insert variant record {variant_name}: {db_err}")

            progress = int((i + 1) / variant_count * 100)
            update_job_status(supabase, job_id, "processing", progress, i + 1)
            print(f"Caption variant {i+1}/{variant_count} complete")

        # Optionally generate slideshow video
        output_video_path = None
        if generate_video and len(variants) >= 2:
            print("Generating slideshow video...")
            video_path = work_dir / "slideshow.mp4"
            _generate_slideshow(
                [Path(v["path"]) for v in variants],
                video_path,
            )
            if video_path.exists():
                video_storage_path = f"{user_id}/{job_id}/slideshow.mp4"
                try:
                    with open(video_path, "rb") as vf:
                        supabase.storage.from_("outputs").upload(
                            video_storage_path,
                            vf.read(),
                            {"content-type": "video/mp4"},
                        )
                    output_video_path = video_storage_path
                except Exception as vid_err:
                    print(f"Warning: Failed to upload slideshow video: {vid_err}")

        # Create ZIP archive
        print("Creating ZIP archive...")
        zip_path = work_dir / f"{job_id}_variants.zip"
        create_zip_archive(variants, str(zip_path))

        output_zip_storage = f"{user_id}/{job_id}/variants.zip"
        try:
            with open(zip_path, "rb") as f:
                supabase.storage.from_("outputs").upload(
                    output_zip_storage,
                    f.read(),
                    {"content-type": "application/zip"},
                )
        except Exception as zip_err:
            print(f"Warning: Failed to upload ZIP: {zip_err}")
            output_zip_storage = None

        # Mark job completed
        supabase.table("jobs").update({
            "status": "completed",
            "progress": 100,
            "variants_completed": variant_count,
            "output_zip_path": output_zip_storage,
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", job_id).execute()

        return {
            "status": "completed",
            "variants_created": variant_count,
            "output_path": output_zip_storage,
            "video_path": output_video_path,
        }

    except Exception as e:
        print(f"Error processing captions: {e}")
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
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)


# ============================================================
# Faceswap Processing
# ============================================================

@app.function(
    image=image,
    timeout=900,  # 15 minutes max (video frame-by-frame is slow)
    cpu=4,
    memory=8192,  # 8GB RAM for models
)
def process_faceswap(
    job_id: str,
    source_path: str,
    source_type: str,  # "video" | "image"
    face_path: str,
    variant_count: int,
    swap_only: bool,
    user_id: str,
    supabase_url: str,
    supabase_key: str,
) -> Dict[str, Any]:
    """
    Process a video or image with face swapping.

    For images: swap face, optionally generate augmented variants.
    For videos: extract frames, swap face per frame, reassemble, optionally generate FFmpeg variants.
    """
    from supabase import create_client, Client
    import cv2
    import sys

    sys.path.insert(0, "/helpers")
    from face_swapper import (
        _get_face_analyser,
        _get_swapper,
        _get_enhancer,
        swap_face_in_image,
    )

    supabase: Client = create_client(supabase_url, supabase_key)

    work_dir = Path(f"/tmp/{job_id}")
    work_dir.mkdir(parents=True, exist_ok=True)
    output_dir = work_dir / "variants"
    output_dir.mkdir(exist_ok=True)

    try:
        update_job_status(supabase, job_id, "processing", 0)

        # Initialize models once (reused across all frames/variants)
        print("Loading face swap models...")
        analyser = _get_face_analyser()
        swapper = _get_swapper()
        enhancer = _get_enhancer()

        # Download reference face
        print(f"Downloading reference face: {face_path}")
        ref_bytes = supabase.storage.from_("faces").download(face_path)
        ref_path = work_dir / "reference.jpg"
        ref_path.write_bytes(ref_bytes)
        ref_img = cv2.imread(str(ref_path))

        if ref_img is None:
            raise ValueError("Failed to read reference face image")

        if source_type == "image":
            result = _process_faceswap_image(
                supabase, job_id, source_path, ref_img,
                variant_count, swap_only, user_id, work_dir, output_dir,
                analyser, swapper, enhancer,
            )
        else:
            result = _process_faceswap_video(
                supabase, job_id, source_path, ref_img,
                variant_count, swap_only, user_id, work_dir, output_dir,
                analyser, swapper, enhancer,
            )

        return result

    except Exception as e:
        print(f"Error processing faceswap: {e}")
        try:
            supabase.table("jobs").update({
                "status": "failed",
                "error_message": str(e)[:500],
                "error_code": type(e).__name__,
            }).eq("id", job_id).execute()
        except Exception as status_err:
            print(f"CRITICAL: Failed to update job status: {status_err}")
        raise

    finally:
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)


def _process_faceswap_image(
    supabase, job_id, source_path, ref_img,
    variant_count, swap_only, user_id, work_dir, output_dir,
    analyser, swapper, enhancer,
):
    """Handle faceswap for a single image."""
    import cv2
    import sys
    sys.path.insert(0, "/helpers")
    from face_swapper import swap_face_in_image

    # Download source image
    print(f"Downloading source image: {source_path}")
    src_bytes = supabase.storage.from_("images").download(source_path)
    src_path = work_dir / "source.jpg"
    src_path.write_bytes(src_bytes)
    source_img = cv2.imread(str(src_path))

    if source_img is None:
        raise ValueError("Failed to read source image")

    # Perform face swap
    print("Swapping face...")
    swapped = swap_face_in_image(source_img, ref_img, analyser, swapper, enhancer)

    if swapped is None:
        raise ValueError("No face detected in source image")

    update_job_status(supabase, job_id, "processing", 30)

    if swap_only:
        # Single output
        out_path = output_dir / "faceswap_001.jpg"
        cv2.imwrite(str(out_path), swapped, [cv2.IMWRITE_JPEG_QUALITY, 95])
        file_size = out_path.stat().st_size
        file_hash = calculate_file_hash(str(out_path))

        storage_path = f"{user_id}/{job_id}/faceswap_001.jpg"
        with open(out_path, "rb") as f:
            supabase.storage.from_("outputs").upload(
                storage_path, f.read(), {"content-type": "image/jpeg"}
            )

        supabase.table("variants").insert({
            "job_id": job_id,
            "file_path": storage_path,
            "file_size": file_size,
            "file_hash": file_hash,
            "transformations": {"type": "faceswap"},
        }).execute()

        total_variants = 1
        variants = [{"name": "faceswap_001.jpg", "path": str(out_path)}]
    else:
        # Generate augmented variants from the swapped image
        from image_augmenter import augment_image, save_clean
        from PIL import Image as PILImage

        swapped_pil = PILImage.fromarray(cv2.cvtColor(swapped, cv2.COLOR_BGR2RGB))
        actual_count = max(1, variant_count)
        variants = []

        for i in range(actual_count):
            variant_name = f"faceswap_{i+1:03d}.jpg"
            variant_path = output_dir / variant_name

            augmented = augment_image(swapped_pil.copy())
            save_clean(augmented, variant_path)

            file_size = variant_path.stat().st_size
            file_hash = calculate_file_hash(str(variant_path))

            storage_path = f"{user_id}/{job_id}/{variant_name}"
            with open(variant_path, "rb") as f:
                supabase.storage.from_("outputs").upload(
                    storage_path, f.read(), {"content-type": "image/jpeg"}
                )

            supabase.table("variants").insert({
                "job_id": job_id,
                "file_path": storage_path,
                "file_size": file_size,
                "file_hash": file_hash,
                "transformations": {"type": "faceswap_variant", "index": i + 1},
            }).execute()

            variants.append({"name": variant_name, "path": str(variant_path)})

            progress = 30 + int((i + 1) / actual_count * 60)
            update_job_status(supabase, job_id, "processing", progress, i + 1)
            print(f"Variant {i+1}/{actual_count} complete")

        total_variants = actual_count

    # Create ZIP
    print("Creating ZIP archive...")
    zip_path = work_dir / f"{job_id}_faceswap.zip"
    create_zip_archive(variants, str(zip_path))

    zip_storage = f"{user_id}/{job_id}/faceswap.zip"
    with open(zip_path, "rb") as f:
        supabase.storage.from_("outputs").upload(
            zip_storage, f.read(), {"content-type": "application/zip"}
        )

    supabase.table("jobs").update({
        "status": "completed",
        "progress": 100,
        "variants_completed": total_variants,
        "output_zip_path": zip_storage,
        "completed_at": datetime.utcnow().isoformat(),
    }).eq("id", job_id).execute()

    return {"status": "completed", "variants_created": total_variants, "output_path": zip_storage}


def _process_faceswap_video(
    supabase, job_id, source_path, ref_img,
    variant_count, swap_only, user_id, work_dir, output_dir,
    analyser, swapper, enhancer,
):
    """Handle faceswap for a video (frame-by-frame)."""
    import cv2
    import sys
    sys.path.insert(0, "/helpers")
    from face_swapper import swap_face_in_image

    # Download source video
    print(f"Downloading source video: {source_path}")
    src_bytes = supabase.storage.from_("videos").download(source_path)
    src_path = work_dir / "source.mp4"
    src_path.write_bytes(src_bytes)

    # Extract frames
    frames_dir = work_dir / "frames"
    frames_dir.mkdir(exist_ok=True)
    swapped_frames_dir = work_dir / "swapped_frames"
    swapped_frames_dir.mkdir(exist_ok=True)

    print("Extracting frames...")
    cmd = [
        "ffmpeg", "-y", "-i", str(src_path),
        "-qscale:v", "2",
        str(frames_dir / "frame_%06d.png"),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg frame extraction failed: {result.stderr}")

    frame_files = sorted(frames_dir.glob("frame_*.png"))
    total_frames = len(frame_files)
    print(f"Extracted {total_frames} frames")

    if total_frames == 0:
        raise ValueError("No frames extracted from video")

    update_job_status(supabase, job_id, "processing", 10)

    # Swap face in each frame
    print("Swapping faces frame-by-frame...")
    for i, frame_path in enumerate(frame_files):
        frame = cv2.imread(str(frame_path))
        swapped = swap_face_in_image(frame, ref_img, analyser, swapper, enhancer)

        out_frame_path = swapped_frames_dir / frame_path.name
        if swapped is not None:
            cv2.imwrite(str(out_frame_path), swapped)
        else:
            # No face in this frame — keep original
            cv2.imwrite(str(out_frame_path), frame)

        if (i + 1) % 30 == 0 or i == total_frames - 1:
            progress = 10 + int((i + 1) / total_frames * 60)
            update_job_status(supabase, job_id, "processing", progress)
            print(f"  Frame {i+1}/{total_frames}")

    # Get original video FPS and audio info
    video_info = get_video_info(str(src_path))
    fps = "30"
    for stream in video_info.get("streams", []):
        if stream.get("codec_type") == "video":
            r_frame_rate = stream.get("r_frame_rate", "30/1")
            if "/" in r_frame_rate:
                num, den = r_frame_rate.split("/")
                fps = str(round(int(num) / int(den)))
            else:
                fps = r_frame_rate
            break

    # Reassemble video from swapped frames + original audio
    print("Reassembling video...")
    swapped_video = work_dir / "swapped.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-framerate", fps,
        "-i", str(swapped_frames_dir / "frame_%06d.png"),
        "-i", str(src_path),
        "-map", "0:v",
        "-map", "1:a?",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        "-map_metadata", "-1",
        "-fflags", "+bitexact",
        str(swapped_video),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg reassembly failed: {result.stderr}")

    update_job_status(supabase, job_id, "processing", 75)

    if swap_only:
        # Single output
        final_name = "faceswap_001.mp4"
        final_path = output_dir / final_name
        import shutil
        shutil.copy2(str(swapped_video), str(final_path))

        file_size = final_path.stat().st_size
        file_hash = calculate_file_hash(str(final_path))

        storage_path = f"{user_id}/{job_id}/{final_name}"
        with open(final_path, "rb") as f:
            supabase.storage.from_("outputs").upload(
                storage_path, f.read(), {"content-type": "video/mp4"}
            )

        supabase.table("variants").insert({
            "job_id": job_id,
            "file_path": storage_path,
            "file_size": file_size,
            "file_hash": file_hash,
            "transformations": {"type": "faceswap"},
        }).execute()

        total_variants = 1
        variants = [{"name": final_name, "path": str(final_path)}]
    else:
        # Generate FFmpeg variants from the swapped video
        actual_count = max(1, variant_count)
        variants = []
        default_settings = {
            "brightness_range": [-0.03, 0.03],
            "saturation_range": [0.97, 1.03],
            "hue_range": [-5, 5],
            "crop_px_range": [1, 3],
            "speed_range": [0.98, 1.02],
        }

        for i in range(actual_count):
            variant_name = f"faceswap_{i+1:03d}.mp4"
            variant_path = output_dir / variant_name

            transformations = generate_transformations(default_settings)
            process_single_variant(str(swapped_video), str(variant_path), transformations)

            file_size = variant_path.stat().st_size
            file_hash = calculate_file_hash(str(variant_path))

            storage_path = f"{user_id}/{job_id}/{variant_name}"
            with open(variant_path, "rb") as f:
                supabase.storage.from_("outputs").upload(
                    storage_path, f.read(), {"content-type": "video/mp4"}
                )

            supabase.table("variants").insert({
                "job_id": job_id,
                "file_path": storage_path,
                "file_size": file_size,
                "file_hash": file_hash,
                "transformations": {**transformations, "type": "faceswap_variant"},
            }).execute()

            variants.append({"name": variant_name, "path": str(variant_path)})

            progress = 75 + int((i + 1) / actual_count * 20)
            update_job_status(supabase, job_id, "processing", progress, i + 1)
            print(f"Variant {i+1}/{actual_count} complete")

        total_variants = actual_count

    # Create ZIP
    print("Creating ZIP archive...")
    zip_path = work_dir / f"{job_id}_faceswap.zip"
    create_zip_archive(variants, str(zip_path))

    zip_storage = f"{user_id}/{job_id}/faceswap.zip"
    with open(zip_path, "rb") as f:
        supabase.storage.from_("outputs").upload(
            zip_storage, f.read(), {"content-type": "application/zip"}
        )

    supabase.table("jobs").update({
        "status": "completed",
        "progress": 100,
        "variants_completed": total_variants,
        "output_zip_path": zip_storage,
        "completed_at": datetime.utcnow().isoformat(),
    }).eq("id", job_id).execute()

    return {"status": "completed", "variants_created": total_variants, "output_path": zip_storage}


def _generate_slideshow(
    image_paths: List[Path],
    output_path: Path,
    pause: float = 2.0,
    scroll: float = 0.2,
    crf: int = 18,
    fps: int = 30,
) -> None:
    """Generate a slideshow video from captioned images using FFmpeg xfade transitions."""
    n = len(image_paths)
    if n < 2:
        return

    cmd = ["ffmpeg", "-y"]

    slide_duration = pause + scroll
    for img_path in image_paths:
        cmd += ["-loop", "1", "-t", str(slide_duration), "-i", str(img_path)]

    filter_parts = []
    current_input = "[0:v]"

    for i in range(1, n):
        next_input = f"[{i}:v]"
        offset = pause + (i - 1) * (pause + scroll)

        if i < n - 1:
            out_label = f"[v{i}]"
        else:
            out_label = "[outv]"

        filter_parts.append(
            f"{current_input}{next_input}xfade=transition=slideleft:duration={scroll}:offset={offset:.4f}{out_label}"
        )
        current_input = out_label

    filter_complex = ";".join(filter_parts)

    cmd += [
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-r", str(fps), "-crf", str(crf),
        "-map_metadata", "-1", "-fflags", "+bitexact",
        str(output_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Warning: Slideshow generation failed: {result.stderr[-300:]}")


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def start_caption_processing(item: dict):
    """
    Web endpoint to trigger photo caption processing.
    Called from the Next.js API route via HTTP POST.
    Spawns process_captions asynchronously and returns immediately.
    """
    required = [
        "job_id", "source_path", "captions", "font_size", "position",
        "generate_video", "user_id", "supabase_url", "supabase_key",
    ]
    missing = [k for k in required if k not in item]
    if missing:
        return {"status": "error", "error": f"Missing fields: {missing}"}

    call = process_captions.spawn(
        job_id=item["job_id"],
        source_path=item["source_path"],
        captions=item["captions"],
        font_size=item["font_size"],
        position=item["position"],
        generate_video=item["generate_video"],
        user_id=item["user_id"],
        supabase_url=item["supabase_url"],
        supabase_key=item["supabase_key"],
    )

    return {"status": "queued", "call_id": call.object_id}


# ============================================================
# Faceswap Processing Endpoint
# ============================================================

@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def start_faceswap_processing(item: dict):
    """
    Web endpoint to trigger faceswap processing.
    Called from the Next.js API route via HTTP POST.
    Spawns process_faceswap asynchronously and returns immediately.
    """
    required = [
        "job_id", "source_path", "source_type", "face_path",
        "variant_count", "swap_only", "user_id",
        "supabase_url", "supabase_key",
    ]
    missing = [k for k in required if k not in item]
    if missing:
        return {"status": "error", "error": f"Missing fields: {missing}"}

    call = process_faceswap.spawn(
        job_id=item["job_id"],
        source_path=item["source_path"],
        source_type=item["source_type"],
        face_path=item["face_path"],
        variant_count=item["variant_count"],
        swap_only=item["swap_only"],
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
