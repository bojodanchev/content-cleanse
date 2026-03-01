"""
Text rendering for photo captions.
Ported from slideshow captions project, adapted for Creator Engine Modal worker.

Renders caption text on images with TikTok-style formatting:
- Anton bold font (bundled TTF)
- White text with black stroke
- UPPERCASE, word-wrapped to 90% of image width
"""

import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


# Pattern to match emojis and other symbols that most display fonts can't render
_EMOJI_RE = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map
    "\U0001F1E0-\U0001F1FF"  # flags
    "\U00002702-\U000027B0"  # dingbats
    "\U0001F900-\U0001F9FF"  # supplemental symbols
    "\U0001FA00-\U0001FA6F"  # chess symbols
    "\U0001FA70-\U0001FAFF"  # symbols extended-A
    "\U00002600-\U000026FF"  # misc symbols
    "\U0000FE00-\U0000FE0F"  # variation selectors
    "\U0000200D"             # zero-width joiner
    "\U0000200B-\U0000200F"  # zero-width spaces
    "]+",
    flags=re.UNICODE,
)


def strip_emojis(text: str) -> str:
    """Remove emoji characters that the display font can't render."""
    return _EMOJI_RE.sub("", text).strip()

TARGET_WIDTH = 1080
TARGET_HEIGHT = 1920

FONT_SIZES = {
    "small": 60,
    "medium": 80,
    "large": 100,
}


def resize_and_crop(img: Image.Image) -> Image.Image:
    """Resize image to fill 1080x1920, then center-crop to exact dimensions."""
    target_ratio = TARGET_WIDTH / TARGET_HEIGHT
    img_ratio = img.width / img.height

    if img_ratio > target_ratio:
        new_height = TARGET_HEIGHT
        new_width = int(img.width * (TARGET_HEIGHT / img.height))
    else:
        new_width = TARGET_WIDTH
        new_height = int(img.height * (TARGET_WIDTH / img.width))

    img = img.resize((new_width, new_height), Image.LANCZOS)

    left = (new_width - TARGET_WIDTH) // 2
    top = (new_height - TARGET_HEIGHT) // 2
    img = img.crop((left, top, left + TARGET_WIDTH, top + TARGET_HEIGHT))

    return img


def wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Word-wrap text to fit within max_width pixels."""
    words = text.split()
    lines: list[str] = []
    current_line = ""

    for word in words:
        test_line = f"{current_line} {word}".strip()
        bbox = font.getbbox(test_line)
        line_width = bbox[2] - bbox[0]

        if line_width <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return lines


def render_caption(
    img: Image.Image,
    caption: str,
    font_path: str,
    font_size: str = "medium",
    position: str = "center",
) -> Image.Image:
    """Render caption text on an already-resized 1080x1920 image.

    Args:
        img: Source PIL Image (should already be 1080x1920 RGB).
        caption: Text to overlay.
        font_path: Path to .ttf font file.
        font_size: One of "small", "medium", "large".
        position: Vertical placement -- "top", "center", or "bottom".

    Returns:
        PIL Image with caption rendered on it.
    """
    img = img.copy()
    draw = ImageDraw.Draw(img)

    px_size = FONT_SIZES.get(font_size, 80)
    font = ImageFont.truetype(font_path, px_size)

    max_text_width = int(TARGET_WIDTH * 0.9)
    clean_caption = strip_emojis(caption.upper())
    lines = wrap_text(clean_caption, font, max_text_width)

    # Calculate total text block height
    line_heights = []
    for line in lines:
        bbox = font.getbbox(line)
        line_heights.append(bbox[3] - bbox[1])

    line_spacing = int(px_size * 0.2)
    total_text_height = sum(line_heights) + line_spacing * max(len(lines) - 1, 0)

    # Vertical position
    if position == "top":
        y_start = int(TARGET_HEIGHT * 0.1)
    elif position == "bottom":
        y_start = int(TARGET_HEIGHT * 0.9) - total_text_height
    else:  # center
        y_start = (TARGET_HEIGHT - total_text_height) // 2

    # Draw each line centered horizontally
    y = y_start
    for i, line in enumerate(lines):
        bbox = font.getbbox(line)
        line_width = bbox[2] - bbox[0]
        x = (TARGET_WIDTH - line_width) // 2

        draw.text(
            (x, y),
            line,
            font=font,
            fill="white",
            stroke_width=3,
            stroke_fill="black",
        )

        y += line_heights[i] + line_spacing

    return img
