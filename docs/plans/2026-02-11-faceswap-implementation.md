# Faceswap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add face swapping for videos and images so agencies can apply their model's face to viral content, with optional variant generation for multi-account posting.

**Architecture:** Standalone `/faceswap` wizard page. InsightFace `inswapper_128` + GFPGAN for face swap and enhancement, running on Modal CPU containers (GPU-upgradeable). Faces saved as reusable profiles in Supabase. Follows the same patterns as the existing photo captions feature.

**Tech Stack:** Next.js 16, Supabase (Postgres + Storage + Realtime), Modal.com (InsightFace + GFPGAN + FFmpeg), shadcn/ui, Tailwind CSS 4

**Design Doc:** `docs/plans/2026-02-11-faceswap-design.md`

---

### Task 1: Database Migration — `faces` Table & Storage Bucket

**Files:**
- Create: `supabase/migrations/012_faceswap.sql`

**Step 1: Create the migration file**

```sql
-- Faceswap feature: faces table + storage bucket

-- Faces table for saved model face profiles
CREATE TABLE faces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: users see and manage only their own faces
ALTER TABLE faces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own faces"
  ON faces FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own faces"
  ON faces FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own faces"
  ON faces FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for API routes
CREATE POLICY "Service role full access to faces"
  ON faces FOR ALL USING (auth.role() = 'service_role');

-- Index for fast lookup by user
CREATE INDEX idx_faces_user_id ON faces(user_id);

-- Create faces storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('faces', 'faces', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies for faces bucket (same pattern as images bucket in 009)
CREATE POLICY "Users can upload faces" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'faces' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own faces" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'faces' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own faces" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'faces' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Service role full access to faces storage" ON storage.objects
  FOR ALL USING (
    bucket_id = 'faces' AND auth.role() = 'service_role'
  );
```

**Step 2: Apply migration to production**

Use the Supabase MCP tool `apply_migration` with name `faceswap` and the SQL above.

**Step 3: Verify**

Run `mcp__supabase__list_tables` and confirm `faces` table exists. Run `mcp__supabase__execute_sql` with `SELECT * FROM storage.buckets WHERE id = 'faces'` to confirm the bucket.

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/supabase/types.ts`

**Step 1: Add FaceswapSettings interface and update JobType**

Add after the `CaptionSettings` interface (around line 31):

```typescript
export interface FaceswapSettings {
  face_id: string
  face_path: string
  source_type: 'video' | 'image'
  swap_only: boolean
  variant_count: number
}
```

Update `JobType` (line 11) from:
```typescript
export type JobType = 'video' | 'photo_captions'
```
to:
```typescript
export type JobType = 'video' | 'photo_captions' | 'faceswap'
```

Update the `settings` field type in jobs Row/Insert/Update (lines 112, 135, 155) from:
```typescript
settings: ProcessingSettings | CaptionSettings
```
to:
```typescript
settings: ProcessingSettings | CaptionSettings | FaceswapSettings
```

**Step 2: Add `faces` table to Database interface**

Add inside `Tables` (after the `commissions` table, before the closing `}`):

```typescript
faces: {
  Row: {
    id: string
    user_id: string
    name: string
    file_path: string
    created_at: string
  }
  Insert: {
    id?: string
    user_id: string
    name: string
    file_path: string
    created_at?: string
  }
  Update: {
    id?: string
    user_id?: string
    name?: string
    file_path?: string
    created_at?: string
  }
}
```

**Step 3: Add helper type exports**

Add at the bottom with the other helper types (around line 431):

```typescript
export type Face = Database['public']['Tables']['faces']['Row']
export type FaceInsert = Database['public']['Tables']['faces']['Insert']
```

**Step 4: Verify**

Run: `npx tsc --noEmit` — should pass with no errors.

---

### Task 3: Update Plan Configuration

**Files:**
- Modify: `src/lib/crypto/plans.ts`

**Step 1: Add `faceswapLimit` to Plan interface**

Update the `Plan` interface to add the faceswap limit:

```typescript
export interface Plan {
  id: string
  name: string
  description: string
  price: number
  features: string[]
  quota: number
  variantLimit: number
  faceswapLimit: number
  popular?: boolean
}
```

**Step 2: Add `faceswapLimit` to each plan**

Update each plan object:

- Free plan: add `faceswapLimit: 2`
- Pro plan: add `faceswapLimit: 50`
- Agency plan: add `faceswapLimit: 10000` (effectively unlimited)

Also add `'2 face swaps per month'` to Free features, `'50 face swaps per month'` to Pro features, and `'Unlimited face swaps'` to Agency features.

**Step 3: Verify**

Run: `npx tsc --noEmit` — should pass.

---

### Task 4: Faces API Route (CRUD)

**Files:**
- Create: `src/app/api/faces/route.ts`

**Step 1: Create the faces API route**

```typescript
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/faces — list user's saved faces
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: faces, error } = await supabase
      .from('faces')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch faces' }, { status: 500 })
    }

    return NextResponse.json({ faces })
  } catch (error) {
    console.error('List faces error:', error)
    return NextResponse.json({ error: 'Failed to fetch faces' }, { status: 500 })
  }
}

// POST /api/faces — save a new face profile
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, filePath } = await request.json()

    if (!name || !filePath) {
      return NextResponse.json({ error: 'Name and file path required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data: face, error } = await serviceClient
      .from('faces')
      .insert({
        user_id: user.id,
        name,
        file_path: filePath,
      })
      .select()
      .single()

    if (error) {
      console.error('Create face error:', error)
      return NextResponse.json({ error: 'Failed to save face' }, { status: 500 })
    }

    return NextResponse.json({ face })
  } catch (error) {
    console.error('Create face error:', error)
    return NextResponse.json({ error: 'Failed to save face' }, { status: 500 })
  }
}

// DELETE /api/faces — delete a face profile
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { faceId } = await request.json()

    if (!faceId) {
      return NextResponse.json({ error: 'Face ID required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Fetch face to get file path for storage cleanup
    const { data: face } = await serviceClient
      .from('faces')
      .select('*')
      .eq('id', faceId)
      .eq('user_id', user.id)
      .single()

    if (!face) {
      return NextResponse.json({ error: 'Face not found' }, { status: 404 })
    }

    // Delete from storage
    await serviceClient.storage.from('faces').remove([face.file_path])

    // Delete from database
    await serviceClient
      .from('faces')
      .delete()
      .eq('id', faceId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete face error:', error)
    return NextResponse.json({ error: 'Failed to delete face' }, { status: 500 })
  }
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit` — should pass.

---

### Task 5: Modal Client — Add Faceswap Trigger

**Files:**
- Modify: `src/lib/modal/client.ts`

**Step 1: Add the faceswap request interface and trigger function**

Add after the existing `ModalCaptionJobRequest` interface (around line 33):

```typescript
interface ModalFaceswapJobRequest {
  jobId: string
  sourcePath: string
  sourceType: 'video' | 'image'
  facePath: string
  variantCount: number
  swapOnly: boolean
  userId: string
}
```

Add after the `triggerCaptionProcessing` function (at the end of the file):

```typescript
export async function triggerFaceswapProcessing(
  request: ModalFaceswapJobRequest
): Promise<ModalJobResponse> {
  const endpointUrl = process.env.MODAL_ENDPOINT_URL

  if (!endpointUrl) {
    console.error('MODAL_ENDPOINT_URL not configured')
    return { status: 'error', error: 'Modal endpoint not configured' }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not configured')
    return { status: 'error', error: 'Supabase credentials not configured' }
  }

  // Faceswap endpoint on the same Modal app
  const faceswapEndpointUrl = endpointUrl.replace(
    'start-processing',
    'start-faceswap-processing'
  )

  try {
    const response = await fetch(faceswapEndpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: request.jobId,
        source_path: request.sourcePath,
        source_type: request.sourceType,
        face_path: request.facePath,
        variant_count: request.variantCount,
        swap_only: request.swapOnly,
        user_id: request.userId,
        supabase_url: supabaseUrl,
        supabase_key: supabaseKey,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Modal faceswap endpoint error (${response.status}): ${error}`)
    }

    const result = await response.json()

    if (result.status === 'error') {
      return { status: 'error', error: result.error }
    }

    return {
      status: 'queued',
      callId: result.call_id,
    }
  } catch (error) {
    console.error('Failed to trigger Modal faceswap job:', error)
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit` — should pass.

---

### Task 6: Process Faceswap API Route

**Files:**
- Create: `src/app/api/jobs/process-faceswap/route.ts`

**Step 1: Create the API route**

This follows the exact same pattern as `src/app/api/jobs/process-captions/route.ts` with faceswap-specific logic.

```typescript
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { triggerFaceswapProcessing } from '@/lib/modal/client'
import { getPlanById } from '@/lib/crypto/plans'
import type { FaceswapSettings } from '@/lib/supabase/types'

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createServiceClient()
    const { data: job, error: jobError } = await serviceClient
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.job_type !== 'faceswap') {
      return NextResponse.json(
        { error: 'Job is not a faceswap job' },
        { status: 400 }
      )
    }

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // --- PLAN ENFORCEMENT ---

    // Check plan expiry
    if (
      profile.plan !== 'free' &&
      profile.plan_expires_at &&
      new Date(profile.plan_expires_at) < new Date()
    ) {
      await serviceClient
        .from('profiles')
        .update({ plan: 'free', monthly_quota: 5, quota_used: 0 })
        .eq('id', user.id)
      profile.plan = 'free'
      profile.monthly_quota = 5
      profile.quota_used = 0
    }

    // Atomic quota consumption
    const { data: quotaConsumed } = await serviceClient.rpc('try_consume_quota', {
      p_user_id: user.id,
    })

    if (!quotaConsumed) {
      return NextResponse.json(
        { error: 'Monthly quota exceeded. Upgrade your plan for more jobs.' },
        { status: 403 }
      )
    }

    // Enforce variant count limit based on plan
    const planConfig = getPlanById(profile.plan)
    const maxVariants = planConfig?.variantLimit ?? 10
    const settings = job.settings as FaceswapSettings

    if (!settings.swap_only && settings.variant_count > maxVariants) {
      settings.variant_count = maxVariants
      await serviceClient
        .from('jobs')
        .update({
          variant_count: maxVariants,
          settings: settings as unknown as Record<string, unknown>,
        })
        .eq('id', jobId)
      job.variant_count = maxVariants
    }

    // --- END PLAN ENFORCEMENT ---

    // Update job status to processing
    await serviceClient
      .from('jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    // Trigger faceswap processing on Modal
    const result = await triggerFaceswapProcessing({
      jobId: job.id,
      sourcePath: job.source_file_path!,
      sourceType: settings.source_type,
      facePath: settings.face_path,
      variantCount: settings.swap_only ? 0 : settings.variant_count,
      swapOnly: settings.swap_only,
      userId: job.user_id,
    })

    if (result.status === 'error') {
      await serviceClient
        .from('jobs')
        .update({
          status: 'failed',
          error_message: result.error || 'Failed to start processing',
        })
        .eq('id', jobId)

      await serviceClient.rpc('refund_quota', { p_user_id: user.id })

      return NextResponse.json(
        { error: result.error || 'Failed to start processing' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      jobId,
      callId: result.callId,
    })
  } catch (error) {
    console.error('Process faceswap job error:', error)
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit` — should pass.

---

### Task 7: Update Job Create Route for Faceswap

**Files:**
- Modify: `src/app/api/jobs/create/route.ts`

**Step 1: Add faceswap handling**

In `src/app/api/jobs/create/route.ts`, the route already handles `video` and `photo_captions` job types. Add a third branch for `faceswap`.

After the `if (isPhotoCaptions)` block (around line 47), add an `else if` for faceswap:

```typescript
const isPhotoCaptions = jobType === 'photo_captions'
const isFaceswap = jobType === 'faceswap'

let jobData

if (isFaceswap) {
  // Faceswap job — store face settings
  jobData = {
    user_id: user.id,
    job_type: 'faceswap' as const,
    status: 'pending' as const,
    source_file_path: filePath,
    source_file_name: fileName,
    source_file_size: fileSize || 0,
    variant_count: settings?.swap_only ? 1 : Math.min(Math.max(1, variantCount || 1), maxVariants),
    settings: settings || {},
  }
} else if (isPhotoCaptions) {
  // ... existing photo_captions code ...
} else {
  // ... existing video code ...
}
```

Note: Keep the existing `isPhotoCaptions` and video blocks unchanged. Just add the `isFaceswap` check before them and extract `const isFaceswap = jobType === 'faceswap'` alongside the existing `isPhotoCaptions` line.

**Step 2: Verify**

Run: `npx tsc --noEmit` — should pass.

---

### Task 8: Face Swapper Python Module

**Files:**
- Create: `src/workers/process-video/face_swapper.py`

**Step 1: Create the face swapper helper**

This module handles InsightFace detection, swap, and GFPGAN enhancement. It will be bundled into the Modal container image.

```python
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
INSIGHTFACE_DIR = os.path.join(MODELS_DIR, "insightface")
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
```

**Step 2: Verify**

File is Python, no build check needed — it will be validated when the Modal image builds.

---

### Task 9: Update Modal Worker — `process_faceswap` + Endpoint

**Files:**
- Modify: `src/workers/process-video/main.py`

**Step 1: Update the container image**

Replace the existing `image` definition (lines 30-43) with a new one that includes InsightFace, GFPGAN, OpenCV, and downloads the model files at build time:

```python
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
        "gfpgan",
        "basicsr",
        "facexlib",
    )
    .add_local_dir(str(_worker_dir / "fonts"), remote_path="/assets/fonts")
    .add_local_file(str(_worker_dir / "text_renderer.py"), remote_path="/helpers/text_renderer.py")
    .add_local_file(str(_worker_dir / "image_augmenter.py"), remote_path="/helpers/image_augmenter.py")
    .add_local_file(str(_worker_dir / "face_swapper.py"), remote_path="/helpers/face_swapper.py")
    .run_commands(
        # Download InsightFace buffalo_l model
        "mkdir -p /models/insightface/models/buffalo_l && "
        "python -c \""
        "from insightface.utils.storage import download_onnx; "
        "import insightface; "
        "app = insightface.app.FaceAnalysis(name='buffalo_l', root='/models/insightface'); "
        "app.prepare(ctx_id=0, det_size=(640, 640))"
        "\"",
        # Download inswapper_128 model
        "pip install huggingface_hub && "
        "python -c \""
        "from huggingface_hub import hf_hub_download; "
        "hf_hub_download(repo_id='deepinsight/inswapper', filename='inswapper_128.onnx', local_dir='/models')"
        "\"",
        # Download GFPGAN model
        "python -c \""
        "from basicsr.utils.download_util import load_file_from_url; "
        "load_file_from_url("
        "  'https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth', "
        "  model_dir='/models', file_name='GFPGANv1.4.pth')"
        "\""
    )
)
```

**Important note:** The exact download commands may need adjustment based on the model hosting. The InsightFace `buffalo_l` model auto-downloads on first `prepare()` call, and inswapper is available from HuggingFace. GFPGAN is downloadable from GitHub releases. These commands run at container build time, so models are baked in.

**Step 2: Add `process_faceswap` function**

Add after the `process_captions` function (before the `_generate_slideshow` helper):

```python
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
```

**Step 3: Add the FastAPI endpoint**

Add after the existing `start_caption_processing` endpoint:

```python
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
```

**Step 4: Verify**

Run: `python -c "import ast; ast.parse(open('src/workers/process-video/main.py').read())"` to verify Python syntax.

---

### Task 10: FaceCard Component

**Files:**
- Create: `src/components/faceswap/face-card.tsx`

**Step 1: Create the face card component**

```tsx
'use client'

import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Face } from '@/lib/supabase/types'

interface FaceCardProps {
  face: Face
  selected: boolean
  onSelect: (face: Face) => void
  onDelete: (faceId: string) => void
  thumbnailUrl: string | null
}

export function FaceCard({ face, selected, onSelect, onDelete, thumbnailUrl }: FaceCardProps) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleting(true)
    await onDelete(face.id)
    setDeleting(false)
  }

  return (
    <button
      onClick={() => onSelect(face)}
      className={cn(
        'relative group rounded-xl border-2 p-3 transition-all text-left w-full',
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border/50 hover:border-primary/50 bg-card/50'
      )}
    >
      <div className="aspect-square rounded-lg overflow-hidden bg-secondary/30 mb-2">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={face.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-2xl font-bold">
            {face.name[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <p className="text-sm font-medium truncate">{face.name}</p>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        disabled={deleting}
        className="absolute top-1 right-1 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive/80 hover:bg-destructive text-white"
      >
        {deleting ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Trash2 className="w-3 h-3" />
        )}
      </Button>
    </button>
  )
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit` — should pass.

---

### Task 11: FaceSelector Component

**Files:**
- Create: `src/components/faceswap/face-selector.tsx`

**Step 1: Create the face selector with saved/upload tabs**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, Users, Loader2, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FaceCard } from '@/components/faceswap/face-card'
import { getClient } from '@/lib/supabase/client'
import { cn, formatBytes } from '@/lib/utils'
import { useDropzone } from 'react-dropzone'
import type { Face } from '@/lib/supabase/types'

interface FaceSelectorProps {
  selectedFace: Face | null
  onFaceSelect: (face: Face | null) => void
  onNewFaceUpload: (file: File, name: string, saveFace: boolean) => void
  uploadedFaceFile: File | null
  uploadedFaceName: string
  onUploadedFaceNameChange: (name: string) => void
  saveFaceForLater: boolean
  onSaveFaceForLaterChange: (save: boolean) => void
}

const ACCEPTED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

const MAX_FACE_SIZE = 10 * 1024 * 1024 // 10MB

export function FaceSelector({
  selectedFace,
  onFaceSelect,
  onNewFaceUpload,
  uploadedFaceFile,
  uploadedFaceName,
  onUploadedFaceNameChange,
  saveFaceForLater,
  onSaveFaceForLaterChange,
}: FaceSelectorProps) {
  const [tab, setTab] = useState<'saved' | 'upload'>('saved')
  const [faces, setFaces] = useState<Face[]>([])
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const supabase = getClient()

  useEffect(() => {
    loadFaces()
  }, [])

  // Generate preview for uploaded face file
  useEffect(() => {
    if (uploadedFaceFile) {
      const url = URL.createObjectURL(uploadedFaceFile)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [uploadedFaceFile])

  const loadFaces = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/faces')
      if (!response.ok) throw new Error('Failed to load faces')
      const { faces: loadedFaces } = await response.json()
      setFaces(loadedFaces || [])

      // Generate signed URLs for thumbnails
      const urls: Record<string, string> = {}
      for (const face of loadedFaces || []) {
        try {
          const { data } = await supabase.storage
            .from('faces')
            .createSignedUrl(face.file_path, 3600)
          if (data?.signedUrl) {
            urls[face.id] = data.signedUrl
          }
        } catch {
          // Skip failed thumbnails
        }
      }
      setThumbnailUrls(urls)
    } catch (err) {
      console.error('Failed to load faces:', err)
      setError('Failed to load saved faces')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteFace = async (faceId: string) => {
    try {
      const response = await fetch('/api/faces', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceId }),
      })
      if (!response.ok) throw new Error('Failed to delete face')

      setFaces((prev) => prev.filter((f) => f.id !== faceId))
      if (selectedFace?.id === faceId) {
        onFaceSelect(null)
      }
    } catch (err) {
      console.error('Delete face error:', err)
    }
  }

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: unknown[]) => {
      setError(null)
      if (rejectedFiles.length > 0) {
        setError('Invalid file. Please upload a JPG, PNG, or WebP image under 10MB.')
        return
      }
      if (acceptedFiles.length > 0) {
        onNewFaceUpload(acceptedFiles[0], uploadedFaceName || 'New Face', saveFaceForLater)
        // Switch to upload tab to show the preview
        setTab('upload')
      }
    },
    [uploadedFaceName, saveFaceForLater]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_IMAGE_TYPES,
    maxSize: MAX_FACE_SIZE,
    multiple: false,
  })

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-secondary/30 rounded-lg">
        <button
          onClick={() => setTab('saved')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            tab === 'saved'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="w-4 h-4" />
          Saved Faces
          {faces.length > 0 && (
            <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
              {faces.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('upload')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            tab === 'upload'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Upload className="w-4 h-4" />
          Upload New
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Saved Faces Tab */}
      {tab === 'saved' && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : faces.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No saved faces yet</p>
              <p className="text-sm mt-1">Upload a face in the &quot;Upload New&quot; tab to save it for reuse</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {faces.map((face) => (
                <FaceCard
                  key={face.id}
                  face={face}
                  selected={selectedFace?.id === face.id}
                  onSelect={onFaceSelect}
                  onDelete={handleDeleteFace}
                  thumbnailUrl={thumbnailUrls[face.id] || null}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload New Tab */}
      {tab === 'upload' && (
        <div className="space-y-4">
          {uploadedFaceFile ? (
            <div className="relative rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-4">
              <div className="flex items-center gap-4">
                {previewUrl && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-border/50 shrink-0">
                    <img src={previewUrl} alt="Face preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{uploadedFaceFile.name}</p>
                  <p className="text-sm text-muted-foreground">{formatBytes(uploadedFaceFile.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onNewFaceUpload(null as unknown as File, '', false)}
                  className="shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={cn(
                'rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer text-center',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border/50 hover:border-primary/50'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Drop a face photo here</p>
              <p className="text-sm text-muted-foreground mt-1">
                Clear, front-facing photo with one face. JPG/PNG/WebP under 10MB.
              </p>
            </div>
          )}

          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="face-name">Face Name</Label>
            <Input
              id="face-name"
              placeholder="e.g., Jessica, Model A"
              value={uploadedFaceName}
              onChange={(e) => onUploadedFaceNameChange(e.target.value)}
            />
          </div>

          {/* Save for later checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveFaceForLater}
              onChange={(e) => onSaveFaceForLaterChange(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm">Save this face for future jobs</span>
          </label>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit` — should pass.

---

### Task 12: FaceswapSettings Component

**Files:**
- Create: `src/components/faceswap/faceswap-settings.tsx`

**Step 1: Create the settings component**

```tsx
'use client'

import { motion } from 'framer-motion'
import { Layers, Shield } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

export interface FaceswapSettingsValues {
  swapOnly: boolean
  variantCount: number
}

interface FaceswapSettingsProps {
  settings: FaceswapSettingsValues
  onChange: (settings: FaceswapSettingsValues) => void
  maxVariants: number
  sourcePreviewUrl: string | null
  facePreviewUrl: string | null
}

export function FaceswapSettings({
  settings,
  onChange,
  maxVariants,
  sourcePreviewUrl,
  facePreviewUrl,
}: FaceswapSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Preview */}
      {(sourcePreviewUrl || facePreviewUrl) && (
        <div className="flex items-center justify-center gap-4">
          {sourcePreviewUrl && (
            <div className="text-center">
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-border/50 mx-auto mb-1">
                <img src={sourcePreviewUrl} alt="Source" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs text-muted-foreground">Source</span>
            </div>
          )}
          {sourcePreviewUrl && facePreviewUrl && (
            <span className="text-2xl text-muted-foreground">→</span>
          )}
          {facePreviewUrl && (
            <div className="text-center">
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-primary/50 mx-auto mb-1">
                <img src={facePreviewUrl} alt="Face" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs text-primary">Model Face</span>
            </div>
          )}
        </div>
      )}

      {/* Swap mode toggle */}
      <div className="space-y-3">
        <Label className="text-base font-medium flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          Output Mode
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onChange({ ...settings, swapOnly: true })}
            className={cn(
              'p-4 rounded-xl border text-left transition-all',
              settings.swapOnly
                ? 'border-primary bg-primary/10'
                : 'border-border/50 bg-card/50 hover:border-primary/30'
            )}
          >
            <p className="font-medium">Swap Only</p>
            <p className="text-sm text-muted-foreground mt-1">
              One output with the face swapped
            </p>
          </button>
          <button
            onClick={() => onChange({ ...settings, swapOnly: false, variantCount: Math.max(settings.variantCount, 2) })}
            className={cn(
              'p-4 rounded-xl border text-left transition-all',
              !settings.swapOnly
                ? 'border-primary bg-primary/10'
                : 'border-border/50 bg-card/50 hover:border-primary/30'
            )}
          >
            <p className="font-medium">Swap + Variants</p>
            <p className="text-sm text-muted-foreground mt-1">
              Swap face, then create unique variants
            </p>
          </button>
        </div>
      </div>

      {/* Variant count slider */}
      {!settings.swapOnly && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Variant Count</Label>
            <span className="text-sm font-medium text-primary">{settings.variantCount}</span>
          </div>
          <Slider
            value={[settings.variantCount]}
            onValueChange={([value]) => onChange({ ...settings, variantCount: value })}
            min={2}
            max={maxVariants}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            Each variant gets unique visual tweaks (brightness, color, crop) for platform detection bypass
          </p>
        </motion.div>
      )}

      {/* Summary */}
      <div className="rounded-xl bg-secondary/30 border border-border/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-accent" />
          <span className="font-medium">Processing Summary</span>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center justify-between">
            <span>Mode</span>
            <span className="font-medium text-foreground">
              {settings.swapOnly ? 'Swap only' : 'Swap + variants'}
            </span>
          </li>
          {!settings.swapOnly && (
            <li className="flex items-center justify-between">
              <span>Variants</span>
              <span className="font-medium text-foreground">{settings.variantCount}</span>
            </li>
          )}
          <li className="flex items-center justify-between">
            <span>Output files</span>
            <span className="font-medium text-foreground">
              {settings.swapOnly ? 1 : settings.variantCount}
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit` — should pass.

---

### Task 13: Faceswap Page (Wizard)

**Files:**
- Create: `src/app/(dashboard)/faceswap/page.tsx`

**Step 1: Create the faceswap page**

This is the main page — follows the same multi-step wizard pattern as `/captions/page.tsx`. Due to its size, the full component code is provided below. Key differences from the captions page:

- Step 1: Upload accepts both video AND image files
- Step 2: FaceSelector instead of CaptionEditor
- Step 3: FaceswapSettings instead of CaptionSettings
- Step 4: Same ProgressTracker

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ArrowLeft,
  Zap,
  Loader2,
  X,
  File as FileIcon,
  Repeat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FaceSelector } from '@/components/faceswap/face-selector'
import { FaceswapSettings, FaceswapSettingsValues } from '@/components/faceswap/faceswap-settings'
import { ProgressTracker } from '@/components/upload/progress-tracker'
import { getClient } from '@/lib/supabase/client'
import { cn, formatBytes } from '@/lib/utils'
import { useDropzone } from 'react-dropzone'
import { getPlanById } from '@/lib/crypto/plans'
import type { Job, Profile, Face } from '@/lib/supabase/types'

type ViewState = 'upload' | 'face' | 'settings' | 'processing'

const ACCEPTED_TYPES = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const STEPS = [
  { id: 'upload', label: 'Upload', num: 1 },
  { id: 'face', label: 'Face', num: 2 },
  { id: 'settings', label: 'Settings', num: 3 },
  { id: 'processing', label: 'Processing', num: 4 },
]

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

export default function FaceswapPage() {
  const [view, setView] = useState<ViewState>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [currentJob, setCurrentJob] = useState<Job | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Face state
  const [selectedFace, setSelectedFace] = useState<Face | null>(null)
  const [uploadedFaceFile, setUploadedFaceFile] = useState<File | null>(null)
  const [uploadedFaceName, setUploadedFaceName] = useState('')
  const [saveFaceForLater, setSaveFaceForLater] = useState(true)
  const [facePreviewUrl, setFacePreviewUrl] = useState<string | null>(null)

  // Settings state
  const [faceswapSettings, setFaceswapSettings] = useState<FaceswapSettingsValues>({
    swapOnly: false,
    variantCount: 10,
  })

  const supabase = getClient()

  useEffect(() => { loadProfile() }, [])

  useEffect(() => {
    if (selectedFile) {
      if (!isVideoFile(selectedFile)) {
        const url = URL.createObjectURL(selectedFile)
        setPreviewUrl(url)
        return () => URL.revokeObjectURL(url)
      }
    }
    setPreviewUrl(null)
  }, [selectedFile])

  // Face preview from saved face
  useEffect(() => {
    if (selectedFace) {
      supabase.storage
        .from('faces')
        .createSignedUrl(selectedFace.file_path, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setFacePreviewUrl(data.signedUrl)
        })
    } else if (uploadedFaceFile) {
      const url = URL.createObjectURL(uploadedFaceFile)
      setFacePreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setFacePreviewUrl(null)
    }
  }, [selectedFace, uploadedFaceFile])

  // Realtime subscription for job updates
  useEffect(() => {
    if (!currentJob) return

    const channel = supabase
      .channel(`faceswap-job-${currentJob.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${currentJob.id}`,
        },
        (payload) => { setCurrentJob(payload.new as Job) }
      )
      .subscribe()

    const staleCheckInterval = setInterval(() => {
      if (currentJob.status === 'processing' && currentJob.created_at) {
        const elapsed = Date.now() - new Date(currentJob.created_at).getTime()
        if (elapsed > 15 * 60 * 1000) {
          setCurrentJob((prev) =>
            prev ? { ...prev, status: 'failed' as const, error_message: 'Processing timed out. Please try again.' } : prev
          )
        }
      }
    }, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(staleCheckInterval)
    }
  }, [currentJob?.id])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setProfile(data)
  }

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: unknown[]) => {
    setError(null)
    if (rejectedFiles.length > 0) {
      setError('Invalid file. Upload a video (MP4, MOV) or image (JPG, PNG, WebP) under 50MB.')
      return
    }
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: uploading,
  })

  const handleClearFile = () => {
    setSelectedFile(null)
    setError(null)
  }

  const handleFaceUpload = (file: File, name: string, save: boolean) => {
    setUploadedFaceFile(file)
    setUploadedFaceName(name)
    setSaveFaceForLater(save)
    setSelectedFace(null) // Deselect saved face when uploading new one
  }

  const handleStartProcessing = async () => {
    if (!selectedFile || !profile || (!selectedFace && !uploadedFaceFile)) return

    setView('processing')
    setUploading(true)

    try {
      const sourceType = isVideoFile(selectedFile) ? 'video' : 'image'
      const bucket = sourceType === 'video' ? 'videos' : 'images'

      // Upload source file
      const sourceFileName = `${profile.id}/${Date.now()}-${selectedFile.name}`
      const { error: uploadError } = await supabase.storage.from(bucket).upload(sourceFileName, selectedFile)
      if (uploadError) throw uploadError

      // Upload face (if new) and get face path
      let facePath: string
      let faceId: string | null = null

      if (selectedFace) {
        facePath = selectedFace.file_path
        faceId = selectedFace.id
      } else if (uploadedFaceFile) {
        facePath = `${profile.id}/${Date.now()}-face-${uploadedFaceFile.name}`
        const { error: faceUploadError } = await supabase.storage.from('faces').upload(facePath, uploadedFaceFile)
        if (faceUploadError) throw faceUploadError

        // Save face profile if requested
        if (saveFaceForLater && uploadedFaceName.trim()) {
          const saveResponse = await fetch('/api/faces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: uploadedFaceName.trim(), filePath: facePath }),
          })
          if (saveResponse.ok) {
            const { face } = await saveResponse.json()
            faceId = face.id
          }
        }
      } else {
        throw new Error('No face selected')
      }

      // Create job
      const createResponse = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: sourceFileName,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          variantCount: faceswapSettings.swapOnly ? 1 : faceswapSettings.variantCount,
          jobType: 'faceswap',
          settings: {
            face_id: faceId,
            face_path: facePath,
            source_type: sourceType,
            swap_only: faceswapSettings.swapOnly,
            variant_count: faceswapSettings.swapOnly ? 1 : faceswapSettings.variantCount,
          },
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create job')
      }

      const { job } = await createResponse.json()
      setCurrentJob(job)
      setUploading(false)

      // Trigger processing
      const processResponse = await fetch('/api/jobs/process-faceswap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({}))
        setCurrentJob({
          ...job,
          status: 'failed',
          error_message: errorData.error || 'Failed to start processing',
        })
      }
    } catch (err) {
      console.error('Error starting faceswap job:', err)
      setUploading(false)
      setView('settings')
      setError(err instanceof Error ? err.message : 'Failed to start processing')
    }
  }

  const handleDownload = async () => {
    if (!currentJob || !profile) return

    try {
      if (currentJob.output_zip_path) {
        const { data } = await supabase.storage.from('outputs').createSignedUrl(currentJob.output_zip_path, 3600)
        if (data?.signedUrl) {
          const a = document.createElement('a')
          a.href = data.signedUrl
          a.download = `${currentJob.source_file_name || 'faceswap'}_result.zip`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          return
        }
      }

      // Fallback: build ZIP client-side
      const { data: files } = await supabase.storage.from('outputs').list(`${profile.id}/${currentJob.id}`, {
        sortBy: { column: 'name', order: 'asc' },
      })

      if (!files?.length) {
        alert('No output files found for this job.')
        return
      }

      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()

      for (const file of files) {
        const { data } = await supabase.storage.from('outputs').download(`${profile.id}/${currentJob.id}/${file.name}`)
        if (data) zip.file(file.name, data)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(currentJob.source_file_name || 'faceswap').replace(/\.[^.]+$/, '')}_result.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Download failed. Please try again.')
    }
  }

  const handleNewJob = () => {
    setView('upload')
    setSelectedFile(null)
    setCurrentJob(null)
    setSelectedFace(null)
    setUploadedFaceFile(null)
    setUploadedFaceName('')
    setSaveFaceForLater(true)
    setFaceswapSettings({ swapOnly: false, variantCount: 10 })
    setError(null)
  }

  const stepIndex = STEPS.findIndex((s) => s.id === view)
  const hasFaceSelected = !!selectedFace || !!uploadedFaceFile
  const planConfig = profile ? getPlanById(profile.plan) : null
  const maxVariants = planConfig?.variantLimit ?? 10

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Face Swap</h1>
        <p className="text-muted-foreground">
          Swap faces in videos and photos with your model&apos;s face
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  i < stepIndex ? 'bg-primary text-white'
                    : i === stepIndex ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {step.num}
              </div>
              <span className={cn('mt-1.5 text-xs', i <= stepIndex ? 'text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('w-16 h-0.5 mx-2 mb-5', i < stepIndex ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      <div className="max-w-3xl mx-auto">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>
              {view === 'upload' ? 'Upload Source Media'
                : view === 'face' ? 'Select Model Face'
                : view === 'settings' ? 'Configure Output'
                : 'Processing'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {/* Step 1: Upload */}
              {view === 'upload' && (
                <motion.div key="upload" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                  {selectedFile ? (
                    <div className="relative rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 p-6">
                      <div className="flex items-start gap-4">
                        {previewUrl && (
                          <div className="w-24 h-24 rounded-xl overflow-hidden border border-border/50 shrink-0">
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                        {isVideoFile(selectedFile) && (
                          <div className="w-24 h-24 rounded-xl border border-border/50 shrink-0 bg-secondary/50 flex items-center justify-center">
                            <FileIcon className="w-10 h-10 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">{formatBytes(selectedFile.size)}</p>
                          <p className="text-xs text-primary mt-1">
                            {isVideoFile(selectedFile) ? 'Video' : 'Image'}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleClearFile} className="shrink-0">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      {...getRootProps()}
                      className={cn(
                        'relative rounded-2xl border-2 border-dashed p-12 transition-colors cursor-pointer',
                        isDragActive ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/50 hover:bg-card/50'
                      )}
                    >
                      <input {...getInputProps()} />
                      <div className="text-center">
                        <motion.div
                          animate={{ scale: isDragActive ? 1.1 : 1, y: isDragActive ? -5 : 0 }}
                          className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6"
                        >
                          <Repeat className="w-10 h-10 text-primary" />
                        </motion.div>
                        {isDragActive ? (
                          <p className="text-xl font-medium text-primary">Drop your file here</p>
                        ) : (
                          <>
                            <p className="text-xl font-medium mb-2">Drag & drop your video or photo</p>
                            <p className="text-muted-foreground mb-4">or click to browse files</p>
                            <p className="text-sm text-muted-foreground">MP4, MOV, JPG, PNG, WebP up to 50MB</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {error && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive">{error}</motion.p>
                  )}

                  {selectedFile && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                      <Button onClick={() => { setError(null); setView('face') }} className="bg-gradient-to-r from-primary to-primary/80">
                        Continue <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Step 2: Face Selection */}
              {view === 'face' && (
                <motion.div key="face" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                  <FaceSelector
                    selectedFace={selectedFace}
                    onFaceSelect={setSelectedFace}
                    onNewFaceUpload={handleFaceUpload}
                    uploadedFaceFile={uploadedFaceFile}
                    uploadedFaceName={uploadedFaceName}
                    onUploadedFaceNameChange={setUploadedFaceName}
                    saveFaceForLater={saveFaceForLater}
                    onSaveFaceForLaterChange={setSaveFaceForLater}
                  />

                  {error && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive">{error}</motion.p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    <Button variant="ghost" onClick={() => setView('upload')}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                      onClick={() => { setError(null); setView('settings') }}
                      disabled={!hasFaceSelected}
                      className="bg-gradient-to-r from-primary to-primary/80"
                    >
                      Continue <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Settings */}
              {view === 'settings' && (
                <motion.div key="settings" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                  <FaceswapSettings
                    settings={faceswapSettings}
                    onChange={setFaceswapSettings}
                    maxVariants={maxVariants}
                    sourcePreviewUrl={previewUrl}
                    facePreviewUrl={facePreviewUrl}
                  />

                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    <Button variant="ghost" onClick={() => setView('face')}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                      onClick={handleStartProcessing}
                      disabled={uploading}
                      className="bg-gradient-to-r from-primary to-primary/80"
                    >
                      {uploading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                      ) : (
                        <>Start Processing <Zap className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Processing */}
              {view === 'processing' && currentJob && (
                <motion.div key="processing" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <ProgressTracker job={currentJob} onDownload={handleDownload} onNewJob={handleNewJob} />
                </motion.div>
              )}

              {view === 'processing' && !currentJob && (
                <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                  <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
                  <p className="text-lg font-medium">Uploading files...</p>
                  <p className="text-sm text-muted-foreground mt-1">Please wait while we upload your media</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit` — should pass.

---

### Task 14: Update Dashboard Layout — Add Navigation Item

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Add Faceswap to the navigation array**

In `src/app/(dashboard)/layout.tsx`, update the imports to include the `Repeat` icon (line 8):

```typescript
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  Zap,
  ImagePlus,
  Repeat,
} from 'lucide-react'
```

Update the `navigation` array (line 15) to add Faceswap between Photo Captions and Library:

```typescript
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Photo Captions', href: '/captions', icon: ImagePlus },
  { name: 'Face Swap', href: '/faceswap', icon: Repeat },
  { name: 'Library', href: '/library', icon: FolderOpen },
  { name: 'Settings', href: '/settings', icon: Settings },
]
```

**Step 2: Verify**

Run: `npx tsc --noEmit` — should pass.

---

### Task 15: Build Verification & Deploy

**Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no errors. There may be warnings about unused imports — fix any that appear.

**Step 2: Test locally**

```bash
npm run dev
```

Navigate to `http://localhost:3000/faceswap` and verify:
- Page renders with 4-step wizard
- Can upload a source file (video or image)
- Can navigate to face selection step
- Can upload a new face photo
- Can configure settings (swap-only toggle, variant slider)
- Navigation sidebar shows "Face Swap" between "Photo Captions" and "Library"

**Step 3: Deploy Modal worker**

```bash
modal deploy src/workers/process-video/main.py
```

This will build the new container image with InsightFace, GFPGAN, and model downloads. It will take longer than usual (~5-10 min) due to model downloads during image build.

**Step 4: Apply database migration**

Use the Supabase MCP tool to apply migration 012.

**Step 5: Deploy to Vercel**

```bash
git add -A && git commit -m "feat: face swap feature" && git push
```

Vercel will auto-deploy from the push.

**Step 6: Verify production**

Navigate to `https://content-cleanse.vercel.app/faceswap` and verify the page loads.

---

## Dependency Order

```
Task 1 (DB migration) ─┐
Task 2 (Types)         ─┤
Task 3 (Plans)         ─┤─→ Task 4 (Faces API)
                        │─→ Task 5 (Modal client) ─→ Task 6 (Process API)
                        │─→ Task 7 (Job create update)
                        │
Task 8 (face_swapper.py) ─→ Task 9 (Modal worker update)
                        │
Task 10 (FaceCard)     ─→ Task 11 (FaceSelector) ─┐
Task 12 (Settings)     ────────────────────────────┤─→ Task 13 (Faceswap page)
                                                   │─→ Task 14 (Nav update)
                                                   └─→ Task 15 (Build & Deploy)
```

Tasks 1-3, 8, 10, 12 can all be done in parallel as they have no dependencies on each other.
