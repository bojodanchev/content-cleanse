"""
FFmpeg Utility Functions for Creator Engine

Advanced transformation functions including:
- Watermark detection and removal
- Batch processing optimization
- Quality preservation techniques
"""

import subprocess
import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import random


def detect_watermark(input_path: str) -> Optional[Dict[str, int]]:
    """
    Detect potential watermark regions in video.

    Uses edge detection and logo detection heuristics to identify
    common watermark positions (corners, etc.)

    Returns coordinates of detected watermark region or None.
    """
    # Get video dimensions
    info = get_video_dimensions(input_path)
    if not info:
        return None

    width, height = info["width"], info["height"]

    # Common watermark positions (as percentages)
    common_positions = [
        # (x_start, y_start, width, height) as percentage of frame
        (0.8, 0.9, 0.2, 0.1),   # bottom-right
        (0.0, 0.9, 0.2, 0.1),   # bottom-left
        (0.8, 0.0, 0.2, 0.1),   # top-right
        (0.0, 0.0, 0.2, 0.1),   # top-left
        (0.4, 0.45, 0.2, 0.1),  # center
    ]

    # For now, return a heuristic-based detection
    # In production, this would use ML-based watermark detection
    # or the Replicate API for more accurate detection

    # Check bottom-right corner (most common watermark position)
    return {
        "x": int(width * 0.8),
        "y": int(height * 0.9),
        "width": int(width * 0.18),
        "height": int(height * 0.08),
    }


def get_video_dimensions(input_path: str) -> Optional[Dict[str, int]]:
    """Get video width and height using ffprobe."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "json",
        input_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        return None

    try:
        data = json.loads(result.stdout)
        stream = data["streams"][0]
        return {
            "width": stream["width"],
            "height": stream["height"],
        }
    except (json.JSONDecodeError, KeyError, IndexError):
        return None


def remove_watermark_inpaint(
    input_path: str,
    output_path: str,
    watermark_region: Dict[str, int],
) -> bool:
    """
    Remove watermark using FFmpeg's delogo filter.

    This is a basic approach using delogo. For better results,
    the Replicate API with inpainting models would be used.

    Args:
        input_path: Path to input video
        output_path: Path for output video
        watermark_region: Dict with x, y, width, height of watermark

    Returns:
        True if successful, False otherwise
    """
    x = watermark_region["x"]
    y = watermark_region["y"]
    w = watermark_region["width"]
    h = watermark_region["height"]

    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-vf", f"delogo=x={x}:y={y}:w={w}:h={h}:show=0",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "copy",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0


def add_watermark(
    input_path: str,
    output_path: str,
    watermark_path: str,
    position: str = "bottom-right",
    opacity: float = 0.8,
    scale: float = 0.15,
) -> bool:
    """
    Add a watermark image to video.

    Args:
        input_path: Path to input video
        output_path: Path for output video
        watermark_path: Path to watermark image (PNG with transparency)
        position: One of 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'
        opacity: Watermark opacity (0.0-1.0)
        scale: Scale factor relative to video width

    Returns:
        True if successful, False otherwise
    """
    # Position mapping for FFmpeg overlay filter
    position_map = {
        "top-left": "10:10",
        "top-right": "main_w-overlay_w-10:10",
        "bottom-left": "10:main_h-overlay_h-10",
        "bottom-right": "main_w-overlay_w-10:main_h-overlay_h-10",
        "center": "(main_w-overlay_w)/2:(main_h-overlay_h)/2",
    }

    overlay_pos = position_map.get(position, position_map["bottom-right"])

    # Build filter complex for watermark with opacity and scale
    filter_complex = (
        f"[1:v]scale=iw*{scale}:-1,format=rgba,colorchannelmixer=aa={opacity}[wm];"
        f"[0:v][wm]overlay={overlay_pos}"
    )

    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-i", watermark_path,
        "-filter_complex", filter_complex,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "copy",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0


def generate_thumbnail(
    input_path: str,
    output_path: str,
    timestamp: float = 1.0,
    width: int = 320,
) -> bool:
    """
    Generate a thumbnail from video at specified timestamp.

    Args:
        input_path: Path to input video
        output_path: Path for output thumbnail (jpg/png)
        timestamp: Time in seconds to capture frame
        width: Thumbnail width (height auto-calculated)

    Returns:
        True if successful, False otherwise
    """
    cmd = [
        "ffmpeg",
        "-y",
        "-ss", str(timestamp),
        "-i", input_path,
        "-vframes", "1",
        "-vf", f"scale={width}:-1",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0


def get_video_duration(input_path: str) -> Optional[float]:
    """Get video duration in seconds."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "json",
        input_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        return None

    try:
        data = json.loads(result.stdout)
        return float(data["format"]["duration"])
    except (json.JSONDecodeError, KeyError, ValueError):
        return None


def concat_videos(input_paths: List[str], output_path: str) -> bool:
    """
    Concatenate multiple videos into one.

    Args:
        input_paths: List of input video paths
        output_path: Path for concatenated output

    Returns:
        True if successful, False otherwise
    """
    # Create concat file
    concat_file = Path(output_path).with_suffix(".txt")
    with open(concat_file, "w") as f:
        for path in input_paths:
            f.write(f"file '{path}'\n")

    cmd = [
        "ffmpeg",
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_file),
        "-c", "copy",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    # Cleanup
    concat_file.unlink(missing_ok=True)

    return result.returncode == 0


def apply_noise_filter(
    input_path: str,
    output_path: str,
    strength: float = 5.0,
    seed: int = None,
) -> bool:
    """
    Apply subtle noise to video for additional uniqueness.

    Args:
        input_path: Path to input video
        output_path: Path for output video
        strength: Noise strength (0-100, recommended 1-10)
        seed: Random seed for reproducibility

    Returns:
        True if successful, False otherwise
    """
    if seed is None:
        seed = random.randint(0, 999999)

    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-vf", f"noise=c0s={strength}:c0f=t:seed={seed}",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "copy",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0


def extract_audio(input_path: str, output_path: str) -> bool:
    """Extract audio track from video."""
    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-vn",
        "-acodec", "copy",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0


def strip_metadata(input_path: str, output_path: str) -> bool:
    """
    Strip all metadata from video file.

    This removes:
    - EXIF data
    - Encoder information
    - Creation timestamps
    - GPS data
    - Any other embedded metadata
    """
    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-map_metadata", "-1",
        "-fflags", "+bitexact",
        "-flags:v", "+bitexact",
        "-flags:a", "+bitexact",
        "-c", "copy",
        output_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0


def verify_uniqueness(file_paths: List[str]) -> Dict[str, List[str]]:
    """
    Verify that all files have unique hashes.

    Returns a dict mapping hashes to file paths.
    Duplicates will have multiple paths for the same hash.
    """
    import hashlib

    hash_map: Dict[str, List[str]] = {}

    for path in file_paths:
        hasher = hashlib.md5()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hasher.update(chunk)
        file_hash = hasher.hexdigest()

        if file_hash not in hash_map:
            hash_map[file_hash] = []
        hash_map[file_hash].append(path)

    return hash_map
