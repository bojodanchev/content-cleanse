import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/admin/auth'
import { getPlanById, PLAN_DURATION_DAYS } from '@/lib/crypto/plans'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { plan, quota_used, monthly_quota } = body

    const supabase = createServiceClient()

    // Verify user exists
    const { data: existing, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}

    if (plan && plan !== existing.plan) {
      const planConfig = getPlanById(plan)
      if (!planConfig) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
      }

      updates.plan = plan
      updates.monthly_quota = planConfig.quota
      updates.quota_used = 0

      if (plan === 'free') {
        updates.plan_expires_at = null
      } else {
        const expires = new Date()
        expires.setDate(expires.getDate() + PLAN_DURATION_DAYS)
        updates.plan_expires_at = expires.toISOString()
      }
    }

    if (typeof quota_used === 'number') {
      updates.quota_used = Math.max(0, quota_used)
    }

    if (typeof monthly_quota === 'number') {
      updates.monthly_quota = Math.max(0, monthly_quota)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Admin user update error:', updateError)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Admin user update error:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
