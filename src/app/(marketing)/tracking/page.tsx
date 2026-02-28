import type { Metadata } from 'next'
import { WorldMap } from '@/components/tracking/world-map'
import { StatsBar } from '@/components/tracking/stats-bar'

export const metadata: Metadata = {
  title: 'User Analytics | Creator Engine',
  description: 'Real-time user analytics across the Creator Engine platform.',
  robots: { index: false, follow: false },
}

export default function TrackingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-pattern opacity-50" />
      <div className="absolute inset-0 noise-overlay" />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-primary/20 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-accent/20 rounded-full blur-[128px]" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <section className="pt-28 pb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/50 bg-card/50 text-xs text-muted-foreground mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Updating in real time
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
                User <span className="text-primary">Analytics</span>
              </h1>
              <p className="text-base text-muted-foreground mt-2">
                Global network activity across the Creator Engine platform.
              </p>
            </div>
            <p className="text-xs text-muted-foreground font-mono tracking-wide uppercase">
              {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} &middot; All regions
            </p>
          </div>
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
