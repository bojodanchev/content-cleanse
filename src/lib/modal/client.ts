/**
 * Modal.com Client for Video & Caption Processing
 *
 * Calls the Modal web endpoint to trigger async processing.
 * The Modal worker handles FFmpeg transforms / Pillow rendering
 * and reports progress back via Supabase Realtime.
 */

import type { CaptionSettings } from '@/lib/supabase/types'

interface ModalJobRequest {
  jobId: string
  sourcePath: string
  variantCount: number
  settings: {
    brightness_range: [number, number]
    saturation_range: [number, number]
    hue_range: [number, number]
    crop_px_range: [number, number]
    speed_range: [number, number]
    remove_watermark: boolean
    add_watermark: boolean
    watermark_path: string | null
  }
  userId: string
}

interface ModalCaptionJobRequest {
  jobId: string
  sourcePath: string
  settings: CaptionSettings
  userId: string
}

interface ModalFaceswapJobRequest {
  jobId: string
  sourcePath: string
  sourceType: 'video' | 'image'
  facePath: string
  variantCount: number
  swapOnly: boolean
  userId: string
}

interface ModalJobResponse {
  status: 'queued' | 'error'
  callId?: string
  error?: string
}

export async function triggerVideoProcessing(
  request: ModalJobRequest
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

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: request.jobId,
        source_path: request.sourcePath,
        variant_count: request.variantCount,
        settings: request.settings,
        user_id: request.userId,
        supabase_url: supabaseUrl,
        supabase_key: supabaseKey,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Modal endpoint error (${response.status}): ${error}`)
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
    console.error('Failed to trigger Modal job:', error)
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function triggerCaptionProcessing(
  request: ModalCaptionJobRequest
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

  // Caption endpoint is at /process_captions on the same Modal app
  const captionEndpointUrl = endpointUrl.replace(
    'start-processing',
    'start-caption-processing'
  )

  try {
    const response = await fetch(captionEndpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: request.jobId,
        source_path: request.sourcePath,
        captions: request.settings.captions,
        font_size: request.settings.font_size,
        position: request.settings.position,
        generate_video: request.settings.generate_video,
        user_id: request.userId,
        supabase_url: supabaseUrl,
        supabase_key: supabaseKey,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Modal caption endpoint error (${response.status}): ${error}`)
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
    console.error('Failed to trigger Modal caption job:', error)
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

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
