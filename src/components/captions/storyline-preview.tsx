'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, Download, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getClient } from '@/lib/supabase/client'
import type { Job, Variant } from '@/lib/supabase/types'

interface StorylinePreviewProps {
  job: Job
  onDownload: () => void
  onNewJob: () => void
  elapsedTime: number
}

interface SlideData {
  url: string
  caption: string | null
  index: number
}

const SWIPE_THRESHOLD = 50

export function StorylinePreview({ job, onDownload, onNewJob, elapsedTime }: StorylinePreviewProps) {
  const [slides, setSlides] = useState<SlideData[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [direction, setDirection] = useState(0)

  const supabase = getClient()

  useEffect(() => {
    loadSlides()
  }, [job.id])

  const loadSlides = async () => {
    setLoading(true)
    try {
      // Fetch variants for this job, ordered by creation
      const { data: variants } = await supabase
        .from('variants')
        .select('*')
        .eq('job_id', job.id)
        .order('created_at', { ascending: true })

      if (!variants?.length) {
        setLoading(false)
        return
      }

      // Get signed URLs for each variant's output image
      const slidePromises = variants.map(async (variant: Variant, i: number) => {
        if (!variant.file_path) return null
        const { data } = await supabase.storage
          .from('outputs')
          .createSignedUrl(variant.file_path, 3600)
        if (!data?.signedUrl) return null
        return {
          url: data.signedUrl,
          caption: variant.caption_text,
          index: i,
        }
      })

      const results = await Promise.all(slidePromises)
      setSlides(results.filter((s): s is SlideData => s !== null))
    } catch (err) {
      console.error('Failed to load preview slides:', err)
    } finally {
      setLoading(false)
    }
  }

  const goTo = useCallback((index: number) => {
    setCurrent((prev) => {
      setDirection(index > prev ? 1 : -1)
      return index
    })
  }, [])

  const next = useCallback(() => {
    if (current < slides.length - 1) {
      setDirection(1)
      setCurrent((p) => p + 1)
    }
  }, [current, slides.length])

  const prev = useCallback(() => {
    if (current > 0) {
      setDirection(-1)
      setCurrent((p) => p - 1)
    }
  }, [current])

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) next()
    else if (info.offset.x > SWIPE_THRESHOLD) prev()
  }, [next, prev])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, prev])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Loading preview...</p>
      </div>
    )
  }

  if (slides.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No preview available</p>
        <div className="flex items-center justify-center gap-4">
          <Button onClick={onDownload} className="bg-gradient-to-r from-primary to-primary/80">
            <Download className="w-4 h-4 mr-2" />
            Download ZIP
          </Button>
          <Button onClick={onNewJob} variant="outline">
            Process Another
          </Button>
        </div>
      </div>
    )
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-bold mb-1">Your Storyline</h3>
        <p className="text-sm text-muted-foreground">
          {slides.length} slides &middot; Processed in {formatTime(elapsedTime)}
        </p>
      </div>

      {/* Phone mockup */}
      <div className="relative flex items-center gap-3">
        {/* Left arrow */}
        <button
          onClick={prev}
          disabled={current === 0}
          className="shrink-0 w-9 h-9 rounded-full bg-secondary/60 hover:bg-secondary flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Phone frame */}
        <div className="relative w-[280px] h-[498px] rounded-[2rem] border-[3px] border-white/10 bg-black overflow-hidden shadow-[0_0_60px_rgba(255,0,255,0.08)]">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-b-2xl z-30" />

          {/* Story progress bars */}
          <div className="absolute top-6 left-3 right-3 z-20 flex gap-1">
            {slides.map((_, i) => (
              <div
                key={i}
                className="h-[2px] flex-1 rounded-full overflow-hidden bg-white/20"
              >
                <motion.div
                  className="h-full bg-white/80"
                  initial={false}
                  animate={{
                    width: i < current ? '100%' : i === current ? '100%' : '0%',
                  }}
                  transition={{ duration: i === current ? 0.3 : 0 }}
                />
              </div>
            ))}
          </div>

          {/* Slide counter */}
          <div className="absolute top-7 right-4 z-20">
            <span className="text-[10px] font-medium text-white/60 tabular-nums">
              {current + 1}/{slides.length}
            </span>
          </div>

          {/* Slide content */}
          <div className="relative w-full h-full overflow-hidden">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div
                key={slides[current].url}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={handleDragEnd}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
              >
                {/* Image */}
                <img
                  src={slides[current].url}
                  alt={`Slide ${current + 1}`}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  draggable={false}
                />

                {/* Caption overlay */}
                {slides[current].caption && (
                  <div className="absolute inset-x-0 bottom-0 p-4 pt-16 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                    <p className="text-white text-sm leading-relaxed font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                      {slides[current].caption}
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Tap zones for prev/next */}
            <div
              className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer"
              onClick={prev}
            />
            <div
              className="absolute inset-y-0 right-0 w-1/3 z-10 cursor-pointer"
              onClick={next}
            />
          </div>
        </div>

        {/* Right arrow */}
        <button
          onClick={next}
          disabled={current === slides.length - 1}
          className="shrink-0 w-9 h-9 rounded-full bg-secondary/60 hover:bg-secondary flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-200 ${
                i === current
                  ? 'w-6 h-2 bg-primary'
                  : 'w-2 h-2 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={onDownload}
          className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        >
          <Download className="w-4 h-4 mr-2" />
          Download ZIP
        </Button>
        <Button onClick={onNewJob} variant="outline">
          <RotateCcw className="w-4 h-4 mr-2" />
          New Storyline
        </Button>
      </div>
    </div>
  )
}
