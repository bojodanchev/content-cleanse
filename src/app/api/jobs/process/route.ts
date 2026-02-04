import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// This would trigger the Modal.com worker in production
// For now, it simulates processing progress

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Update job status to processing
    await supabase
      .from('jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    // In production, this would:
    // 1. Call Modal.com API to start the FFmpeg worker
    // 2. The worker would update progress via Supabase Realtime
    // 3. On completion, upload the ZIP to Supabase Storage

    // For demo purposes, simulate progress updates
    // This would be replaced by actual Modal.com webhook callbacks
    simulateProcessing(jobId)

    return NextResponse.json({ success: true, jobId })
  } catch (error) {
    console.error('Process job error:', error)
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    )
  }
}

// Simulation function - would be replaced by actual Modal.com processing
async function simulateProcessing(jobId: string) {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const supabase = createServiceClient()

  // Get job details
  const { data: job } = await supabase
    .from('jobs')
    .select('variant_count')
    .eq('id', jobId)
    .single()

  if (!job) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalVariants = (job as any).variant_count as number
  let completed = 0

  // Simulate progress updates
  const interval = setInterval(async () => {
    completed++
    const progress = Math.round((completed / totalVariants) * 100)

    await supabase
      .from('jobs')
      .update({
        progress,
        variants_completed: completed,
      })
      .eq('id', jobId)

    if (completed >= totalVariants) {
      clearInterval(interval)

      // Mark as completed
      await supabase
        .from('jobs')
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          output_zip_path: `${jobId}/variants.zip`, // Placeholder path
        })
        .eq('id', jobId)
    }
  }, 500) // Simulate ~0.5s per variant
}
