# Faceswap Feature Design

**Date:** 2026-02-11
**Status:** Approved

## Overview

Add face swapping to Content Cleanse as a standalone feature. Agencies find viral content from other models, swap the face to their own model's face, and post as original content across multiple accounts.

**Tech:** InsightFace `inswapper_128` + GFPGAN face enhancement, self-hosted on Modal (CPU, GPU-upgradeable).

## User Flow

**Route:** `/faceswap` — standalone multi-step wizard

```
Step 1: Upload source media (video or image)
Step 2: Select model face (saved profile or upload new)
Step 3: Configure (swap-only vs swap + unique variants)
Step 4: Processing → download result
```

## Processing Pipeline

### Images

1. Download source image from Supabase (`images` bucket)
2. Download reference face from Supabase (`faces` bucket)
3. InsightFace: detect faces in source → pick most prominent (largest/most centered)
4. InsightFace: extract embedding from reference photo
5. `inswapper_128`: swap prominent face → reference face
6. GFPGAN: enhance swapped face (fix artifacts, smooth edges)
7. If swap-only → upload result, done
8. If swap + variants → run existing image augmentation pipeline (brightness/saturation/color jitter + metadata strip per variant)
9. ZIP all outputs → upload to `outputs` bucket

### Videos

1. Download source video from Supabase (`videos` bucket)
2. Download reference face, extract embedding once
3. FFmpeg: extract all frames as PNGs
4. For each frame:
   - Detect faces → pick most prominent (skip frame if no face detected)
   - Swap face using cached embedding
   - GFPGAN enhance
5. FFmpeg: reassemble frames into video + copy original audio
6. If swap-only → upload result, done
7. If swap + variants → run existing FFmpeg variant pipeline (brightness/saturation/hue/crop/speed per variant)
8. ZIP all outputs → upload to `outputs` bucket

**Key:** Face embedding from reference photo is extracted once and reused across all frames.

## Face Selection

- **Single face swap only** — detects all faces, swaps the most prominent one (largest/most centered)
- No multi-face selection UI needed for v1
- Reference photo validated: must contain exactly 1 face (reject 0 or 2+)

## Reusable Face Profiles

Agencies save model faces to their account for reuse across jobs.

- `faces` DB table stores metadata (name, file_path, user_id)
- `faces` storage bucket stores reference photos
- UI: grid of saved face cards with name + thumbnail
- Option to "Save for later" when uploading a new face inline

## Plan Limits

| Plan   | Faceswaps/month |
|--------|-----------------|
| Free   | 2               |
| Pro    | 50              |
| Agency | Unlimited       |

Consumes 1 quota unit per job (separate from video/caption quota, tracked via faceswap-specific limits in API route).

## Database Changes

### Migration 012: Faceswap

```sql
-- Faces table for saved model profiles
CREATE TABLE faces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE faces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own faces"
  ON faces FOR ALL USING (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('faces', 'faces', false);

CREATE POLICY "Users manage own faces" ON storage.objects
  FOR ALL USING (bucket_id = 'faces' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Jobs table

- `job_type` = `'faceswap'` (TEXT column, no schema change needed)
- `settings` JSON: `{ face_id, source_type, variant_count, swap_only }`

## Modal Container

### New dependencies

```python
modal.Image.debian_slim()
    .apt_install("ffmpeg", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "insightface",
        "onnxruntime",
        "opencv-python-headless",
        "gfpgan",
        "numpy",
        "Pillow",
        "supabase",
        "httpx",
        "fastapi[standard]",
    )
```

### Model files (baked into container image at build time)

- `inswapper_128.onnx` (~500MB) — face swap model
- `GFPGANv1.4.pth` (~350MB) — face enhancement
- InsightFace `buffalo_l` detection model (~300MB)

Total container image: ~2-3GB

### Modal function

```python
@modal.function(timeout=900, cpu=4, memory=8192)
def process_faceswap(
    job_id, supabase_url, supabase_key,
    source_path, source_type,  # "video" | "image"
    face_path,                 # reference face in faces bucket
    variant_count,             # 0 = swap only, 1+ = swap + variants
    settings                   # variant settings if applicable
)
```

### GPU upgrade path

When ready, only two changes needed:
1. `@modal.function(gpu="T4")` instead of `cpu=4`
2. `onnxruntime-gpu` instead of `onnxruntime`

## New Files

### Frontend
- `src/app/(dashboard)/faceswap/page.tsx` — multi-step wizard page
- `src/components/faceswap/face-selector.tsx` — saved/upload tabs, face grid
- `src/components/faceswap/face-card.tsx` — thumbnail + name + delete
- `src/components/faceswap/faceswap-settings.tsx` — swap-only toggle, variant count

### API Routes
- `src/app/api/jobs/process-faceswap/route.ts` — quota enforcement, trigger Modal
- `src/app/api/faces/route.ts` — CRUD for face profiles (GET list, POST create, DELETE)

### Modal Worker
- `src/workers/process-video/face_swapper.py` — InsightFace + GFPGAN logic
- Updated `main.py` — new `process_faceswap()` + `start_faceswap_processing()` endpoint

### Database
- `supabase/migrations/012_faceswap.sql`

## Reused Components

- `Dropzone` — file upload (video + image)
- `ProgressTracker` — real-time processing status
- Step indicator pattern from captions page
- Existing FFmpeg variant pipeline (for swap + variants mode)
- Existing image augmentation pipeline (for swap + variants mode)

## UI Structure

### Step 1 — Upload source
- Reuse `Dropzone`, accept video (MP4, MOV, <50MB) and image (JPG, PNG, WebP, <10MB)
- Detect media type from file extension

### Step 2 — Select model face
- Tab 1: **Saved Faces** — grid of `FaceCard` components, click to select
- Tab 2: **Upload New** — dropzone for single photo + name input + "Save for later" checkbox
- Validation: confirm exactly 1 face detected in reference photo

### Step 3 — Configure
- Toggle: swap-only vs swap + variants
- If variants: variant count slider
- Preview: source thumbnail with face badge overlay

### Step 4 — Processing
- Reuse `ProgressTracker` with Supabase Realtime subscription
- Download ZIP (or single file if swap-only, single variant)

## Navigation

Add "Faceswap" to the dashboard sidebar, between "Captions" and "Library".
