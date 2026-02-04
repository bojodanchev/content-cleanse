/**
 * Modal.com Client for Video Processing
 *
 * This client handles communication with Modal.com serverless functions
 * for video processing jobs.
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
  status: 'queued' | 'running' | 'completed' | 'failed'
  callId?: string
  error?: string
}

const MODAL_API_URL = 'https://api.modal.com/v1'

export async function triggerVideoProcessing(
  request: ModalJobRequest
): Promise<ModalJobResponse> {
  const tokenId = process.env.MODAL_TOKEN_ID
  const tokenSecret = process.env.MODAL_TOKEN_SECRET

  if (!tokenId || !tokenSecret) {
    console.warn('Modal credentials not configured, using simulation mode')
    return { status: 'queued' }
  }

  try {
    // Call Modal.com function
    const response = await fetch(
      `${MODAL_API_URL}/apps/content-cleanse/process_video`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenId}:${tokenSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_id: request.jobId,
          source_path: request.sourcePath,
          variant_count: request.variantCount,
          settings: request.settings,
          user_id: request.userId,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Modal API error: ${error}`)
    }

    const result = await response.json()
    return {
      status: 'queued',
      callId: result.call_id,
    }
  } catch (error) {
    console.error('Failed to trigger Modal job:', error)
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getJobStatus(callId: string): Promise<ModalJobResponse> {
  const tokenId = process.env.MODAL_TOKEN_ID
  const tokenSecret = process.env.MODAL_TOKEN_SECRET

  if (!tokenId || !tokenSecret) {
    return { status: 'running' }
  }

  try {
    const response = await fetch(
      `${MODAL_API_URL}/functions/calls/${callId}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenId}:${tokenSecret}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get job status')
    }

    const result = await response.json()
    return {
      status: result.status,
      callId,
    }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function cancelJob(callId: string): Promise<boolean> {
  const tokenId = process.env.MODAL_TOKEN_ID
  const tokenSecret = process.env.MODAL_TOKEN_SECRET

  if (!tokenId || !tokenSecret) {
    return false
  }

  try {
    const response = await fetch(
      `${MODAL_API_URL}/functions/calls/${callId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenId}:${tokenSecret}`,
        },
      }
    )

    return response.ok
  } catch {
    return false
  }
}
