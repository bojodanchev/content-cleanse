'use client'

import { motion } from 'framer-motion'

interface MapMarkerProps {
  cx: number
  cy: number
  color: 'primary' | 'accent'
  index: number
  onHover: (e: React.MouseEvent<SVGCircleElement>) => void
  onLeave: () => void
}

const colorMap = {
  primary: { fill: 'hsl(318 100% 60%)', glow: 'hsl(318 100% 60% / 0.6)' },
  accent: { fill: 'hsl(185 100% 50%)', glow: 'hsl(185 100% 50% / 0.6)' },
}

export function MapMarker({ cx, cy, color, index, onHover, onLeave }: MapMarkerProps) {
  const colors = colorMap[color]
  const pingDuration = 1.5 + (index % 5) * 0.25 // Vary 1.5s–2.5s to avoid sync

  return (
    <motion.g
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay: index * 0.05,
      }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      {/* Pulsing ring */}
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="none"
        stroke={colors.fill}
        strokeWidth={1}
        opacity={0}
        style={{
          animation: `marker-ping ${pingDuration}s ease-out infinite`,
          animationDelay: `${index * 0.05}s`,
        }}
      />

      {/* Solid dot with glow */}
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={colors.fill}
        style={{
          filter: `drop-shadow(0 0 4px ${colors.glow}) drop-shadow(0 0 8px ${colors.glow})`,
        }}
      />

      {/* Invisible hit area for hover */}
      <circle
        cx={cx}
        cy={cy}
        r={12}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onMouseEnter={(e) => onHover(e)}
        onMouseLeave={onLeave}
      />
    </motion.g>
  )
}
