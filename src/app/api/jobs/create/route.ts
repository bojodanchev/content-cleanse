import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getPlanById } from '@/lib/crypto/plans'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { filePath, fileName, fileSize, variantCount, removeWatermark, addWatermark, jobType, settings, parentJobId, copyCount } = await request.json()

    if (!filePath || !fileName) {
      return NextResponse.json({ error: 'File path and name required' }, { status: 400 })
    }

    // Validate file path belongs to the authenticated user (prevent accessing other users' files)
    if (jobType !== 'carousel_multiply' && !filePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 403 })
    }

    // Enforce 50MB file size limit (Supabase free tier)
    const MAX_FILE_SIZE = 50 * 1024 * 1024
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds 50MB size limit' }, { status: 400 })
    }

    // Fetch profile for plan enforcement
    const serviceClient = createServiceClient()
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

    // Pre-check quota before creating job
    if ((profile.quota_used ?? 0) >= (profile.monthly_quota ?? 5)) {
      return NextResponse.json(
        { error: 'Monthly quota exceeded. Upgrade your plan for more jobs.' },
        { status: 403 }
      )
    }

    // Enforce plan limits
    const planConfig = getPlanById(profile.plan)
    const maxVariants = planConfig?.variantLimit ?? 10
    const validatedVariantCount = Math.min(Math.max(1, variantCount || 10), maxVariants)

    const isPhotoCaptions = jobType === 'photo_captions'
    const isFaceswap = jobType === 'faceswap'
    const isPhotoClean = jobType === 'photo_clean'
    const isCarouselMultiply = jobType === 'carousel_multiply'

    // Pre-check faceswap-specific limit
    if (isFaceswap) {
      const faceswapLimit = planConfig?.faceswapLimit ?? 2
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { count: faceswapCount } = await serviceClient
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('job_type', 'faceswap')
        .in('status', ['pending', 'processing', 'completed'])
        .gte('created_at', startOfMonth.toISOString())

      if ((faceswapCount ?? 0) >= faceswapLimit) {
        return NextResponse.json(
          { error: `Face swap limit reached (${faceswapLimit}/month). Upgrade your plan for more.` },
          { status: 403 }
        )
      }
    }

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
      // Photo captions job — store caption settings as-is
      jobData = {
        user_id: user.id,
        job_type: 'photo_captions' as const,
        status: 'pending' as const,
        source_file_path: filePath,
        source_file_name: fileName,
        source_file_size: fileSize || 0,
        variant_count: validatedVariantCount,
        settings: settings || {},
      }
    } else if (isPhotoClean) {
      jobData = {
        user_id: user.id,
        job_type: 'photo_clean' as const,
        status: 'pending' as const,
        source_file_path: filePath,
        source_file_name: fileName,
        source_file_size: fileSize || 0,
        variant_count: validatedVariantCount,
        settings: {},
      }
    } else if (isCarouselMultiply) {
      if (!parentJobId) {
        return NextResponse.json({ error: 'Parent job ID required for multiply' }, { status: 400 })
      }

      // Validate parent job
      const { data: parentJob } = await serviceClient
        .from('jobs')
        .select('*')
        .eq('id', parentJobId)
        .eq('user_id', user.id)
        .single()

      if (!parentJob || parentJob.status !== 'completed' || parentJob.job_type !== 'photo_captions') {
        return NextResponse.json(
          { error: 'Parent job must be a completed photo captions job' },
          { status: 400 }
        )
      }

      // Count parent job's slides
      const { count: slideCount } = await serviceClient
        .from('variants')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', parentJobId)

      const slides = slideCount ?? 0
      if (slides === 0) {
        return NextResponse.json({ error: 'Parent job has no output slides' }, { status: 400 })
      }

      // Cap copy count based on plan variant limit
      const requestedCopies = Math.max(2, copyCount || 5)
      const cappedCopies = Math.min(requestedCopies, Math.floor(maxVariants / slides))

      if (cappedCopies < 2) {
        return NextResponse.json(
          { error: 'Not enough variant capacity for multiply. Need at least 2 copies.' },
          { status: 400 }
        )
      }

      jobData = {
        user_id: user.id,
        job_type: 'carousel_multiply' as const,
        status: 'pending' as const,
        source_file_path: parentJob.source_file_path,
        source_file_name: parentJob.source_file_name,
        source_file_size: 0,
        variant_count: slides * cappedCopies,
        parent_job_id: parentJobId,
        settings: {
          copy_count: cappedCopies,
          source_job_id: parentJobId,
          slide_count: slides,
        },
      }
    } else {
      // Video job (default)
      const canRemoveWatermark = profile.plan === 'pro' || profile.plan === 'agency'
      const validatedRemoveWatermark = canRemoveWatermark && Boolean(removeWatermark)

      jobData = {
        user_id: user.id,
        job_type: 'video' as const,
        status: 'pending' as const,
        source_file_path: filePath,
        source_file_name: fileName,
        source_file_size: fileSize || 0,
        variant_count: validatedVariantCount,
        settings: {
          brightness_range: [-0.03, 0.03],
          saturation_range: [0.97, 1.03],
          hue_range: [-5, 5],
          crop_px_range: [1, 3],
          speed_range: [0.98, 1.02],
          remove_watermark: validatedRemoveWatermark,
          add_watermark: Boolean(addWatermark),
          watermark_path: null,
        },
      }
    }

    const { data: job, error: jobError } = await serviceClient
      .from('jobs')
      .insert(jobData)
      .select()
      .single()

    if (jobError) {
      console.error('Job creation error:', jobError)
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
    }

    return NextResponse.json({ job })
  } catch (error) {
    console.error('Create job error:', error)
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }
}
