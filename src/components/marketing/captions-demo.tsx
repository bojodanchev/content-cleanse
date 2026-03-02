'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react'

interface CaptionsDemoProps {
  slides: Array<{ src: string; caption: string }>
}

export default function CaptionsDemo({ slides }: CaptionsDemoProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInView = useInView(containerRef, { amount: 0.5 })

  const goTo = useCallback(
    (next: number, dir: number) => {
      if (next < 0 || next >= slides.length) return
      setDirection(dir)
      setCurrentIndex(next)
    },
    [slides.length]
  )

  const goNext = useCallback(() => {
    setDirection(1)
    setCurrentIndex((i) => (i + 1) % slides.length)
  }, [slides.length])

  const goPrev = useCallback(() => {
    setDirection(-1)
    setCurrentIndex((i) => (i - 1 + slides.length) % slides.length)
  }, [slides.length])

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current)
      restartTimeoutRef.current = null
    }
    if (startDelayRef.current) {
      clearTimeout(startDelayRef.current)
      startDelayRef.current = null
    }
  }, [])

  const startAutoAdvance = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(goNext, 2500)
  }, [goNext])

  // Auto-advance when in view
  useEffect(() => {
    if (isInView) {
      startDelayRef.current = setTimeout(() => {
        goNext()
        startAutoAdvance()
      }, 1000)
    } else {
      clearTimers()
    }
    return clearTimers
  }, [isInView, startAutoAdvance, goNext, clearTimers])

  const handleManualInteraction = useCallback(
    (action: () => void) => {
      clearTimers()
      action()
      restartTimeoutRef.current = setTimeout(startAutoAdvance, 5000)
    },
    [clearTimers, startAutoAdvance]
  )

  const handleTap = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const third = rect.width / 3
      if (x < third) {
        handleManualInteraction(goPrev)
      } else if (x > third * 2) {
        handleManualInteraction(goNext)
      }
    },
    [handleManualInteraction, goNext, goPrev]
  )

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number } }) => {
      if (Math.abs(info.offset.x) > 40) {
        if (info.offset.x < 0) {
          handleManualInteraction(goNext)
        } else {
          handleManualInteraction(goPrev)
        }
      }
    },
    [handleManualInteraction, goNext, goPrev]
  )

  // Keyboard navigation
  useEffect(() => {
    if (!isInView) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleManualInteraction(goNext)
      if (e.key === 'ArrowLeft') handleManualInteraction(goPrev)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isInView, handleManualInteraction, goNext, goPrev])

  return (
    <div
      ref={containerRef}
      className="w-[280px] h-[498px] rounded-[2rem] border-[3px] border-white/10 bg-black relative overflow-hidden shadow-[0_0_60px_rgba(0,200,255,0.08)]"
    >
      {/* Notch */}
      <div className="w-28 h-5 bg-black rounded-b-2xl absolute top-0 left-1/2 -translate-x-1/2 z-20" />

      {/* Instagram header */}
      <div className="flex items-center px-3 h-9 border-b border-white/10 mt-5">
        <div className="w-7 h-7 rounded-full bg-white/20 flex-shrink-0" />
        <span className="text-[13px] font-semibold text-white ml-2">creatorengine</span>
        <MoreHorizontal className="w-4 h-4 text-white/60 ml-auto" />
      </div>

      {/* Image viewport */}
      <div className="aspect-square w-full overflow-hidden relative" onClick={handleTap}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={currentIndex}
            src={slides[currentIndex].src}
            alt={slides[currentIndex].caption}
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ x: direction > 0 ? 280 : -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction > 0 ? -280 : 280, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
          />
        </AnimatePresence>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <Heart className="w-5 h-5 text-white/80" />
          <MessageCircle className="w-5 h-5 text-white/80" />
          <Send className="w-5 h-5 text-white/80" />
        </div>
        <Bookmark className="w-5 h-5 text-white/80" />
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1 py-1.5">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
              i === currentIndex ? 'bg-cyan-400' : 'bg-white/30'
            }`}
          />
        ))}
      </div>

      {/* Caption area */}
      <div className="px-3 pb-2">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentIndex}
            className="text-[11px] text-white/90 leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <span className="font-semibold">creatorengine</span>{' '}
            {slides[currentIndex].caption}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
