'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useInView } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface FaceSwapDemoProps {
  beforeSrc: string
  afterSrc: string
}

export default function FaceSwapDemo({ beforeSrc, afterSrc }: FaceSwapDemoProps) {
  const [sliderPosition, setSliderPosition] = useState(65)
  const [isDragging, setIsDragging] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { once: true })

  const clamp = (value: number) => Math.min(100, Math.max(0, value))

  const getPositionFromEvent = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return sliderPosition
      const rect = containerRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      return clamp((x / rect.width) * 100)
    },
    [sliderPosition]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true)
      setHasAnimated(true)
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      containerRef.current?.setPointerCapture?.(e.pointerId)
      setSliderPosition(getPositionFromEvent(e.clientX))
    },
    [getPositionFromEvent]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      setSliderPosition(getPositionFromEvent(e.clientX))
    },
    [isDragging, getPositionFromEvent]
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Auto-animate from 65 -> 35 on first scroll into view
  useEffect(() => {
    if (!isInView || hasAnimated) return

    const duration = 1500
    const startPos = 65
    const endPos = 35
    const startTime = performance.now()

    let frameId: number

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const currentPos = startPos + (endPos - startPos) * eased

      setSliderPosition(currentPos)

      if (progress < 1) {
        frameId = requestAnimationFrame(animate)
      } else {
        setHasAnimated(true)
      }
    }

    frameId = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(frameId)
  }, [isInView, hasAnimated])

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none ring-1 ring-violet-500/20"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none' }}
    >
      {/* Before image (base layer) */}
      <img
        src={beforeSrc}
        alt="Before face swap"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* After image (clipped overlay) */}
      <img
        src={afterSrc}
        alt="After face swap"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          clipPath: `inset(0 0 0 ${sliderPosition}%)`,
        }}
      />

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-violet-500"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
      />

      {/* Drag handle */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="bg-violet-500 rounded-full w-10 h-10 flex items-center justify-center shadow-lg shadow-violet-500/30">
          <ChevronLeft className="w-4 h-4 text-white -mr-1" />
          <ChevronRight className="w-4 h-4 text-white -ml-1" />
        </div>
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-sm text-white/90">
        Before
      </span>
      <span className="absolute top-3 right-3 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-sm text-white/90">
        After
      </span>
    </div>
  )
}
