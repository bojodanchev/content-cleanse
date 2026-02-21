import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { triggerMultiplyProcessing } from '@/lib/modal/client'
import { getPlanById } from '@/lib/crypto/plans'
import type { MultiplySettings } from '@/lib/supabase/types'

export async function POST(request: Request) {
  try {
    const { jobId } = await request.json()

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

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

    if (job.status !== 'pending') {
      return NextResponse.json({ error: 'Job has already been submitted for processing' }, { status: 409 })
    }

    if (job.job_type !== 'carousel_multiply') {
      return NextResponse.json(
        { error: 'Job is not a carousel multiply job' },
        { status: 400 }
      )
    }

    const settings = job.settings as unknown as MultiplySettings

    // Validate parent job
    const { data: parentJob } = await serviceClient
      .from('jobs')
      .select('*')
      .eq('id', settings.source_job_id)
      .eq('user_id', user.id)
      .single()

    if (!parentJob || parentJob.status !== 'completed' || parentJob.job_type !== 'photo_captions') {
      return NextResponse.json(
        { error: 'Parent job must be a completed photo captions job' },
        { status: 400 }
      )
    }

    // Fetch profile for plan enforcement
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Auto-downgrade expired plans
    if (
      profile.plan !== 'free' &&
      profile.plan_expires_at &&
      new Date(profile.plan_expires_at) < new Date()
    ) {
      await serviceClient
        .from('profiles')
        .update({ plan: 'free', monthly_quota: 5, quota_used: 0, plan_expires_at: null })
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

    // Enforce variant limit
    const planConfig = getPlanById(profile.plan)
    const maxVariants = planConfig?.variantLimit ?? 10
    const totalOutput = settings.slide_count * settings.copy_count

    if (totalOutput > maxVariants) {
      await serviceClient.rpc('refund_quota', { p_user_id: user.id })
      return NextResponse.json(
        { error: `Total output (${totalOutput}) exceeds variant limit (${maxVariants})` },
        { status: 400 }
      )
    }

    // Update job status
    await serviceClient
      .from('jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    // Trigger multiply processing on Modal
    const result = await triggerMultiplyProcessing({
      jobId: job.id,
      parentJobId: settings.source_job_id,
      copyCount: settings.copy_count,
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
    console.error('Process multiply job error:', error)
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
