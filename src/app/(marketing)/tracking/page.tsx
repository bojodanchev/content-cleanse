import type { Metadata } from 'next'
import { WorldMap } from '@/components/tracking/world-map'
import { StatsBar } from '@/components/tracking/stats-bar'

export const metadata: Metadata = {
  title: 'Live Network | Creator Engine',
  description: 'Real-time view of Creator Engine usage across the globe.',
  robots: { index: false, follow: false },
}

export default function TrackingPage() {
  return (
    <div className="overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-pattern opacity-50" />
      <div className="absolute inset-0 noise-overlay" />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-primary/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-accent/20 rounded-full blur-[128px]" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <section className="pt-28 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/50 bg-card/50 text-xs text-muted-foreground mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Live data
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            <span className="gradient-text">Live Network</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Powering creators worldwide — real-time view of the Creator Engine network.
          </p>
        </section>

        {/* Stats */}
        <section className="pb-8">
          <StatsBar />
        </section>

        {/* Map */}
        <section className="pb-12">
          <WorldMap />
        </section>

        {/* Bottom status */}
        <section className="pb-16 text-center">
          <div className="inline-flex items-center gap-2.5 text-sm text-muted-foreground">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            All systems operational
          </div>
        </section>
      </div>
    </div>
  )
}
