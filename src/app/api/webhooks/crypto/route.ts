import { NextResponse } from 'next/server'
import { verifyNowPaymentsSignature } from '@/lib/crypto/client'
import { getPlanById } from '@/lib/crypto/plans'
import { createServiceClient } from '@/lib/supabase/server'

interface NowPaymentsIPN {
  payment_id: number
  payment_status: string
  pay_address: string
  price_amount: number
  price_currency: string
  pay_amount: number
  pay_currency: string
  order_id: string
  order_description: string
  outcome_amount: number
  outcome_currency: string
  purchase_id: string
  actually_paid: number
  actually_paid_at_fiat: number
  [key: string]: unknown
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('x-nowpayments-sig')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing webhook signature' },
      { status: 400 }
    )
  }

  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET
  if (!ipnSecret) {
    console.error('NOWPAYMENTS_IPN_SECRET not configured')
    return NextResponse.json(
      { error: 'IPN secret not configured' },
      { status: 500 }
    )
  }

  let payload: NowPaymentsIPN
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!verifyNowPaymentsSignature(payload, signature, ipnSecret)) {
    console.error('IPN signature verification failed')
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  // order_id format: {userId}__{plan}__{timestamp}
  const orderParts = payload.order_id.split('__')
  if (orderParts.length < 2) {
    console.error('Invalid order_id format:', payload.order_id)
    return NextResponse.json({ error: 'Invalid order_id' }, { status: 400 })
  }

  const userId = orderParts[0]
  const plan = orderParts[1]
  const chargeId = String(payload.payment_id)
  const affiliateCode = orderParts.length >= 4 ? orderParts[3] : 'none'

  const planConfig = getPlanById(plan)
  if (!planConfig) {
    console.error('Unknown plan in IPN:', plan)
    return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify the user actually exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, plan, plan_expires_at')
    .eq('id', userId)
    .single()

  if (!profile) {
    console.error('User not found for IPN:', userId)
    return NextResponse.json({ error: 'User not found' }, { status: 400 })
  }

  try {
    switch (payload.payment_status) {
      case 'finished':
      case 'confirmed': {
        // Idempotency: check if this payment was already confirmed
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id, status')
          .eq('charge_id', chargeId)
          .single()

        if (existingPayment?.status === 'confirmed') {
          // Already processed — skip profile update to prevent extending expiry
          return NextResponse.json({ received: true, duplicate: true })
        }

        // Verify payment amount matches plan price (allow small rounding tolerance)
        // If affiliate discount was applied, expected price is 90% of plan price
        const hasDiscount = affiliateCode && affiliateCode !== 'none'
        const expectedPrice = hasDiscount
          ? Math.round(planConfig.price * 0.9 * 100) / 100
          : planConfig.price
        const paidAmount = payload.price_amount
        if (paidAmount < expectedPrice * 0.95) {
          console.error(
            `Underpayment: expected $${expectedPrice}, got $${paidAmount} for plan ${plan}`
          )
          // Record as failed payment
          await supabase.from('payments').upsert(
            {
              user_id: userId,
              charge_id: chargeId,
              plan,
              amount: paidAmount,
              currency: payload.price_currency.toUpperCase(),
              crypto_currency: payload.pay_currency?.toUpperCase() ?? null,
              status: 'failed',
            },
            { onConflict: 'charge_id' }
          )
          return NextResponse.json({ received: true, underpaid: true })
        }

        // Calculate new expiry: extend from existing if renewing same plan with time remaining
        const thirtyDays = 30 * 24 * 60 * 60 * 1000
        let newExpiry: Date

        if (
          profile.plan === plan &&
          profile.plan_expires_at &&
          new Date(profile.plan_expires_at) > new Date()
        ) {
          // Same plan, still active — extend from current expiry
          newExpiry = new Date(new Date(profile.plan_expires_at).getTime() + thirtyDays)
        } else {
          // Different plan or expired — start from now
          newExpiry = new Date(Date.now() + thirtyDays)
        }

        // Update user profile with new plan
        // Let the DB trigger (update_plan_quota) handle monthly_quota
        await supabase
          .from('profiles')
          .update({
            plan,
            plan_expires_at: newExpiry.toISOString(),
            quota_used: 0,
          })
          .eq('id', userId)

        // Record confirmed payment
        await supabase.from('payments').upsert(
          {
            user_id: userId,
            charge_id: chargeId,
            plan,
            amount: paidAmount,
            currency: payload.price_currency.toUpperCase(),
            crypto_currency: payload.pay_currency?.toUpperCase() ?? null,
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          },
          { onConflict: 'charge_id' }
        )

        // Track event
        await supabase.from('events').insert({
          user_id: userId,
          event_type: 'subscription_created',
          metadata: {
            plan,
            price: paidAmount,
            payment_id: chargeId,
            pay_currency: payload.pay_currency,
            payment_method: 'crypto',
          },
        })

        // Create affiliate commission if applicable
        if (affiliateCode && affiliateCode !== 'none') {
          const { data: affiliate } = await supabase
            .from('affiliates')
            .select('id, is_active')
            .eq('code', affiliateCode)
            .eq('is_active', true)
            .single()

          if (affiliate) {
            const commissionAmount = Math.round(paidAmount * 0.1 * 100) / 100

            // Get or create the payment record ID for FK reference
            const { data: paymentRecord } = await supabase
              .from('payments')
              .select('id')
              .eq('charge_id', chargeId)
              .single()

            if (paymentRecord) {
              await supabase.from('commissions').insert({
                affiliate_id: affiliate.id,
                payment_id: paymentRecord.id,
                referred_user_id: userId,
                amount: commissionAmount,
              })
            }
          }
        }

        break
      }

      case 'waiting':
      case 'confirming':
      case 'sending': {
        // Payment in progress — record as pending
        await supabase.from('payments').upsert(
          {
            user_id: userId,
            charge_id: chargeId,
            plan,
            amount: payload.price_amount,
            currency: payload.price_currency.toUpperCase(),
            crypto_currency: payload.pay_currency?.toUpperCase() ?? null,
            status: 'pending',
          },
          { onConflict: 'charge_id' }
        )
        break
      }

      case 'failed':
      case 'refunded':
      case 'expired': {
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('charge_id', chargeId)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('IPN handler error:', error)
    return NextResponse.json(
      { error: 'IPN handler failed' },
      { status: 500 }
    )
  }
}
