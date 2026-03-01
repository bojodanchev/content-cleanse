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

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [paymentsRes, commissionsRes] = await Promise.all([
      supabase
        .from('payments')
        .select('amount, status, confirmed_at, created_at'),
      supabase
        .from('commissions')
        .select('amount')
        .eq('status', 'paid'),
    ])

    const payments = paymentsRes.data ?? []
    const commissions = commissionsRes.data ?? []

    const confirmed = payments.filter(p => p.status === 'confirmed')

    const totalRevenue = confirmed.reduce((sum, p) => sum + Number(p.amount), 0)

    const revenueThisMonth = confirmed
      .filter(p => p.confirmed_at && new Date(p.confirmed_at) >= startOfMonth)
      .reduce((sum, p) => sum + Number(p.amount), 0)

    const revenueLast30Days = confirmed
      .filter(p => p.confirmed_at && new Date(p.confirmed_at) >= thirtyDaysAgo)
      .reduce((sum, p) => sum + Number(p.amount), 0)

    const confirmedCount = confirmed.length
    const totalPaymentsCount = payments.length
    const averagePaymentValue = confirmedCount > 0 ? totalRevenue / confirmedCount : 0

    const totalCommissionsPaid = commissions.reduce((sum, c) => sum + Number(c.amount), 0)

    return NextResponse.json({
      totalRevenue,
      revenueThisMonth,
      revenueLast30Days,
      confirmedCount,
      totalPaymentsCount,
      averagePaymentValue,
      mrr: revenueLast30Days,
      totalCommissionsPaid,
    })
  } catch (error) {
    console.error('Admin financial stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch financial stats' }, { status: 500 })
  }
}
