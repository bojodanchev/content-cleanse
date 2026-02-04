'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, File, X, Loader2 } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DropzoneProps {
  onFileSelect: (file: File) => void
  selectedFile: File | null
  onClear: () => void
  uploading?: boolean
  progress?: number
}

const ACCEPTED_TYPES = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/webm': ['.webm'],
}

const MAX_SIZE = 500 * 1024 * 1024 // 500MB

export function Dropzone({
  onFileSelect,
  selectedFile,
  onClear,
  uploading = false,
  progress = 0,
}: DropzoneProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: unknown[]) => {
      setError(null)

      if (rejectedFiles.length > 0) {
        setError('Invalid file. Please upload a video file under 500MB.')
        return
      }

      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0])
      }
    },
    [onFileSelect]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: uploading,
  })

  if (selectedFile) {
    return (
      <div className="relative rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 p-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center">
            <File className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatBytes(selectedFile.size)}
            </p>
          </div>
          {!uploading && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              className="shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Uploading...</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-accent"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative rounded-2xl border-2 border-dashed p-12 transition-colors cursor-pointer',
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-border/50 hover:border-primary/50 hover:bg-card/50',
        uploading && 'pointer-events-none opacity-50'
      )}
    >
      <input {...getInputProps()} />

      <div className="text-center">
        <motion.div
          animate={{
            scale: isDragActive ? 1.1 : 1,
            y: isDragActive ? -5 : 0,
          }}
          className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6"
        >
          <Upload className="w-10 h-10 text-primary" />
        </motion.div>

        <AnimatePresence mode="wait">
          {isDragActive ? (
            <motion.div
              key="dragging"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <p className="text-xl font-medium text-primary">
                Drop your video here
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <p className="text-xl font-medium mb-2">
                Drag & drop your video
              </p>
              <p className="text-muted-foreground mb-4">
                or click to browse files
              </p>
              <p className="text-sm text-muted-foreground">
                MP4, MOV, AVI, WebM up to 500MB
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </div>
    </div>
  )
}
