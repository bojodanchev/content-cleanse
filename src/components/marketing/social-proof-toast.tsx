'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

const NAMES = [
  'James', 'Alex', 'David', 'Chris', 'Ryan',
  'Marcus', 'Liam', 'Brandon', 'Tyler', 'Jake',
  'Matt', 'Noah', 'Ethan', 'Dylan', 'Kyle',
]

const LAST_INITIALS = ['M.', 'K.', 'R.', 'T.', 'W.', 'P.', 'H.', 'D.', 'S.', 'J.', 'B.', 'N.']

const TIME_AGO = [
  'just now', '2 minutes ago', '5 minutes ago', '8 minutes ago', '12 minutes ago',
]

const STORAGE_KEY = 'social-proof-shown'

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomDelay() {
  return 3000 + Math.random() * 3000 // 3–6s
}

export function SocialProofToast() {
  const [visible, setVisible] = useState(false)
  const [data, setData] = useState<{ name: string; plan: string; time: string } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(STORAGE_KEY)) return

    const plan = Math.random() < 0.7 ? 'Pro' : 'Agency'
    const firstName = pick(NAMES)
    const name = Math.random() < 0.5 ? `${firstName} ${pick(LAST_INITIALS)}` : firstName
    setData({ name, plan, time: pick(TIME_AGO) })

    const showTimer = setTimeout(() => {
      sessionStorage.setItem(STORAGE_KEY, '1')
      setVisible(true)
    }, randomDelay())

    return () => clearTimeout(showTimer)
  }, [])

  useEffect(() => {
    if (!visible) return
    const hideTimer = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(hideTimer)
  }, [visible])

  if (!data) return null

  const initial = data.name.charAt(0)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, x: 0 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-white/10 bg-black/70 px-4 py-3 shadow-2xl backdrop-blur-xl"
        >
          {/* Avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
            {initial}
          </div>

          {/* Text */}
          <div className="pr-2">
            <p className="text-sm font-medium text-white">
              {data.name}{' '}
              <span className="text-muted-foreground">upgraded to</span>{' '}
              <span className="text-primary">{data.plan}</span>
            </p>
            <p className="text-xs text-muted-foreground">{data.time}</p>
          </div>

          {/* Close */}
          <button
            onClick={() => setVisible(false)}
            className="ml-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
