'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, GripVertical, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AiCaptionForm } from './ai-caption-form'

interface CaptionEditorProps {
  captions: string[]
  onChange: (captions: string[]) => void
  onAiGenerate: (niche: string, style: string, count: number) => Promise<void>
  aiGenerating: boolean
  captionSource: 'manual' | 'ai'
  onSourceChange: (source: 'manual' | 'ai') => void
}

export function CaptionEditor({
  captions,
  onChange,
  onAiGenerate,
  aiGenerating,
  captionSource,
  onSourceChange,
}: CaptionEditorProps) {
  const [manualInput, setManualInput] = useState('')

  const handleManualPaste = () => {
    if (!manualInput.trim()) return
    const lines = manualInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    onChange([...captions, ...lines])
    setManualInput('')
  }

  const handleAddSingle = () => {
    onChange([...captions, ''])
  }

  const handleEdit = (index: number, value: string) => {
    const updated = [...captions]
    updated[index] = value
    onChange(updated)
  }

  const handleDelete = (index: number) => {
    onChange(captions.filter((_, i) => i !== index))
  }

  const handleClearAll = () => {
    onChange([])
  }

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
              Paste captions (one per line) or add individually
            </Label>
            <textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={"First caption here\nSecond caption here\nThird caption here"}
              rows={4}
              className="w-full rounded-xl border border-border/50 bg-secondary/30 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            <Button
              onClick={handleManualPaste}
              variant="outline"
              size="sm"
              disabled={!manualInput.trim()}
              className="border-border/50"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Captions
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <AiCaptionForm onGenerate={onAiGenerate} generating={aiGenerating} />
        </TabsContent>
      </Tabs>

      {/* Caption list */}
      {captions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">
              Captions ({captions.length})
            </Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Clear All
            </Button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout">
              {captions.map((caption, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 group"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                  <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <Input
                    value={caption}
                    onChange={(e) => handleEdit(i, e.target.value)}
                    className="flex-1 bg-secondary/30 border-border/40 text-sm h-9"
                    placeholder="Enter caption..."
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(i)}
                    className="shrink-0 h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleAddSingle}
            className="border-border/50 border-dashed"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Caption
          </Button>
        </div>
      )}
    </div>
  )
}
