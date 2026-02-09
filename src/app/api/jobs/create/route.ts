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

    const { filePath, fileName, fileSize, variantCount, removeWatermark, addWatermark } = await request.json()

    if (!filePath || !fileName) {
      return NextResponse.json({ error: 'File path and name required' }, { status: 400 })
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

    // Enforce plan limits
    const planConfig = getPlanById(profile.plan)
    const maxVariants = planConfig?.variantLimit ?? 10
    const validatedVariantCount = Math.min(Math.max(1, variantCount || 10), maxVariants)

    const canRemoveWatermark = profile.plan === 'pro' || profile.plan === 'agency'
    const validatedRemoveWatermark = canRemoveWatermark && Boolean(removeWatermark)

    const jobData = {
      user_id: user.id,
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
