import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    const { data: affiliate } = await serviceClient
      .from('affiliates')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!affiliate) {
      return NextResponse.json({ affiliate: null })
    }

    // Get stats
    const { count: referralCount } = await serviceClient
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('affiliate_id', affiliate.id)

    const { data: commissions } = await serviceClient
      .from('commissions')
      .select('amount, status')
      .eq('affiliate_id', affiliate.id)

    const totalEarned = commissions?.reduce((sum, c) => sum + Number(c.amount), 0) ?? 0
    const pendingPayout = commissions
      ?.filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + Number(c.amount), 0) ?? 0

    return NextResponse.json({
      affiliate,
      stats: {
        referralCount: referralCount ?? 0,
        totalEarned,
        pendingPayout,
      },
    })
  } catch (error) {
    console.error('Affiliate GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch affiliate data' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    // Check if already an affiliate
    const { data: existing } = await serviceClient
      .from('affiliates')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Already an affiliate' }, { status: 400 })
    }

    // Generate unique code
    let code = generateCode()
    let attempts = 0
    while (attempts < 10) {
      const { data: codeCheck } = await serviceClient
        .from('affiliates')
        .select('id')
        .eq('code', code)
        .single()

      if (!codeCheck) break
      code = generateCode()
      attempts++
    }

    const { data: affiliate, error } = await serviceClient
      .from('affiliates')
      .insert({ user_id: user.id, code })
      .select()
      .single()

    if (error) {
      console.error('Affiliate creation error:', error)
      return NextResponse.json({ error: 'Failed to create affiliate' }, { status: 500 })
    }

    return NextResponse.json({ affiliate })
  } catch (error) {
    console.error('Affiliate POST error:', error)
    return NextResponse.json({ error: 'Failed to create affiliate' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code } = await request.json()

    // Validate code format: 3-20 chars, alphanumeric + hyphens
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    }

    if (code.length < 3 || code.length > 20) {
      return NextResponse.json({ error: 'Code must be 3-20 characters' }, { status: 400 })
    }

    if (!/^[a-zA-Z0-9-]+$/.test(code)) {
      return NextResponse.json({ error: 'Code can only contain letters, numbers, and hyphens' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Check uniqueness
    const { data: codeCheck } = await serviceClient
      .from('affiliates')
      .select('id, user_id')
      .eq('code', code)
      .single()

    if (codeCheck && codeCheck.user_id !== user.id) {
      return NextResponse.json({ error: 'Code is already taken' }, { status: 409 })
    }

    const { data: affiliate, error } = await serviceClient
      .from('affiliates')
      .update({ code })
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Affiliate code update error:', error)
      return NextResponse.json({ error: 'Failed to update code' }, { status: 500 })
    }

    return NextResponse.json({ affiliate })
  } catch (error) {
    console.error('Affiliate PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update code' }, { status: 500 })
  }
}
