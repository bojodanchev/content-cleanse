'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface CaptionsDemoProps {
  slides: Array<{ src: string; caption: string }>
}

export default function CaptionsDemo({ slides }: CaptionsDemoProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(containerRef, { amount: 0.3, once: true })

  return (
    <div ref={containerRef} className="relative">
      {/* Glow behind strip */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{ boxShadow: '0 0 40px rgba(0,200,255,0.1)' }}
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.15 * slides.length + 0.3, duration: 0.6 }}
      />

      {/* Filmstrip */}
      <div className="flex gap-2">
        {slides.map((slide, i) => (
          <motion.div
            key={i}
            className="rounded-xl overflow-hidden aspect-[9/16] flex-1"
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            transition={{
              delay: i * 0.15,
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <img
              src={slide.src}
              alt={slide.caption}
              draggable={false}
              className="w-full h-full object-cover"
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
