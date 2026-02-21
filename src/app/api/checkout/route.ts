import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createCryptoCharge } from '@/lib/crypto/client'
import { getPlanById } from '@/lib/crypto/plans'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan } = await request.json()

    const planConfig = getPlanById(plan)
    if (!planConfig || planConfig.price === 0) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Affiliate discount + tracking
    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('referred_by')
      .eq('id', user.id)
      .single()

    let priceOverride: number | undefined
    let affiliateCode: string | null = null

    if (profile?.referred_by) {
      // Check affiliate is active
      const { data: affiliate } = await serviceClient
        .from('affiliates')
        .select('id, code, is_active')
        .eq('code', profile.referred_by)
        .eq('is_active', true)
        .single()

      if (affiliate) {
        affiliateCode = affiliate.code

        // Check if user has any confirmed payments (first payment = discount)
        const { count } = await serviceClient
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'confirmed')

        if (count === 0) {
          // 10% discount on first payment
          priceOverride = Math.round(planConfig.price * 0.9 * 100) / 100
        }
      }
    }

    if (!user.email) {
      return NextResponse.json({ error: 'Email required for checkout' }, { status: 400 })
    }

    const charge = await createCryptoCharge({
      plan,
      userId: user.id,
      userEmail: user.email,
      priceOverride,
      affiliateCode,
    })

    return NextResponse.json({ url: charge.hostedUrl })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
