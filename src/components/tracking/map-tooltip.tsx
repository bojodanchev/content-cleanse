'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Users } from 'lucide-react'

interface MapTooltipProps {
  city: string
  country: string
  users: number
  x: number
  y: number
  visible: boolean
}

export function MapTooltip({ city, country, users, x, y, visible }: MapTooltipProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          className="absolute z-50 pointer-events-none"
          style={{ left: x, top: y, transform: 'translate(-50%, -100%)' }}
        >
          <div className="glass rounded-lg px-3 py-2 mb-2 min-w-[140px]">
            <p className="text-sm font-semibold text-foreground">{city}</p>
            <p className="text-xs text-muted-foreground">{country}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Users className="w-3 h-3 text-primary" />
              <span className="text-xs text-foreground font-medium">{users.toLocaleString()} active</span>
            </div>
          </div>
          {/* Arrow pointer */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-0 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-[hsl(var(--card)/0.6)]" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
