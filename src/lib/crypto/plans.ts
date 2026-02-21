export interface Plan {
  id: string
  name: string
  description: string
  price: number
  originalPrice?: number
  features: string[]
  quota: number
  variantLimit: number
  faceswapLimit: number
  popular?: boolean
}

export const PLAN_DURATION_DAYS = 30

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out Creator Engine',
    price: 0,
    quota: 5,
    variantLimit: 10,
    faceswapLimit: 2,
    features: [
      '5 videos per month',
      '10 variants per video',
      '2 face swaps per month',
      'Basic transformations',
      'Download as ZIP',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For serious content creators',
    price: 89,
    originalPrice: 119,
    quota: 100,
    variantLimit: 100,
    faceswapLimit: 50,
    popular: true,
    features: [
      '100 videos per month',
      '100 variants per video',
      '50 face swaps per month',
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
    price: 169,
    originalPrice: 249,
    quota: 10000,
    variantLimit: 100,
    faceswapLimit: 10000,
    features: [
      'Unlimited videos',
      '100 variants per video',
      'Unlimited face swaps',
      'AI watermark removal',
      'Custom watermark overlay',
      'API access',
      'Team seats (5 included)',
      'Priority support',
      'Custom integrations',
    ],
  },
]

export function getPlanById(planId: string): Plan | undefined {
  return PLANS.find((p) => p.id === planId)
}
