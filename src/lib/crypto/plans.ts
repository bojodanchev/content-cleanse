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
      '5 projects per month',
      '10 variants per project',
      '2 face swaps per month',
      'Manual & AI captions',
      'Photo & video cleaning',
      'Metadata stripping',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For serious content creators',
    price: 89,
    originalPrice: 119,
    quota: 100,
    variantLimit: 10000,
    faceswapLimit: 50,
    popular: true,
    features: [
      '100 projects per month',
      'Unlimited variants',
      '50 face swaps per month',
      'Manual & AI captions',
      'Photo & video cleaning',
      'AI watermark removal',
      'Custom watermark overlay',
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
    variantLimit: 10000,
    faceswapLimit: 10000,
    features: [
      'Unlimited projects',
      'Unlimited variants',
      'Unlimited face swaps',
      'Manual & AI captions',
      'Photo & video cleaning',
      'AI watermark removal',
      'Custom watermark overlay',
      'Dedicated account manager',
      'Email support',
    ],
  },
]

export function getPlanById(planId: string): Plan | undefined {
  return PLANS.find((p) => p.id === planId)
}
