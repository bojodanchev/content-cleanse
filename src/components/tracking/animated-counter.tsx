'use client'

import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, animate } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  suffix?: string
  prefix?: string
  decimals?: number
}

export function AnimatedCounter({ value, suffix = '', prefix = '', decimals = 0 }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (isInView) {
      const controls = animate(motionValue, value, {
        duration: 2,
        ease: 'easeOut',
      })
      return controls.stop
    }
  }, [isInView, motionValue, value])

  useEffect(() => {
    const unsubscribe = motionValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = prefix + latest.toFixed(decimals) + suffix
      }
    })
    return unsubscribe
  }, [motionValue, prefix, suffix, decimals])

  return <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>{prefix}0{suffix}</span>
}
