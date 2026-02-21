import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { triggerCaptionProcessing } from '@/lib/modal/client'
import { getPlanById } from '@/lib/crypto/plans'
import type { CaptionSettings } from '@/lib/supabase/types'

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    // Verify the user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch full job details using service client
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

    if (job.status !== 'pending') {
      return NextResponse.json({ error: 'Job has already been submitted for processing' }, { status: 409 })
    }

    if (!job.source_file_path) {
      return NextResponse.json({ error: 'Job has no source file' }, { status: 400 })
    }

    // Verify this is a photo_captions job
    if (job.job_type !== 'photo_captions') {
      return NextResponse.json(
        { error: 'Job is not a photo captions job' },
        { status: 400 }
      )
    }

    // Fetch user profile for plan enforcement
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
      // Auto-downgrade expired plan
      await serviceClient
        .from('profiles')
        .update({ plan: 'free', monthly_quota: 5, quota_used: 0, plan_expires_at: null })
        .eq('id', user.id)
      profile.plan = 'free'
      profile.monthly_quota = 5
      profile.quota_used = 0
    }

    // Atomic quota consumption — prevents race conditions
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
    const settings = job.settings as CaptionSettings
    const hasPhotos = Array.isArray(settings.photos) && settings.photos.length > 0
    const itemCount = hasPhotos ? settings.photos!.length : (settings.captions?.length ?? 0)

    if (itemCount > maxVariants) {
      if (hasPhotos) {
        settings.photos = settings.photos!.slice(0, maxVariants)
        settings.captions = settings.photos!.map(p => p.caption)
      } else {
        settings.captions = settings.captions.slice(0, maxVariants)
      }
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

    // Trigger caption processing on Modal
    const result = await triggerCaptionProcessing({
      jobId: job.id,
      sourcePath: job.source_file_path!,
      settings,
      userId: job.user_id,
    })

    if (result.status === 'error') {
      // Mark job as failed if Modal trigger fails
      await serviceClient
        .from('jobs')
        .update({
          status: 'failed',
          error_message: result.error || 'Failed to start processing',
        })
        .eq('id', jobId)

      // Refund quota since processing failed
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
    console.error('Process captions job error:', error)
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const serviceClient = createServiceClient()
        await serviceClient.rpc('refund_quota', { p_user_id: user.id })
      }
    } catch { /* best-effort */ }
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    )
  }
}
