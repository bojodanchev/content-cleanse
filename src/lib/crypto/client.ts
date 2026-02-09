import { createHmac } from 'crypto'
import { getPlanById } from './plans'

interface CreateChargeParams {
  plan: string
  userId: string
  userEmail: string
  priceOverride?: number
  affiliateCode?: string | null
}

interface ChargeResponse {
  id: string
  hostedUrl: string
}

export async function createCryptoCharge(
  params: CreateChargeParams
): Promise<ChargeResponse> {
  const { plan, userId } = params

  const planData = getPlanById(plan)
  if (!planData || planData.price === 0) {
    throw new Error(`Invalid plan for crypto payment: ${plan}`)
  }

  const apiKey = process.env.NOWPAYMENTS_API_KEY
  if (!apiKey) {
    throw new Error('NOWPAYMENTS_API_KEY is not configured')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const response = await fetch('https://api.nowpayments.io/v1/invoice', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_amount: params.priceOverride ?? planData.price,
      price_currency: 'usd',
      order_id: `${userId}__${plan}__${Date.now()}__${params.affiliateCode || 'none'}`,
      order_description: `Content Cleanse ${planData.name} Plan - 30 days`,
      ipn_callback_url: `${appUrl}/api/webhooks/crypto`,
      success_url: `${appUrl}/dashboard?payment=success&plan=${plan}`,
      cancel_url: `${appUrl}/pricing?payment=cancelled`,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`NOWPayments API error: ${response.status} ${error}`)
  }

  const data = await response.json()

  return {
    id: String(data.id),
    hostedUrl: data.invoice_url,
  }
}

export function verifyNowPaymentsSignature(
  payload: Record<string, unknown>,
  signature: string,
  secret: string
): boolean {
  // NOWPayments IPN: sort keys alphabetically, JSON.stringify, HMAC-SHA512
  const sorted = Object.keys(payload)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = payload[key]
        return acc
      },
      {} as Record<string, unknown>
    )
  const computed = createHmac('sha512', secret)
    .update(JSON.stringify(sorted))
    .digest('hex')
  return computed === signature
}
