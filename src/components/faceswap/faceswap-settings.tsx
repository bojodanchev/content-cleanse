'use client'

import { motion } from 'framer-motion'
import { Layers, Shield } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

export interface FaceswapSettingsValues {
  swapOnly: boolean
  variantCount: number
}

interface FaceswapSettingsProps {
  settings: FaceswapSettingsValues
  onChange: (settings: FaceswapSettingsValues) => void
  maxVariants: number
  sourcePreviewUrl: string | null
  facePreviewUrl: string | null
}

export function FaceswapSettings({
  settings,
  onChange,
  maxVariants,
  sourcePreviewUrl,
  facePreviewUrl,
}: FaceswapSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Preview */}
      {(sourcePreviewUrl || facePreviewUrl) && (
        <div className="flex items-center justify-center gap-4">
          {sourcePreviewUrl && (
            <div className="text-center">
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-border/50 mx-auto mb-1">
                <img src={sourcePreviewUrl} alt="Source" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs text-muted-foreground">Source</span>
            </div>
          )}
          {sourcePreviewUrl && facePreviewUrl && (
            <span className="text-2xl text-muted-foreground">&rarr;</span>
          )}
          {facePreviewUrl && (
            <div className="text-center">
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-primary/50 mx-auto mb-1">
                <img src={facePreviewUrl} alt="Face" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs text-primary">Model Face</span>
            </div>
          )}
        </div>
      )}

      {/* Swap mode toggle */}
      <div className="space-y-3">
        <Label className="text-base font-medium flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          Output Mode
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onChange({ ...settings, swapOnly: true })}
            className={cn(
              'p-4 rounded-xl border text-left transition-all',
              settings.swapOnly
                ? 'border-primary bg-primary/10'
                : 'border-border/50 bg-card/50 hover:border-primary/30'
            )}
          >
            <p className="font-medium">Swap Only</p>
            <p className="text-sm text-muted-foreground mt-1">
              One output with the face swapped
            </p>
          </button>
          <button
            onClick={() => onChange({ ...settings, swapOnly: false, variantCount: Math.max(settings.variantCount, 2) })}
            className={cn(
              'p-4 rounded-xl border text-left transition-all',
              !settings.swapOnly
                ? 'border-primary bg-primary/10'
                : 'border-border/50 bg-card/50 hover:border-primary/30'
            )}
          >
            <p className="font-medium">Swap + Variants</p>
            <p className="text-sm text-muted-foreground mt-1">
              Swap face, then create unique variants
            </p>
          </button>
        </div>
      </div>

      {/* Variant count slider */}
      {!settings.swapOnly && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Variant Count</Label>
            <span className="text-sm font-medium text-primary">{settings.variantCount}</span>
          </div>
          <Slider
            value={[settings.variantCount]}
            onValueChange={([value]) => onChange({ ...settings, variantCount: value })}
            min={2}
            max={maxVariants}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            Each variant gets unique visual tweaks (brightness, color, crop) for platform detection bypass
          </p>
        </motion.div>
      )}

      {/* Summary */}
      <div className="rounded-xl bg-secondary/30 border border-border/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-accent" />
          <span className="font-medium">Processing Summary</span>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center justify-between">
            <span>Mode</span>
            <span className="font-medium text-foreground">
              {settings.swapOnly ? 'Swap only' : 'Swap + variants'}
            </span>
          </li>
          {!settings.swapOnly && (
            <li className="flex items-center justify-between">
              <span>Variants</span>
              <span className="font-medium text-foreground">{settings.variantCount}</span>
            </li>
          )}
          <li className="flex items-center justify-between">
            <span>Output files</span>
            <span className="font-medium text-foreground">
              {settings.swapOnly ? 1 : settings.variantCount}
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}
