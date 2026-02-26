import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/admin/auth'

export async function GET() {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Fetch all counts and active jobs in parallel
    const [totalRes, freeRes, proRes, agencyRes, activeJobsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('plan', 'free'),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('plan', 'pro'),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('plan', 'agency'),
      supabase
        .from('jobs')
        .select('user_id')
        .gte('created_at', sevenDaysAgo.toISOString()),
    ])

    const activeUserIds = new Set((activeJobsRes.data ?? []).map(j => j.user_id))

    return NextResponse.json({
      total: totalRes.count ?? 0,
      free: freeRes.count ?? 0,
      pro: proRes.count ?? 0,
      agency: agencyRes.count ?? 0,
      activeLastWeek: activeUserIds.size,
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
