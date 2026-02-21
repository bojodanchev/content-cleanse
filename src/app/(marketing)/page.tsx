'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Zap,
  Shield,
  Layers,
  Clock,
  Download,
  Sparkles,
  Check,
  ArrowRight,
  Play,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLANS } from '@/lib/crypto/plans'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
}

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

export default function LandingPage() {
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16">
        {/* Background effects */}
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="absolute inset-0 noise-overlay" />

        {/* Gradient orbs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/30 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/30 rounded-full blur-[128px]" />

        <div className="relative max-w-7xl mx-auto px-6 py-24">
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="text-center max-w-4xl mx-auto"
          >
            {/* Headline */}
            <motion.h1
              variants={fadeInUp}
              className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
            >
              Turn one video into{' '}
              <span className="gradient-text">100 unique</span> variants
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeInUp}
              className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Stop getting flagged for duplicate content. Our AI transforms your
              videos with invisible changes that bypass platform detection.
            </motion.p>

            {/* CTA */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
            >
              <Link href="/signup">
                <Button
                  size="lg"
                  className="h-14 px-8 text-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 glow-magenta group"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="h-14 px-8 text-lg border-border/50 hover:bg-secondary/50 group"
              >
                <Play className="w-5 h-5 mr-2" />
                Watch Demo
              </Button>
            </motion.div>

            {/* Microcopy */}
            <motion.p
              variants={fadeInUp}
              className="text-sm text-muted-foreground"
            >
              No signup fee • Pay with crypto • 5 free videos per month
            </motion.p>
          </motion.div>

          {/* Hero visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-16 relative"
          >
            <div className="aspect-video max-w-5xl mx-auto rounded-2xl overflow-hidden gradient-border">
              <div className="absolute inset-[1px] rounded-2xl bg-card overflow-hidden">
                {/* Mockup of the dashboard */}
                <div className="w-full h-full bg-gradient-to-br from-card to-secondary/30 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-destructive/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>

                  <div className="grid grid-cols-3 gap-4 h-[calc(100%-40px)]">
                    {/* Left panel - upload */}
                    <div className="col-span-1 rounded-xl border border-border/50 bg-secondary/30 p-4 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                        <Download className="w-8 h-8 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium mb-1">Drop your video</p>
                        <p className="text-sm text-muted-foreground">
                          or click to browse
                        </p>
                      </div>
                    </div>

                    {/* Right panel - variants */}
                    <div className="col-span-2 rounded-xl border border-border/50 bg-secondary/30 p-4">
                      <div className="grid grid-cols-4 gap-2 h-full">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div
                            key={i}
                            className="rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-border/30 flex items-center justify-center"
                          >
                            <span className="text-xs text-muted-foreground">
                              v{i + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating stats */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 }}
              className="absolute -left-4 top-1/2 -translate-y-1/2 hidden lg:block"
            >
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">2.3s</p>
                    <p className="text-xs text-muted-foreground">Avg. process time</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 }}
              className="absolute -right-4 top-1/3 hidden lg:block"
            >
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">99.9%</p>
                    <p className="text-xs text-muted-foreground">Detection bypass</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <ChevronDown className="w-6 h-6 text-muted-foreground animate-bounce" />
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 border-y border-border/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '10,000+', label: 'Videos processed' },
              { value: '500+', label: 'Active agencies' },
              { value: '99.9%', label: 'Detection bypass' },
              { value: '<3s', label: 'Processing time' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <p className="text-3xl md:text-4xl font-bold gradient-text">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-destructive/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tired of getting your content{' '}
              <span className="text-destructive">flagged</span>?
            </h2>
            <p className="text-lg text-muted-foreground">
              Platforms use advanced AI to detect duplicate content. One repost
              can get your entire account banned.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Account Bans',
                description:
                  'Platforms shadow-ban or permanently suspend accounts posting duplicate content.',
                icon: '🚫',
              },
              {
                title: 'Wasted Time',
                description:
                  'Manually editing each video takes hours. Time you could spend growing your business.',
                icon: '⏰',
              },
              {
                title: 'Lost Revenue',
                description:
                  'Every banned account means lost followers, lost reach, and lost income.',
                icon: '💸',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5"
              >
                <span className="text-4xl mb-4 block">{item.icon}</span>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution / Features Section */}
      <section id="features" className="py-24 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[200px]" />

        <div className="max-w-7xl mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Invisible changes.{' '}
              <span className="gradient-text">Visible results.</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Our AI makes micro-adjustments that are imperceptible to viewers
              but completely unique to platform algorithms.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Layers,
                title: 'Metadata Stripping',
                description:
                  'Remove all EXIF data, randomize timestamps, and change encoder signatures.',
              },
              {
                icon: Sparkles,
                title: 'Visual Micro-Changes',
                description:
                  'Subtle brightness, saturation, hue, and crop adjustments invisible to the eye.',
              },
              {
                icon: Zap,
                title: 'Audio Variations',
                description:
                  'Slight pitch and tempo changes that maintain quality while creating uniqueness.',
              },
              {
                icon: Shield,
                title: 'AI Watermark Removal',
                description:
                  'Automatically detect and remove watermarks using advanced inpainting.',
              },
              {
                icon: Clock,
                title: 'Batch Processing',
                description:
                  'Generate up to 100 unique variants from a single upload in seconds.',
              },
              {
                icon: Download,
                title: 'One-Click Download',
                description:
                  'Get all your variants in a single ZIP file, ready to upload.',
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group p-6 rounded-2xl border border-border/50 bg-card/50 hover:border-primary/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-card/30">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Three steps to unique content
            </h2>
            <p className="text-lg text-muted-foreground">
              No technical knowledge required. Just upload and download.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload',
                description:
                  'Drag and drop your video. We support all major formats up to 50MB.',
              },
              {
                step: '02',
                title: 'Configure',
                description:
                  'Choose how many variants you need and enable watermark removal if needed.',
              },
              {
                step: '03',
                title: 'Download',
                description:
                  'Get your unique variants as a ZIP file in seconds. Ready to upload anywhere.',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-[60px] w-[calc(100%-60px)] h-[1px] bg-gradient-to-r from-primary/30 to-transparent" />
                )}

                <div className="text-6xl font-bold text-primary/40 mb-4">
                  {item.step}
                </div>
                <h3 className="text-2xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 relative">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[200px]" />

        <div className="max-w-7xl mx-auto px-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-muted-foreground">
              Start free. Upgrade when you need more.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl p-6 ${
                  plan.popular
                    ? 'border-2 border-primary bg-card/80 scale-105'
                    : 'border border-border/50 bg-card/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">/month</span>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.price === 0 ? '/signup' : `/signup?plan=${plan.id}`}>
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70'
                        : ''
                    }`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {plan.price === 0 ? 'Start Free' : 'Get Started'}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-card/30">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently asked questions
            </h2>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                q: 'How does Creator Engine make videos unique?',
                a: 'We apply micro-adjustments to brightness, saturation, hue, audio pitch, and crop that are imperceptible to humans but completely change the digital fingerprint of your video.',
              },
              {
                q: 'Will this get my accounts banned?',
                a: "No. The changes we make are indistinguishable from normal video compression and editing. Platforms can't detect our transformations.",
              },
              {
                q: 'What formats do you support?',
                a: 'We support all major video formats including MP4, MOV, AVI, and WebM. Maximum file size is 500MB.',
              },
              {
                q: 'How fast is processing?',
                a: 'Most videos are processed in under 3 seconds per variant. A batch of 100 variants typically completes in under 5 minutes.',
              },
              {
                q: 'How does billing work?',
                a: 'We use crypto payments for 30-day access periods. There are no auto-recurring charges — simply renew when your plan expires to keep your access.',
              },
            ].map((item, i) => (
              <motion.details
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-xl border border-border/50 bg-card/50"
              >
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <span className="font-medium">{item.q}</span>
                  <ChevronDown className="w-5 h-5 text-muted-foreground group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-6 pb-6 text-muted-foreground">
                  {item.a}
                </div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-accent/20" />
        <div className="absolute inset-0 grid-pattern opacity-30" />

        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to power up your content?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join 500+ agencies already using Creator Engine.
            </p>
            <Link href="/signup">
              <Button
                size="lg"
                className="h-14 px-8 text-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 glow-magenta group"
              >
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground mt-4">
              No signup fee • Pay with crypto • 5 free videos per month
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
