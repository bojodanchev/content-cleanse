"""
Face Swapper - InsightFace + GFPGAN pipeline

Detects the most prominent face in source media,
swaps it with the reference face, and enhances with GFPGAN.
"""

import os
import numpy as np
from pathlib import Path
from typing import Optional


# Model paths (baked into Modal container image)
MODELS_DIR = "/models"
INSIGHTFACE_DIR = "/root/.insightface"
SWAP_MODEL_PATH = os.path.join(MODELS_DIR, "inswapper_128.onnx")
GFPGAN_MODEL_PATH = os.path.join(MODELS_DIR, "GFPGANv1.4.pth")


def _get_face_analyser():
    """Initialize InsightFace analyser (cached after first call)."""
    import insightface

    analyser = insightface.app.FaceAnalysis(
        name="buffalo_l",
        root=INSIGHTFACE_DIR,
        providers=["CPUExecutionProvider"],
    )
    analyser.prepare(ctx_id=0, det_size=(640, 640))
    return analyser


def _get_swapper():
    """Initialize the inswapper model."""
    import insightface

    return insightface.model_zoo.get_model(
        SWAP_MODEL_PATH,
        providers=["CPUExecutionProvider"],
    )


def _get_enhancer():
    """Initialize GFPGAN face enhancer."""
    from gfpgan import GFPGANer

    return GFPGANer(
        model_path=GFPGAN_MODEL_PATH,
        upscale=1,
        arch="clean",
        channel_multiplier=2,
        bg_upsampler=None,
    )


def get_largest_face(faces):
    """Pick the most prominent (largest bounding box area) face."""
    if not faces:
        return None
    return max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))


def swap_face_in_image(
    source_img: np.ndarray,
    reference_img: np.ndarray,
    analyser=None,
    swapper=None,
    enhancer=None,
) -> Optional[np.ndarray]:
    """
    Swap the most prominent face in source_img with the face from reference_img.

    Args:
        source_img: BGR numpy array (OpenCV format)
        reference_img: BGR numpy array of reference face
        analyser: Reusable InsightFace analyser instance
        swapper: Reusable inswapper model instance
        enhancer: Reusable GFPGAN enhancer instance

    Returns:
        BGR numpy array with swapped face, or None if no face detected
    """
    if analyser is None:
        analyser = _get_face_analyser()
    if swapper is None:
        swapper = _get_swapper()
    if enhancer is None:
        enhancer = _get_enhancer()

    # Detect faces in source
    source_faces = analyser.get(source_img)
    if not source_faces:
        return None

    target_face = get_largest_face(source_faces)

    # Get reference face embedding
    ref_faces = analyser.get(reference_img)
    if not ref_faces:
        raise ValueError("No face detected in reference image")

    ref_face = get_largest_face(ref_faces)

    # Perform the swap
    result = swapper.get(source_img, target_face, ref_face, paste_back=True)

    # Enhance the swapped face with GFPGAN
    _, _, enhanced = enhancer.enhance(
        result,
        has_aligned=False,
        only_center_face=False,
        paste_back=True,
    )

    return enhanced if enhanced is not None else result


def validate_reference_face(
    reference_img: np.ndarray,
    analyser=None,
) -> int:
    """
    Validate that exactly 1 face is present in the reference image.

    Returns the number of faces detected.
    """
    if analyser is None:
        analyser = _get_face_analyser()

    faces = analyser.get(reference_img)
    return len(faces)
