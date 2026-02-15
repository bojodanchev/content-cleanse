import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { triggerVideoProcessing } from '@/lib/modal/client'
import { getPlanById } from '@/lib/crypto/plans'

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
        { error: 'Monthly quota exceeded. Upgrade your plan for more videos.' },
        { status: 403 }
      )
    }

    // Enforce variant count limit based on plan
    const planConfig = getPlanById(profile.plan)
    const maxVariants = planConfig?.variantLimit ?? 10
    if (job.variant_count > maxVariants) {
      // Clamp variant count to plan limit
      await serviceClient
        .from('jobs')
        .update({ variant_count: maxVariants })
        .eq('id', jobId)
      job.variant_count = maxVariants
    }

    // Enforce watermark removal based on plan
    const canRemoveWatermark = profile.plan === 'pro' || profile.plan === 'agency'
    if (job.settings?.remove_watermark && !canRemoveWatermark) {
      const updatedSettings = { ...job.settings, remove_watermark: false }
      await serviceClient
        .from('jobs')
        .update({ settings: updatedSettings })
        .eq('id', jobId)
      job.settings = updatedSettings
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

    // Trigger real processing on Modal
    const result = await triggerVideoProcessing({
      jobId: job.id,
      sourcePath: job.source_file_path,
      variantCount: job.variant_count,
      settings: job.settings,
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
    console.error('Process job error:', error)
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    )
  }
}
