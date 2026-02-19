'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AiCaptionForm } from './ai-caption-form'

export interface CarouselPhoto {
  id: string
  file: File
  previewUrl: string
  caption: string
}

interface CaptionEditorProps {
  photos: CarouselPhoto[]
  onPhotosChange: (photos: CarouselPhoto[]) => void
  onAiGenerate: (niche: string, style: string, count: number) => Promise<void>
  aiGenerating: boolean
  captionSource: 'manual' | 'ai'
  onSourceChange: (source: 'manual' | 'ai') => void
}

export function CaptionEditor({
  photos,
  onPhotosChange,
  onAiGenerate,
  aiGenerating,
  captionSource,
  onSourceChange,
}: CaptionEditorProps) {
  const [bulkInput, setBulkInput] = useState('')

  const handleCaptionEdit = (id: string, value: string) => {
    onPhotosChange(
      photos.map((p) => (p.id === id ? { ...p, caption: value } : p))
    )
  }

  const handleBulkPaste = () => {
    if (!bulkInput.trim()) return
    const lines = bulkInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    // Distribute lines across photos in order
    const updated = photos.map((p, i) => ({
      ...p,
      caption: i < lines.length ? lines[i] : p.caption,
    }))
    onPhotosChange(updated)
    setBulkInput('')
  }

  const handleClearAllCaptions = () => {
    onPhotosChange(photos.map((p) => ({ ...p, caption: '' })))
  }

  const filledCount = photos.filter((p) => p.caption.trim().length > 0).length

  return (
    <div className="space-y-4">
      <Tabs
        value={captionSource}
        onValueChange={(v) => onSourceChange(v as 'manual' | 'ai')}
      >
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
          <TabsTrigger value="manual" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <PenLine className="w-4 h-4 mr-2" />
            Manual
          </TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <span className="gradient-text font-semibold mr-1">AI</span>
            Generated
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Paste captions (one per line) to fill photos in order
            </Label>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder={"Caption for photo 1\nCaption for photo 2\nCaption for photo 3"}
              rows={3}
              className="w-full rounded-xl border border-border/50 bg-secondary/30 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            <Button
              onClick={handleBulkPaste}
              variant="outline"
              size="sm"
              disabled={!bulkInput.trim()}
              className="border-border/50"
            >
              <Plus className="w-4 h-4 mr-1" />
              Apply Captions
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AiCaptionForm
            onGenerate={onAiGenerate}
            generating={aiGenerating}
            photoCount={photos.length}
          />
        </TabsContent>
      </Tabs>

      {/* Per-photo caption list */}
      {photos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">
              Captions ({filledCount}/{photos.length})
            </Label>
            {filledCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllCaptions}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout">
              {photos.map((photo, i) => (
                <motion.div
                  key={photo.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-start gap-3 rounded-xl border border-border/40 bg-secondary/20 p-3"
                >
                  {/* Thumbnail */}
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border/50 shrink-0">
                    <img
                      src={photo.previewUrl}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-0 left-0 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br-md">
                      {i + 1}
                    </div>
                  </div>
                  {/* Caption input */}
                  <textarea
                    value={photo.caption}
                    onChange={(e) => handleCaptionEdit(photo.id, e.target.value)}
                    placeholder={`Caption for photo ${i + 1}...`}
                    rows={2}
                    className="flex-1 rounded-lg border border-border/40 bg-background/50 p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  )
}
