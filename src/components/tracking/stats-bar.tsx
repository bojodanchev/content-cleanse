'use client'

import { Users, Globe, MapPin, Activity, Crown, Zap, User } from 'lucide-react'
import { AnimatedCounter } from './animated-counter'
import { totalUsers, totalCountries, totalCities, uptimePercent, planBreakdown } from '@/data/tracking-locations'

const stats = [
  { label: 'Active Users', value: totalUsers, icon: Users, color: 'text-primary' },
  { label: 'Countries', value: totalCountries, icon: Globe, color: 'text-accent' },
  { label: 'Cities', value: totalCities, icon: MapPin, color: 'text-primary' },
  { label: 'Uptime', value: uptimePercent, icon: Activity, color: 'text-accent', suffix: '%', decimals: 2 },
]

const plans = [
  { label: 'Free', value: planBreakdown.free, icon: User, color: 'text-muted-foreground' },
  { label: 'Pro', value: planBreakdown.pro, icon: Zap, color: 'text-primary' },
  { label: 'Agency', value: planBreakdown.agency, icon: Crown, color: 'text-accent' },
]

export function StatsBar() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4">
            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold">
              <AnimatedCounter
                value={stat.value}
                suffix={stat.suffix}
                decimals={stat.decimals}
              />
            </p>
          </div>
        ))}
      </div>

      {/* Plan breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.label} className="glass rounded-xl p-4 flex items-center gap-3">
            <plan.icon className={`h-4 w-4 ${plan.color} shrink-0`} />
            <div>
              <p className="text-xs text-muted-foreground">{plan.label}</p>
              <p className="text-lg font-bold">
                <AnimatedCounter value={plan.value} />
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
