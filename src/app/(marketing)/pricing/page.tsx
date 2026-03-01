'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, HelpCircle, Loader2, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLANS } from '@/lib/crypto/plans'
import { getClient } from '@/lib/supabase/client'

const comparisonFeatures = [
  { name: 'Projects per month', free: '5', pro: '100', agency: 'Unlimited' },
  { name: 'Variants per project', free: '10', pro: 'Unlimited', agency: 'Unlimited' },
  { name: 'Face swaps per month', free: '2', pro: '50', agency: 'Unlimited' },
  { name: 'Manual & AI captions', free: true, pro: true, agency: true },
  { name: 'Photo & video cleaning', free: true, pro: true, agency: true },
  { name: 'Metadata stripping', free: true, pro: true, agency: true },
  { name: 'AI watermark removal', free: false, pro: true, agency: true },
  { name: 'Custom watermark overlay', free: false, pro: true, agency: true },
  { name: 'Email support', free: false, pro: true, agency: true },
]

export default function PricingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
    })
  }, [])

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId)
    setCheckoutError(null)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })

      const { url, error } = await response.json()
      if (url) {
        window.location.href = url
      } else {
        setCheckoutError('Failed to create checkout session. Please try again.')
      }
    } catch {
      setCheckoutError('Failed to create checkout session. Please try again.')
    }
    setUpgrading(null)
  }

  return (
    <div className="pt-24 pb-16">
      {/* Sale Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-6 mt-4 mb-0"
      >
        <div className="max-w-3xl mx-auto rounded-xl bg-gradient-to-r from-red-500/10 via-orange-500/10 to-red-500/10 border border-red-500/20 p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <Flame className="w-5 h-5 text-red-400" />
            <span className="font-bold text-red-400 uppercase tracking-wide text-sm">Limited Time Sale</span>
            <Flame className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Save up to $80/month on Pro and Agency plans
          </p>
        </div>
      </motion.div>

      {/* Hero */}
      <section className="py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto px-6"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-muted-foreground">
            Start free. Upgrade when you need more power.
          </p>
        </motion.div>
      </section>

      {checkoutError && (
        <div className="max-w-md mx-auto px-6 mb-8">
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
            {checkoutError}
          </div>
        </div>
      )}

      {/* Pricing cards */}
      <section className="max-w-7xl mx-auto px-6 mb-24">
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl p-8 ${
                plan.popular
                  ? 'border-2 border-primary bg-card scale-105 shadow-xl shadow-primary/10'
                  : 'border border-border/50 bg-card/50'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground">{plan.description}</p>
              </div>

              <div className="mb-8">
                {plan.originalPrice ? (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg text-muted-foreground line-through">${plan.originalPrice}</span>
                      <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wide">
                        Save ${plan.originalPrice - plan.price}
                      </span>
                    </div>
                    <span className="text-5xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground text-lg">/month</span>
                  </div>
                ) : (
                  <>
                    <span className="text-5xl font-bold">${plan.price}</span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground text-lg">/month</span>
                    )}
                  </>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.price === 0 ? (
                <Link href={isLoggedIn ? '/dashboard' : '/signup'}>
                  <Button
                    className="w-full h-12"
                    variant="outline"
                    size="lg"
                  >
                    {isLoggedIn ? 'Go to Dashboard' : 'Start Free'}
                  </Button>
                </Link>
              ) : isLoggedIn ? (
                <Button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={upgrading !== null}
                  className={`w-full h-12 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70'
                      : ''
                  }`}
                  variant={plan.popular ? 'default' : 'outline'}
                  size="lg"
                >
                  {upgrading === plan.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating checkout...
                    </>
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </Button>
              ) : (
                <Link href={`/signup?plan=${plan.id}`}>
                  <Button
                    className={`w-full h-12 ${
                      plan.popular
                        ? 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70'
                        : ''
                    }`}
                    variant={plan.popular ? 'default' : 'outline'}
                    size="lg"
                  >
                    Get Started
                  </Button>
                </Link>
              )}

              {plan.price > 0 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Pay with crypto • 30-day access
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="max-w-5xl mx-auto px-6 mb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">Compare plans</h2>
          <p className="text-muted-foreground">
            See what's included in each plan
          </p>
        </motion.div>

        <div className="rounded-2xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-card/50">
                  <th className="text-left p-4 font-medium">Feature</th>
                  <th className="text-center p-4 font-medium">Free</th>
                  <th className="text-center p-4 font-medium bg-primary/5">Pro</th>
                  <th className="text-center p-4 font-medium">Agency</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature, i) => (
                  <tr
                    key={i}
                    className="border-t border-border/50 hover:bg-card/30 transition-colors"
                  >
                    <td className="p-4 text-muted-foreground">{feature.name}</td>
                    <td className="p-4 text-center">
                      {typeof feature.free === 'boolean' ? (
                        feature.free ? (
                          <Check className="w-5 h-5 text-primary mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )
                      ) : (
                        <span>{feature.free}</span>
                      )}
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      {typeof feature.pro === 'boolean' ? (
                        feature.pro ? (
                          <Check className="w-5 h-5 text-primary mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )
                      ) : (
                        <span className="font-medium">{feature.pro}</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {typeof feature.agency === 'boolean' ? (
                        feature.agency ? (
                          <Check className="w-5 h-5 text-primary mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )
                      ) : (
                        <span>{feature.agency}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">Pricing FAQ</h2>
        </motion.div>

        <div className="space-y-4">
          {[
            {
              q: 'Can I upgrade or downgrade at any time?',
              a: 'Yes! You can upgrade at any time by purchasing a higher plan. Your new plan starts immediately with a fresh 30-day period.',
            },
            {
              q: 'What happens if I exceed my quota?',
              a: "You'll be notified when you're approaching your limit. Once reached, you'll need to upgrade or wait for your quota to reset next month.",
            },
            {
              q: 'How do crypto payments work?',
              a: 'We accept BTC, ETH, USDT, USDC, and other major cryptocurrencies. Each payment gives you 30 days of access. Renew when your plan is about to expire.',
            },
            {
              q: 'What if my plan expires?',
              a: "You'll receive a reminder before expiry. If you don't renew, your account reverts to the Free plan. Your data is never deleted.",
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border/50 bg-card/50 p-6"
            >
              <div className="flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium mb-2">{item.q}</h3>
                  <p className="text-muted-foreground text-sm">{item.a}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
