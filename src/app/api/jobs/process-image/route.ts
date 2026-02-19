import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { triggerImageProcessing } from '@/lib/modal/client'
import { getPlanById } from '@/lib/crypto/plans'

export async function POST(request: Request) {
  let quotaWasConsumed = false
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

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check plan expiry
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
    quotaWasConsumed = true

    // Enforce variant count limit
    const planConfig = getPlanById(profile.plan)
    const maxVariants = planConfig?.variantLimit ?? 10
    if (job.variant_count > maxVariants) {
      await serviceClient
        .from('jobs')
        .update({ variant_count: maxVariants })
        .eq('id', jobId)
      job.variant_count = maxVariants
    }

    // Update job status to processing
    await serviceClient
      .from('jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    // Trigger image processing on Modal
    const result = await triggerImageProcessing({
      jobId: job.id,
      sourcePath: job.source_file_path,
      variantCount: job.variant_count,
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
    console.error('Process image job error:', error)
    if (quotaWasConsumed) {
      try {
        const refundClient = createServiceClient()
        const refundSupabase = await createClient()
        const { data: { user: refundUser } } = await refundSupabase.auth.getUser()
        if (refundUser) {
          await refundClient.rpc('refund_quota', { p_user_id: refundUser.id })
        }
      } catch {
        // best-effort refund
      }
    }
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    )
  }
}
