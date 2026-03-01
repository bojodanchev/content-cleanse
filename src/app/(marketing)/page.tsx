'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Zap,
  Shield,
  Layers,
  Clock,
  Download,
  Wand2,
  Check,
  ArrowRight,
  Play,
  ChevronDown,
  Video,
  Type,
  Users,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PLANS } from '@/lib/crypto/plans'
import FaceSwapDemo from '@/components/marketing/face-swap-demo'
import TestimonialsMarquee from '@/components/marketing/testimonials-marquee'

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

function DemoShowcase() {
  const [activeVariant, setActiveVariant] = useState(0)
  const [playingVariant, setPlayingVariant] = useState(-1)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const playVariant = useCallback((index: number) => {
    // Pause all variant videos
    videoRefs.current.forEach((v) => { if (v) { v.pause(); v.currentTime = 0 } })
    setPlayingVariant(-1)
    // Play the active one
    const vid = videoRefs.current[index]
    if (vid) {
      const onPlaying = () => {
        setPlayingVariant(index)
        vid.removeEventListener('playing', onPlaying)
      }
      vid.addEventListener('playing', onPlaying)
      vid.play().catch(() => {})
    }
    setActiveVariant(index)
  }, [])

  useEffect(() => {
    // Start cycling after a short delay
    const startDelay = setTimeout(() => {
      playVariant(0)
      intervalRef.current = setInterval(() => {
        setActiveVariant((prev) => {
          const next = (prev + 1) % 8
          playVariant(next)
          return next
        })
      }, 3500)
    }, 1500)

    return () => {
      clearTimeout(startDelay)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [playVariant])

  const handleClick = (index: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    playVariant(index)
    // Restart auto-cycle after 6s of inactivity
    intervalRef.current = setInterval(() => {
      setActiveVariant((prev) => {
        const next = (prev + 1) % 8
        playVariant(next)
        return next
      })
    }, 3500)
  }

  return (
    <div className="grid grid-cols-3 gap-4 h-[calc(100%-48px)]">
      {/* Left panel - source video */}
      <div className="col-span-1 rounded-xl border border-border/50 bg-secondary/30 p-4 flex flex-col">
        <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-black mb-3">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/demo/variant_001_poster.jpg"
            className="w-full h-full object-cover"
          >
            <source src="/demo/variant_001_web.mp4" type="video/mp4" />
          </video>
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-medium text-white">
            ORIGINAL
          </div>
        </div>
        <p className="font-medium text-sm truncate">summer_promo.mp4</p>
        <p className="text-xs text-muted-foreground mt-0.5">1080p · 0:09 · 2.1MB</p>
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-green-500" />
          </div>
          <span className="text-xs text-green-500 font-medium">Uploaded</span>
        </div>
      </div>

      {/* Right panel - variants */}
      <div className="col-span-2 rounded-xl border border-border/50 bg-secondary/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium">8 variants · Complete</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Showing variant {activeVariant + 1} of 8
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 h-[calc(100%-32px)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              onClick={() => handleClick(i)}
              className={`rounded-lg relative overflow-hidden bg-black cursor-pointer transition-all duration-300 ${
                activeVariant === i
                  ? 'ring-2 ring-primary shadow-lg shadow-primary/20 scale-[1.03]'
                  : 'border border-border/30 opacity-70 hover:opacity-100'
              }`}
            >
              {/* Poster image — only hide once video is actually playing */}
              <img
                src={`/demo/variant_00${i + 1}_poster.jpg`}
                alt={`Variant ${i + 1}`}
                className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${
                  playingVariant === i ? 'opacity-0' : 'opacity-100'
                }`}
              />
              {/* Video (only plays when active) */}
              <video
                ref={(el) => { videoRefs.current[i] = el }}
                muted
                loop
                playsInline
                poster={`/demo/variant_00${i + 1}_poster.jpg`}
                preload="none"
                className="w-full h-full object-cover"
              >
                <source src={`/demo/variant_00${i + 1}_web.mp4`} type="video/mp4" />
              </video>
              {/* Badge */}
              <div className="absolute top-1 right-1 flex items-center gap-1">
                {activeVariant === i && (
                  <span className="px-1.5 py-0.5 rounded bg-primary/80 text-[8px] font-bold text-white">
                    PLAYING
                  </span>
                )}
                <Check className="w-2.5 h-2.5 text-green-500/70" />
              </div>
              {/* Variant label */}
              <div className="absolute bottom-1 left-1">
                <span className="text-[9px] text-white/60 font-medium">v{i + 1}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
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
              Turn one video or photo into{' '}
              <span className="gradient-text">thousands of unique</span> variants
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeInUp}
              className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Stop getting flagged for duplicate content. Our AI transforms your
              videos and photos with invisible changes that bypass platform detection.
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
              No signup fee • Pay with crypto • 5 free projects per month
            </motion.p>
          </motion.div>

          {/* Hero visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-16 relative"
          >
            <div className="max-w-5xl mx-auto rounded-2xl overflow-hidden gradient-border relative">
              <div className="rounded-2xl bg-card">
                {/* Mockup of the dashboard */}
                <div className="bg-gradient-to-br from-card to-secondary/30 p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-destructive/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                    <div className="ml-2 flex-1 max-w-xs">
                      <div className="h-6 rounded-full bg-secondary/60 border border-border/30 flex items-center px-3">
                        <span className="text-[10px] text-muted-foreground truncate">creatorengine.app/dashboard</span>
                      </div>
                    </div>
                  </div>

                  <DemoShowcase />
                </div>
              </div>
            </div>

          </motion.div>

          {/* Inline stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-6 md:gap-8"
          >
            {[
              { icon: Zap, label: '<10s avg processing', color: 'text-primary' },
              { icon: Shield, label: '98.3% detection bypass', color: 'text-accent' },
              { icon: Layers, label: 'Unlimited variants', color: 'text-primary' },
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span>{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 border-y border-border/40">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Trusted by 25+ content agencies worldwide
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '800+', label: 'Files processed' },
              { value: '25+', label: 'Active agencies' },
              { value: '98.3%', label: 'Detection bypass' },
              { value: '<10s', label: 'Processing time' },
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
                  'Manually editing each video or photo takes hours. Time you could spend growing your business.',
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

      {/* Platform Tools Section */}
      <section id="features" className="py-24 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[200px]" />

        <div className="max-w-7xl mx-auto px-6 relative">
          {/* Enterprise section label + heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <p className="text-sm font-semibold text-primary mb-3 tracking-wide uppercase">
              The Creator Toolkit
            </p>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              One platform.{' '}
              <span className="gradient-text">Every tool you need.</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Four powerful tools to uniquify, caption, swap, and multiply your content — all from one dashboard.
            </p>
          </motion.div>

          {/* Tier 1: Product cards — 3-column grid */}
          <div className="grid md:grid-cols-3 gap-5 mb-5">
            {[
              {
                icon: Video,
                title: 'Video & Photo Uniquification',
                tag: 'Cleaner Pro v1.0',
                description:
                  'Turn one video or photo into thousands of unique variants. Invisible micro-adjustments to visuals, audio, and metadata that bypass every platform detection algorithm.',
                color: 'from-primary/20 to-primary/5',
                borderHover: 'hover:border-primary/60',
                tagColor: 'bg-primary/10 text-primary',
                iconColor: 'text-primary',
              },
              {
                icon: Type,
                title: 'Photo & Video Captions',
                tag: 'Caption Ultimate v1.0',
                description:
                  'Add captions to your photos manually or generate them with AI — niche-aware or image-analyzed. Render text overlays, apply augmentations, and export in bulk.',
                color: 'from-cyan-500/20 to-cyan-500/5',
                borderHover: 'hover:border-cyan-500/60',
                tagColor: 'bg-cyan-500/10 text-cyan-400',
                iconColor: 'text-cyan-400',
              },
              {
                icon: Copy,
                title: 'Carousel Multiply',
                tag: 'Bulk Variations',
                description:
                  'Take one finished carousel set and multiply it into dozens of uniquified copies. Each copy is visually distinct — ready for different accounts and ad sets.',
                color: 'from-amber-500/20 to-amber-500/5',
                borderHover: 'hover:border-amber-500/60',
                tagColor: 'bg-amber-500/10 text-amber-400',
                iconColor: 'text-amber-400',
              },
            ].map((tool, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`group relative p-7 rounded-2xl border border-border/50 bg-gradient-to-br ${tool.color} backdrop-blur-sm ${tool.borderHover} transition-all duration-300`}
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 rounded-xl bg-card/80 border border-border/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <tool.icon className={`w-7 h-7 ${tool.iconColor}`} />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide ${tool.tagColor}`}>
                    {tool.tag}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">{tool.title}</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed">{tool.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Face Swap — full-width interactive showcase */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="group rounded-2xl border border-border/50 bg-gradient-to-br from-violet-500/20 to-violet-500/5 backdrop-blur-sm hover:border-violet-500/60 transition-all duration-300 mb-8 overflow-hidden"
          >
            <div className="grid md:grid-cols-[45%_55%] gap-0">
              {/* Left — text content */}
              <div className="p-7 md:p-10 flex flex-col justify-center">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 rounded-xl bg-card/80 border border-border/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-7 h-7 text-violet-400" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-violet-500/10 text-violet-400">
                    Photos & Videos
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-3">Face Swap</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
                  Swap faces in photos and videos with AI precision. Create UGC-style variations at scale using reusable face profiles with one-click enhancement.
                </p>
                <Link href="/faceswap">
                  <Button className="bg-violet-600 hover:bg-violet-500 text-white group/btn w-fit">
                    Try Face Swap
                    <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>

              {/* Right — interactive slider */}
              <div className="p-4 md:p-6 md:pl-0">
                <FaceSwapDemo
                  beforeSrc="/demo/faceswap-before.jpg"
                  afterSrc="/demo/faceswap-after.jpg"
                />
              </div>
            </div>
          </motion.div>

          {/* Tier 2: Supporting features — 4-column strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {[
              { icon: Shield, label: 'Metadata Stripping', desc: 'Remove EXIF, randomize signatures' },
              { icon: Wand2, label: 'AI Watermark Removal', desc: 'Advanced inpainting detection' },
              { icon: Zap, label: 'Batch Processing', desc: 'Unlimited variants per upload' },
              { icon: Download, label: 'One-Click Download', desc: 'Everything in a single ZIP' },
            ].map((feat, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-xl border border-border/30 bg-card/30"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <feat.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{feat.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{feat.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialsMarquee />

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

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: '01',
                title: 'Upload',
                description:
                  'Drag and drop your video or photo. We support all major formats up to 50MB.',
              },
              {
                step: '02',
                title: 'Configure',
                description:
                  'Choose how many variants you need, add captions, or enable watermark removal.',
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
                transition={{ delay: i * 0.15 }}
                className="relative text-center md:text-left"
              >
                <div className="text-5xl font-bold text-primary/30 mb-3 tabular-nums">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
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
                  {plan.originalPrice ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-muted-foreground line-through">${plan.originalPrice}</span>
                        <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wide">
                          Sale
                        </span>
                      </div>
                      <span className="text-4xl font-bold">${plan.price}</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                  ) : (
                    <>
                      <span className="text-4xl font-bold">${plan.price}</span>
                      {plan.price > 0 && (
                        <span className="text-muted-foreground">/month</span>
                      )}
                    </>
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
                q: 'How does Creator Engine make content unique?',
                a: 'We apply micro-adjustments to brightness, saturation, hue, crop, and metadata that are imperceptible to humans but completely change the digital fingerprint of your video or photo.',
              },
              {
                q: 'Will this get my accounts banned?',
                a: "No. The changes we make are indistinguishable from normal video compression and editing. Platforms can't detect our transformations.",
              },
              {
                q: 'What formats do you support?',
                a: 'We support all major video formats (MP4, MOV, AVI, WebM) and image formats (JPG, PNG, WebP). Maximum file size is 50MB.',
              },
              {
                q: 'How fast is processing?',
                a: 'Most videos are processed in under 3 seconds per variant. Large batches typically complete in minutes.',
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
              Join 25+ agencies already using Creator Engine.
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
              No signup fee • Pay with crypto • 5 free projects per month
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
