'use client'

import { Users, Globe, MapPin, Activity } from 'lucide-react'
import { AnimatedCounter } from './animated-counter'
import { totalUsers, totalCountries, totalCities, uptimePercent } from '@/data/tracking-locations'

const stats = [
  { label: 'Active Users', value: totalUsers, icon: Users, color: 'text-primary' },
  { label: 'Countries', value: totalCountries, icon: Globe, color: 'text-accent' },
  { label: 'Cities', value: totalCities, icon: MapPin, color: 'text-primary' },
  { label: 'Uptime', value: uptimePercent, icon: Activity, color: 'text-accent', suffix: '%', decimals: 2 },
]

export function StatsBar() {
  return (
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
  )
}
