"""
Light image augmentation for photo captions variants.

Each variant gets imperceptible but pixel-unique modifications:
- Brightness: +/-5%
- Saturation: +/-5%
- Color tint: +/-3 per RGB channel
- JPEG quality: randomized 85-95
- Metadata: stripped (EXIF/ICC/XMP)

No geometric transforms (rotation, zoom, crop).
"""

import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance


def _brightness_jitter(img: Image.Image) -> Image.Image:
    """Adjust brightness by +/-5%."""
    factor = 1.0 + random.choice([-1, 1]) * random.uniform(0.01, 0.05)
    return ImageEnhance.Brightness(img).enhance(factor)


def _saturation_jitter(img: Image.Image) -> Image.Image:
    """Adjust color saturation by +/-5%."""
    factor = 1.0 + random.choice([-1, 1]) * random.uniform(0.01, 0.05)
    return ImageEnhance.Color(img).enhance(factor)


def _color_tint(img: Image.Image) -> Image.Image:
    """Apply a subtle random RGB channel offset of +/-3 per channel using numpy."""
    r_off = random.choice([-1, 1]) * random.randint(1, 3)
    g_off = random.choice([-1, 1]) * random.randint(1, 3)
    b_off = random.choice([-1, 1]) * random.randint(1, 3)

    arr = np.array(img, dtype=np.int16)
    arr[:, :, 0] += r_off
    arr[:, :, 1] += g_off
    arr[:, :, 2] += b_off
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def augment_image(img: Image.Image) -> Image.Image:
    """Apply light augmentations to make the image pixel-unique.

    Input image should be 1080x1920 RGB.
    Returns augmented image (same dimensions).
    """
    img = img.convert("RGB")
    img = _brightness_jitter(img)
    img = _saturation_jitter(img)
    img = _color_tint(img)
    return img


def save_clean(img: Image.Image, output_path: Path) -> None:
    """Save image with all metadata stripped and randomized JPEG quality.

    Creates a fresh image from pixel data only (no EXIF/ICC/XMP).
    """
    clean = Image.new(img.mode, img.size)
    clean.putdata(list(img.getdata()))

    if clean.mode not in ("RGB", "L"):
        clean = clean.convert("RGB")

    quality = random.randint(85, 95)
    clean.save(
        str(output_path),
        format="JPEG",
        quality=quality,
        subsampling=0,
        exif=b"",
    )
