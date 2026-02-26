'use client'

import { motion } from 'framer-motion'
import { Type, AlignVerticalJustifyCenter, Film, Shield, Lock } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface CaptionSettingsValues {
  fontSize: 'small' | 'medium' | 'large'
  position: 'top' | 'center' | 'bottom'
  generateVideo: boolean
}

interface CaptionSettingsProps {
  settings: CaptionSettingsValues
  onChange: (settings: CaptionSettingsValues) => void
  captionCount: number
  previewUrl: string | null
}

const FONT_SIZES: { id: CaptionSettingsValues['fontSize']; label: string; desc: string }[] = [
  { id: 'small', label: 'Small', desc: '60px' },
  { id: 'medium', label: 'Medium', desc: '80px' },
  { id: 'large', label: 'Large', desc: '100px' },
]

const POSITIONS: { id: CaptionSettingsValues['position']; label: string; desc: string }[] = [
  { id: 'top', label: 'Top', desc: '10% from top' },
  { id: 'center', label: 'Center', desc: 'Middle' },
  { id: 'bottom', label: 'Bottom', desc: '90% from top' },
]

export function CaptionSettings({
  settings,
  onChange,
  captionCount,
  previewUrl,
}: CaptionSettingsProps) {
  return (
    <div className="space-y-6">
      {/* Preview thumbnail */}
      {previewUrl && (
        <div className="space-y-3">
          <Label className="text-base font-medium">Preview</Label>
          <div className="relative w-full max-w-[200px] mx-auto aspect-[9/16] rounded-xl overflow-hidden border border-border/50 bg-secondary/30">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            {/* Caption position overlay */}
            <div
              className={cn(
                'absolute left-0 right-0 px-3 flex items-center justify-center',
                settings.position === 'top' && 'top-[10%]',
                settings.position === 'center' && 'top-1/2 -translate-y-1/2',
                settings.position === 'bottom' && 'bottom-[10%]'
              )}
            >
              <div
                className={cn(
                  'bg-black/60 rounded px-2 py-1 text-center',
                  settings.fontSize === 'small' && 'text-[8px]',
                  settings.fontSize === 'medium' && 'text-[10px]',
                  settings.fontSize === 'large' && 'text-[12px]'
                )}
              >
                <span className="text-white font-bold uppercase tracking-wide"
                  style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                >
                  SAMPLE CAPTION
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Font size */}
      <div className="space-y-3">
        <Label className="text-base font-medium flex items-center gap-2">
          <Type className="w-4 h-4 text-primary" />
          Font Size
        </Label>
        <div className="flex gap-2">
          {FONT_SIZES.map((size) => (
            <Button
              key={size.id}
              variant={settings.fontSize === size.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ ...settings, fontSize: size.id })}
              className={cn(
                'flex-1',
                settings.fontSize === size.id ? 'bg-primary' : 'border-border/50'
              )}
            >
              <div className="text-center">
                <div>{size.label}</div>
                <div className="text-[10px] opacity-70">{size.desc}</div>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Position */}
      <div className="space-y-3">
        <Label className="text-base font-medium flex items-center gap-2">
          <AlignVerticalJustifyCenter className="w-4 h-4 text-primary" />
          Text Position
        </Label>
        <div className="flex gap-2">
          {POSITIONS.map((pos) => (
            <Button
              key={pos.id}
              variant={settings.position === pos.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange({ ...settings, position: pos.id })}
              className={cn(
                'flex-1',
                settings.position === pos.id ? 'bg-primary' : 'border-border/50'
              )}
            >
              {pos.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Generate video — coming soon */}
      <div className="space-y-3">
        <Label className="text-base font-medium flex items-center gap-2">
          <Film className="w-4 h-4 text-muted-foreground/50" />
          <span className="text-muted-foreground/50">Slideshow Video</span>
        </Label>
        <div className="relative w-full rounded-xl border border-border/30 bg-card/30 overflow-hidden select-none">
          {/* Chain pattern overlay */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              currentColor 10px,
              currentColor 12px
            )`,
          }} />

          <div className="relative flex flex-col items-center justify-center py-8 px-4 gap-3">
            {/* Lock icon with chain ring */}
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <Lock className="w-6 h-6 text-muted-foreground/50" />
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground/60">
                Coming Soon
              </p>
              <p className="text-xs text-muted-foreground/40 mt-1">
                Generate MP4 slideshows from captioned images
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl bg-secondary/30 border border-border/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-accent" />
          <span className="font-medium">Processing Summary</span>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center justify-between">
            <span>Captioned images</span>
            <span className="font-medium text-foreground">{captionCount}</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Font size</span>
            <span className="font-medium text-foreground capitalize">{settings.fontSize}</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Position</span>
            <span className="font-medium text-foreground capitalize">{settings.position}</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Slideshow video</span>
            <span className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">Soon</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
