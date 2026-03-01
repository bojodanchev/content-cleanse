'use client'

import { topRow, bottomRow, type Testimonial } from '@/data/testimonials'

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="w-[300px] md:w-[380px] shrink-0 rounded-xl border border-border/50 bg-card p-5 md:p-6">
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        <span className="text-2xl text-primary/60 font-serif leading-none mr-1">&ldquo;</span>
        {testimonial.quote}
      </p>
      <div className="flex items-center gap-3">
        <img
          src={testimonial.avatar}
          alt={testimonial.name}
          className="w-8 h-8 rounded-full object-cover"
          loading="lazy"
        />
        <div>
          <p className="text-sm font-medium text-foreground">{testimonial.name}</p>
          <p className="text-xs text-muted-foreground">{testimonial.company}</p>
        </div>
      </div>
    </div>
  )
}

function MarqueeRow({
  testimonials,
  direction,
}: {
  testimonials: Testimonial[]
  direction: 'left' | 'right'
}) {
  const animationClass =
    direction === 'left'
      ? 'animate-[marquee-left_30s_linear_infinite] md:animate-[marquee-left_40s_linear_infinite]'
      : 'animate-[marquee-right_30s_linear_infinite] md:animate-[marquee-right_40s_linear_infinite]'

  return (
    <div className="group flex gap-5">
      <div className={`flex gap-5 shrink-0 group-hover:[animation-play-state:paused] ${animationClass}`}>
        {testimonials.map((t, i) => (
          <TestimonialCard key={i} testimonial={t} />
        ))}
      </div>
      <div className={`flex gap-5 shrink-0 group-hover:[animation-play-state:paused] ${animationClass}`} aria-hidden>
        {testimonials.map((t, i) => (
          <TestimonialCard key={`dup-${i}`} testimonial={t} />
        ))}
      </div>
    </div>
  )
}

export default function TestimonialsMarquee() {
  return (
    <section className="py-16 md:py-24 relative">
      <div className="max-w-7xl mx-auto px-6 mb-10 md:mb-14">
        <h2 className="text-3xl md:text-4xl font-bold text-center">
          What clients say{' '}
          <span className="text-muted-foreground font-normal text-xl md:text-2xl block mt-2">
            about Creator Engine&apos;s impact on their content workflow.
          </span>
        </h2>
      </div>

      <div className="relative overflow-hidden">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        <div className="flex flex-col gap-4 md:gap-5">
          <MarqueeRow testimonials={topRow} direction="left" />
          <MarqueeRow testimonials={bottomRow} direction="right" />
        </div>
      </div>
    </section>
  )
}
