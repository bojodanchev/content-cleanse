/**
 * Modal.com Client for Video Processing
 *
 * Calls the Modal web endpoint to trigger async video processing.
 * The Modal worker handles FFmpeg transforms and reports progress
 * back via Supabase Realtime.
 */

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
