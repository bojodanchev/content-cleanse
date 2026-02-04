import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession, createPortalSession } from '@/lib/stripe/client'
import { getPlan } from '@/lib/stripe/plans'

interface ProfileData {
  stripe_customer_id: string | null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planId, action } = await request.json()

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single() as { data: ProfileData | null }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // If action is 'portal', redirect to customer portal
    if (action === 'portal') {
      if (!profile?.stripe_customer_id) {
        return NextResponse.json(
          { error: 'No subscription found' },
          { status: 400 }
        )
      }

      const session = await createPortalSession({
        customerId: profile.stripe_customer_id,
        returnUrl: `${baseUrl}/settings`,
      })

      return NextResponse.json({ url: session.url })
    }

    // Otherwise, create checkout session
    const plan = getPlan(planId)

    if (!plan || !plan.priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const session = await createCheckoutSession({
      priceId: plan.priceId,
      customerId: profile?.stripe_customer_id || undefined,
      userId: user.id,
      successUrl: `${baseUrl}/dashboard?checkout=success`,
      cancelUrl: `${baseUrl}/pricing?checkout=cancelled`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
