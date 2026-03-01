import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/admin/auth'

export async function GET(request: Request) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all'
    const plan = searchParams.get('plan') || 'all'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)))
    const offset = (page - 1) * limit

    const supabase = createServiceClient()

    // If searching by email, find matching user IDs first
    let searchUserIds: string[] | null = null
    if (search) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', `%${search}%`)

      if (!profiles || profiles.length === 0) {
        return NextResponse.json({
          payments: [],
          total: 0,
          page,
          totalPages: 0,
        })
      }

      searchUserIds = profiles.map((p) => p.id)
    }

    // Build payments query
    let query = supabase
      .from('payments')
      .select('*', { count: 'exact' })

    if (searchUserIds) {
      query = query.in('user_id', searchUserIds)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (plan && plan !== 'all') {
      query = query.eq('plan', plan)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: payments, count, error } = await query

    if (error) {
      console.error('Admin payments query error:', error)
      return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
    }

    // Batch-fetch user emails for the payments in this page
    const uniqueUserIds = [...new Set((payments ?? []).map((p) => p.user_id).filter(Boolean))]
    const emailMap = new Map<string, string>()

    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', uniqueUserIds)

      if (profiles) {
        for (const profile of profiles) {
          emailMap.set(profile.id, profile.email)
        }
      }
    }

    const total = count ?? 0

    return NextResponse.json({
      payments: (payments ?? []).map((p) => ({
        ...p,
        user_email: emailMap.get(p.user_id) || null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('Admin payments error:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}
