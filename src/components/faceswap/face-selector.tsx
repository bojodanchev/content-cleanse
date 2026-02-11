'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, Users, Loader2, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FaceCard } from '@/components/faceswap/face-card'
import { getClient } from '@/lib/supabase/client'
import { cn, formatBytes } from '@/lib/utils'
import { useDropzone } from 'react-dropzone'
import type { Face } from '@/lib/supabase/types'

interface FaceSelectorProps {
  selectedFace: Face | null
  onFaceSelect: (face: Face | null) => void
  onNewFaceUpload: (file: File, name: string, saveFace: boolean) => void
  uploadedFaceFile: File | null
  uploadedFaceName: string
  onUploadedFaceNameChange: (name: string) => void
  saveFaceForLater: boolean
  onSaveFaceForLaterChange: (save: boolean) => void
}

const ACCEPTED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

const MAX_FACE_SIZE = 10 * 1024 * 1024 // 10MB

export function FaceSelector({
  selectedFace,
  onFaceSelect,
  onNewFaceUpload,
  uploadedFaceFile,
  uploadedFaceName,
  onUploadedFaceNameChange,
  saveFaceForLater,
  onSaveFaceForLaterChange,
}: FaceSelectorProps) {
  const [tab, setTab] = useState<'saved' | 'upload'>('saved')
  const [faces, setFaces] = useState<Face[]>([])
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const supabase = getClient()

  useEffect(() => {
    loadFaces()
  }, [])

  // Generate preview for uploaded face file
  useEffect(() => {
    if (uploadedFaceFile) {
      const url = URL.createObjectURL(uploadedFaceFile)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [uploadedFaceFile])

  const loadFaces = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/faces')
      if (!response.ok) throw new Error('Failed to load faces')
      const { faces: loadedFaces } = await response.json()
      setFaces(loadedFaces || [])

      // Generate signed URLs for thumbnails
      const urls: Record<string, string> = {}
      for (const face of loadedFaces || []) {
        try {
          const { data } = await supabase.storage
            .from('faces')
            .createSignedUrl(face.file_path, 3600)
          if (data?.signedUrl) {
            urls[face.id] = data.signedUrl
          }
        } catch {
          // Skip failed thumbnails
        }
      }
      setThumbnailUrls(urls)
    } catch (err) {
      console.error('Failed to load faces:', err)
      setError('Failed to load saved faces')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteFace = async (faceId: string) => {
    try {
      const response = await fetch('/api/faces', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceId }),
      })
      if (!response.ok) throw new Error('Failed to delete face')

      setFaces((prev) => prev.filter((f) => f.id !== faceId))
      if (selectedFace?.id === faceId) {
        onFaceSelect(null)
      }
    } catch (err) {
      console.error('Delete face error:', err)
    }
  }

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: unknown[]) => {
      setError(null)
      if (rejectedFiles.length > 0) {
        setError('Invalid file. Please upload a JPG, PNG, or WebP image under 10MB.')
        return
      }
      if (acceptedFiles.length > 0) {
        onNewFaceUpload(acceptedFiles[0], uploadedFaceName || 'New Face', saveFaceForLater)
        // Switch to upload tab to show the preview
        setTab('upload')
      }
    },
    [uploadedFaceName, saveFaceForLater]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_IMAGE_TYPES,
    maxSize: MAX_FACE_SIZE,
    multiple: false,
  })

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-secondary/30 rounded-lg">
        <button
          onClick={() => setTab('saved')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            tab === 'saved'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="w-4 h-4" />
          Saved Faces
          {faces.length > 0 && (
            <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
              {faces.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('upload')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors',
            tab === 'upload'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Upload className="w-4 h-4" />
          Upload New
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Saved Faces Tab */}
      {tab === 'saved' && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : faces.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No saved faces yet</p>
              <p className="text-sm mt-1">Upload a face in the &quot;Upload New&quot; tab to save it for reuse</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {faces.map((face) => (
                <FaceCard
                  key={face.id}
                  face={face}
                  selected={selectedFace?.id === face.id}
                  onSelect={onFaceSelect}
                  onDelete={handleDeleteFace}
                  thumbnailUrl={thumbnailUrls[face.id] || null}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload New Tab */}
      {tab === 'upload' && (
        <div className="space-y-4">
          {uploadedFaceFile ? (
            <div className="relative rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-4">
              <div className="flex items-center gap-4">
                {previewUrl && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-border/50 shrink-0">
                    <img src={previewUrl} alt="Face preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{uploadedFaceFile.name}</p>
                  <p className="text-sm text-muted-foreground">{formatBytes(uploadedFaceFile.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onNewFaceUpload(null as unknown as File, '', false)}
                  className="shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={cn(
                'rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer text-center',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border/50 hover:border-primary/50'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Drop a face photo here</p>
              <p className="text-sm text-muted-foreground mt-1">
                Clear, front-facing photo with one face. JPG/PNG/WebP under 10MB.
              </p>
            </div>
          )}

          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="face-name">Face Name</Label>
            <Input
              id="face-name"
              placeholder="e.g., Jessica, Model A"
              value={uploadedFaceName}
              onChange={(e) => onUploadedFaceNameChange(e.target.value)}
            />
          </div>

          {/* Save for later checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveFaceForLater}
              onChange={(e) => onSaveFaceForLaterChange(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm">Save this face for future jobs</span>
          </label>
        </div>
      )}
    </div>
  )
}
