'use client'

import { useState } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Face } from '@/lib/supabase/types'

interface FaceCardProps {
  face: Face
  selected: boolean
  onSelect: (face: Face) => void
  onDelete: (faceId: string) => void
  thumbnailUrl: string | null
}

export function FaceCard({ face, selected, onSelect, onDelete, thumbnailUrl }: FaceCardProps) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleting(true)
    await onDelete(face.id)
    setDeleting(false)
  }

  return (
    <button
      onClick={() => onSelect(face)}
      className={cn(
        'relative group rounded-xl border-2 p-3 transition-all text-left w-full',
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border/50 hover:border-primary/50 bg-card/50'
      )}
    >
      <div className="aspect-square rounded-lg overflow-hidden bg-secondary/30 mb-2">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={face.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-2xl font-bold">
            {face.name[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <p className="text-sm font-medium truncate">{face.name}</p>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDelete}
        disabled={deleting}
        className="absolute top-1 right-1 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive/80 hover:bg-destructive text-white"
      >
        {deleting ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Trash2 className="w-3 h-3" />
        )}
      </Button>
    </button>
  )
}
