'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface AiCaptionFormProps {
  onGenerate: (niche: string, style: string, count: number) => Promise<void>
  generating: boolean
}

const NICHES = [
  'nurse', 'gym', 'mom', 'finance', 'teacher', 'realtor',
  'cosplay', 'gamer', 'travel', 'foodie', 'fashion', 'fitness',
]

const STYLES = [
  { id: 'drama', label: 'Drama', desc: 'Emotional hooks' },
  { id: 'listicle', label: 'Listicle', desc: 'Numbered lists' },
  { id: 'cliffhanger', label: 'Cliffhanger', desc: 'Suspenseful' },
  { id: 'mixed', label: 'Mixed', desc: 'Variety pack' },
]

const COUNTS = [10, 25, 50]

export function AiCaptionForm({ onGenerate, generating }: AiCaptionFormProps) {
  const [niche, setNiche] = useState<string>('nurse')
  const [style, setStyle] = useState<string>('mixed')
  const [count, setCount] = useState<number>(10)

  const handleGenerate = () => {
    onGenerate(niche, style, count)
  }

  return (
    <div className="space-y-6">
      {/* Niche selector */}
      <div className="space-y-3">
        <Label className="text-base font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Niche
        </Label>
        <div className="flex flex-wrap gap-2">
          {NICHES.map((n) => (
            <Button
              key={n}
              variant={niche === n ? 'default' : 'outline'}
              size="sm"
              onClick={() => setNiche(n)}
              className={cn(
                'capitalize',
                niche === n ? 'bg-primary' : 'border-border/50'
              )}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      {/* Style selector */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Style</Label>
        <div className="grid grid-cols-2 gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={cn(
                'p-3 rounded-xl border text-left transition-all',
                style === s.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border/50 bg-card/50 hover:border-primary/30'
              )}
            >
              <p className="font-medium text-sm">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Count selector */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Number of Captions</Label>
        <div className="flex gap-2">
          {COUNTS.map((c) => (
            <Button
              key={c}
              variant={count === c ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCount(c)}
              className={cn(
                count === c ? 'bg-primary' : 'border-border/50'
              )}
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating captions...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate {count} Captions
            </>
          )}
        </Button>
      </motion.div>
    </div>
  )
}
