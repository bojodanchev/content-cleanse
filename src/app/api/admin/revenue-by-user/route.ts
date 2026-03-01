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

    const { data: payments, error } = await supabase
      .from('payments')
      .select('user_id, amount')
      .eq('status', 'confirmed')

    if (error) throw error

    const revenueMap = new Map<string, { totalPaid: number; paymentCount: number }>()

    for (const p of payments ?? []) {
      const existing = revenueMap.get(p.user_id)
      if (existing) {
        existing.totalPaid += Number(p.amount)
        existing.paymentCount += 1
      } else {
        revenueMap.set(p.user_id, { totalPaid: Number(p.amount), paymentCount: 1 })
      }
    }

    const userIds = Array.from(revenueMap.keys())

    if (userIds.length === 0) {
      return NextResponse.json({ users: [] })
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, plan, plan_expires_at')
      .in('id', userIds)

    const profileMap = new Map(
      (profiles ?? []).map(p => [p.id, p])
    )

    const users = userIds
      .map(userId => {
        const revenue = revenueMap.get(userId)!
        const profile = profileMap.get(userId)
        return {
          user_id: userId,
          email: profile?.email ?? null,
          totalPaid: revenue.totalPaid,
          paymentCount: revenue.paymentCount,
          plan: profile?.plan ?? null,
          planExpiresAt: profile?.plan_expires_at ?? null,
        }
      })
      .sort((a, b) => b.totalPaid - a.totalPaid)

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Admin revenue-by-user error:', error)
    return NextResponse.json({ error: 'Failed to fetch revenue by user' }, { status: 500 })
  }
}
