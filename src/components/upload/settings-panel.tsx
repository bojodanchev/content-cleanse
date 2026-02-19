'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Shield, Layers } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ProcessingSettings {
  variantCount: number
  removeWatermark: boolean
  addWatermark: boolean
}

interface SettingsPanelProps {
  settings: ProcessingSettings
  onChange: (settings: ProcessingSettings) => void
  maxVariants: number
  canRemoveWatermark: boolean
  mediaType?: 'video' | 'image'
}

const PRESET_COUNTS = [10, 25, 50, 100]

export function SettingsPanel({
  settings,
  onChange,
  maxVariants,
  canRemoveWatermark,
  mediaType = 'video',
}: SettingsPanelProps) {
  const [customCount, setCustomCount] = useState(false)

  return (
    <div className="space-y-6">
      {/* Variant count */}
      <div className="space-y-3">
        <Label className="text-base font-medium flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          Number of Variants
        </Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COUNTS.filter((count) => count <= maxVariants).map((count) => (
            <Button
              key={count}
              variant={settings.variantCount === count && !customCount ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCustomCount(false)
                onChange({ ...settings, variantCount: count })
              }}
              className={cn(
                settings.variantCount === count && !customCount
                  ? 'bg-primary'
                  : 'border-border/50'
              )}
            >
              {count}
            </Button>
          ))}
          <Button
            variant={customCount ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCustomCount(true)}
            className={cn(customCount ? 'bg-primary' : 'border-border/50')}
          >
            Custom
          </Button>
        </div>
        {customCount && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-3"
          >
            <Input
              type="number"
              min={1}
              max={maxVariants}
              value={settings.variantCount}
              onChange={(e) =>
                onChange({
                  ...settings,
                  variantCount: Math.min(
                    Math.max(1, parseInt(e.target.value) || 1),
                    maxVariants
                  ),
                })
              }
              className="w-24 bg-secondary/50"
            />
            <span className="text-sm text-muted-foreground">
              Max: {maxVariants}
            </span>
          </motion.div>
        )}
      </div>

      {/* Watermark removal */}
      {mediaType !== 'image' && (
        <div className="space-y-3">
          <Label className="text-base font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Watermark Removal
          </Label>
          <button
            onClick={() =>
              canRemoveWatermark &&
              onChange({ ...settings, removeWatermark: !settings.removeWatermark })
            }
            disabled={!canRemoveWatermark}
            className={cn(
              'w-full p-4 rounded-xl border text-left transition-all',
              settings.removeWatermark
                ? 'border-primary bg-primary/10'
                : 'border-border/50 bg-card/50',
              !canRemoveWatermark && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
                  settings.removeWatermark
                    ? 'border-primary bg-primary'
                    : 'border-muted-foreground'
                )}
              >
                {settings.removeWatermark && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-2 h-2 rounded-full bg-white"
                  />
                )}
              </div>
              <div>
                <p className="font-medium">AI Watermark Removal</p>
                <p className="text-sm text-muted-foreground">
                  {canRemoveWatermark
                    ? 'Automatically detect and remove watermarks using AI inpainting'
                    : 'Upgrade to Pro to unlock watermark removal'}
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-xl bg-secondary/30 border border-border/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-accent" />
          <span className="font-medium">Processing Summary</span>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center justify-between">
            <span>Variants to create</span>
            <span className="font-medium text-foreground">
              {settings.variantCount}
            </span>
          </li>
          {mediaType !== 'image' && (
            <li className="flex items-center justify-between">
              <span>Watermark removal</span>
              <span className="font-medium text-foreground">
                {settings.removeWatermark ? 'Yes' : 'No'}
              </span>
            </li>
          )}
          <li className="flex items-center justify-between">
            <span>Estimated time</span>
            <span className="font-medium text-foreground">
              ~{Math.ceil(settings.variantCount * 0.03)} min
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}
