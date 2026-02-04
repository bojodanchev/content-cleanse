export interface Plan {
  id: string
  name: string
  description: string
  price: number
  priceId: string | null
  features: string[]
  quota: number
  popular?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out Content Cleanse',
    price: 0,
    priceId: null,
    quota: 5,
    features: [
      '5 videos per month',
      '10 variants per video',
      'Basic transformations',
      'Download as ZIP',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For serious content creators',
    price: 99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || 'price_pro',
    quota: 100,
    popular: true,
    features: [
      '100 videos per month',
      '100 variants per video',
      'AI watermark removal',
      'Custom watermark overlay',
      'Priority processing',
      'Email support',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    description: 'For teams and agencies',
    price: 249,
    priceId: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID || 'price_agency',
    quota: 10000,
    features: [
      'Unlimited videos',
      '100 variants per video',
      'AI watermark removal',
      'Custom watermark overlay',
      'API access',
      'Team seats (5 included)',
      'Priority support',
      'Custom integrations',
    ],
  },
]

export function getPlan(planId: string): Plan | undefined {
  return PLANS.find((p) => p.id === planId)
}

export function getPlanByPriceId(priceId: string): Plan | undefined {
  return PLANS.find((p) => p.priceId === priceId)
}
