'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLANS } from '@/lib/crypto/plans'

const comparisonFeatures = [
  { name: 'Videos per month', free: '5', pro: '100', agency: 'Unlimited' },
  { name: 'Variants per video', free: '10', pro: '100', agency: '100' },
  { name: 'Basic transformations', free: true, pro: true, agency: true },
  { name: 'Metadata stripping', free: true, pro: true, agency: true },
  { name: 'Audio variations', free: true, pro: true, agency: true },
  { name: 'AI watermark removal', free: false, pro: true, agency: true },
  { name: 'Custom watermark overlay', free: false, pro: true, agency: true },
  { name: 'Priority processing', free: false, pro: true, agency: true },
  { name: 'API access', free: false, pro: false, agency: true },
  { name: 'Team seats', free: '1', pro: '1', agency: '5 included' },
  { name: 'Support', free: 'Community', pro: 'Email', agency: 'Priority' },
]

export default function PricingPage() {
  return (
    <div className="pt-24 pb-16">
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
                <span className="text-5xl font-bold">${plan.price}</span>
                {plan.price > 0 && (
                  <span className="text-muted-foreground text-lg">/month</span>
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

              <Link
                href={plan.price === 0 ? '/signup' : `/signup?plan=${plan.id}`}
              >
                <Button
                  className={`w-full h-12 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70'
                      : ''
                  }`}
                  variant={plan.popular ? 'default' : 'outline'}
                  size="lg"
                >
                  {plan.price === 0 ? 'Start Free' : 'Get Started'}
                </Button>
              </Link>

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
            {
              q: 'Do you offer discounts for non-profits or students?',
              a: 'Yes! Contact us at support@contentcleanse.com with proof of status for a 50% discount on any plan.',
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
