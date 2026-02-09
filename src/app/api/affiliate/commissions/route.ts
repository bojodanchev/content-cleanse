import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    // Get affiliate record
    const { data: affiliate } = await serviceClient
      .from('affiliates')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!affiliate) {
      return NextResponse.json({ error: 'Not an affiliate' }, { status: 404 })
    }

    // Get last 50 commissions
    const { data: commissions } = await serviceClient
      .from('commissions')
      .select('*')
      .eq('affiliate_id', affiliate.id)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ commissions: commissions ?? [] })
  } catch (error) {
    console.error('Commissions GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 })
  }
}
