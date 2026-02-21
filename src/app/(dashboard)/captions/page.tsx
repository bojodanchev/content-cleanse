'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  ArrowRight,
  ArrowLeft,
  Copy,
  Download,
  Image,
  Loader2,
  Plus,
  RotateCcw,
  GripVertical,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CaptionEditor, type CarouselPhoto } from '@/components/captions/caption-editor'
import { CaptionSettings, CaptionSettingsValues } from '@/components/captions/caption-settings'
import { ProgressTracker } from '@/components/upload/progress-tracker'
import { StorylinePreview } from '@/components/captions/storyline-preview'
import { getClient } from '@/lib/supabase/client'
import { cn, formatBytes } from '@/lib/utils'
import { useDropzone } from 'react-dropzone'
import { getPlanById } from '@/lib/crypto/plans'
import type { Job, Profile } from '@/lib/supabase/types'

type ViewState = 'upload' | 'captions' | 'settings' | 'processing' | 'multiply'

const ACCEPTED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50MB combined
const MAX_PHOTOS = 20

const STEPS = [
  { id: 'upload', label: 'Upload', num: 1 },
  { id: 'captions', label: 'Captions', num: 2 },
  { id: 'settings', label: 'Settings', num: 3 },
  { id: 'processing', label: 'Processing', num: 4 },
]

export default function CaptionsPage() {
  const [view, setView] = useState<ViewState>('upload')
  const [photos, setPhotos] = useState<CarouselPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [currentJob, setCurrentJob] = useState<Job | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [elapsedTime, setElapsedTime] = useState(0)

  // Multiply state
  const [multiplyCount, setMultiplyCount] = useState(5)
  const [multiplyJob, setMultiplyJob] = useState<Job | null>(null)

  // Caption state
  const [captionSource, setCaptionSource] = useState<'manual' | 'ai'>('manual')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiNiche, setAiNiche] = useState<string>('')
  const [aiStyle, setAiStyle] = useState<string>('')

  // Settings state
  const [captionSettings, setCaptionSettings] = useState<CaptionSettingsValues>({
    fontSize: 'medium',
    position: 'center',
    generateVideo: false,
  })

  const supabase = getClient()

  // Ref to always have current photos for unmount cleanup
  const photosRef = useRef<CarouselPhoto[]>([])
  photosRef.current = photos

  useEffect(() => {
    loadProfile()
  }, [])

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
  }, [])

  // Track elapsed processing time
  useEffect(() => {
    const isProcessing =
      currentJob?.status === 'processing' ||
      currentJob?.status === 'uploading' ||
      (multiplyJob?.status === 'processing')
    if (isProcessing) {
      const interval = setInterval(() => setElapsedTime((p) => p + 1), 1000)
      return () => clearInterval(interval)
    }
  }, [currentJob?.status, multiplyJob?.status])

  // Subscribe to job updates via Realtime
  useEffect(() => {
    if (!currentJob) return

    const channel = supabase
      .channel(`caption-job-${currentJob.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${currentJob.id}`,
        },
        (payload) => {
          setCurrentJob(payload.new as Job)
        }
      )
      .subscribe()

    const staleCheckInterval = setInterval(() => {
      if (currentJob.status === 'processing' && currentJob.created_at) {
        const elapsed = Date.now() - new Date(currentJob.created_at).getTime()
        if (elapsed > 15 * 60 * 1000) {
          setCurrentJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'failed' as const,
                  error_message: 'Processing timed out. Please try again.',
                }
              : prev
          )
        }
      }
    }, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(staleCheckInterval)
    }
  }, [currentJob?.id])

  // Subscribe to multiply job updates via Realtime
  useEffect(() => {
    if (!multiplyJob) return

    const channel = supabase
      .channel(`multiply-job-${multiplyJob.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${multiplyJob.id}`,
        },
        (payload) => {
          setMultiplyJob(payload.new as Job)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [multiplyJob?.id])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setProfile(data)
  }

  const totalSize = photos.reduce((sum, p) => sum + p.file.size, 0)

  const addPhotos = useCallback(
    (files: File[]) => {
      setError(null)
      const remaining = MAX_PHOTOS - photos.length
      if (remaining <= 0) {
        setError(`Maximum ${MAX_PHOTOS} photos allowed.`)
        return
      }

      const toAdd = files.slice(0, remaining)
      let runningTotal = totalSize
      const newPhotos: CarouselPhoto[] = []

      for (const file of toAdd) {
        runningTotal += file.size
        if (runningTotal > MAX_TOTAL_SIZE) {
          setError('Total file size exceeds 50MB. Remove some photos or use smaller files.')
          break
        }
        newPhotos.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          caption: '',
        })
      }

      if (newPhotos.length > 0) {
        setPhotos((prev) => [...prev, ...newPhotos])
      }
    },
    [photos.length, totalSize]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: unknown[]) => {
      setError(null)
      if (rejectedFiles.length > 0) {
        setError('Some files were rejected. Use JPG, PNG, or WebP images under 10MB each.')
      }
      if (acceptedFiles.length > 0) {
        addPhotos(acceptedFiles)
      }
    },
    [addPhotos]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_IMAGE_TYPES,
    maxSize: MAX_IMAGE_SIZE,
    multiple: true,
    maxFiles: MAX_PHOTOS,
    disabled: uploading,
  })

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const removed = prev.find((p) => p.id === id)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  // AI caption generation
  const handleAiGenerate = async (niche: string, style: string, count: number) => {
    setAiGenerating(true)
    setAiNiche(niche)
    setAiStyle(style)

    try {
      const formData = new FormData()
      formData.append('niche', niche)
      formData.append('style', style)
      formData.append('count', count.toString())
      // Send first photo for vision-based generation
      if (photos.length > 0) {
        formData.append('image', photos[0].file)
      }

      const response = await fetch('/api/captions/generate', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to generate captions')
      }

      const { captions: generated } = await response.json()
      // Distribute generated captions 1:1 to photos
      setPhotos((prev) =>
        prev.map((p, i) => ({
          ...p,
          caption: i < generated.length ? generated[i] : p.caption,
        }))
      )
    } catch (err) {
      console.error('AI generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate captions')
    } finally {
      setAiGenerating(false)
    }
  }

  // Start processing
  const handleStartProcessing = async () => {
    if (photos.length === 0 || !profile) return
    const filledPhotos = photos.filter((p) => p.caption.trim().length > 0)
    if (filledPhotos.length === 0) return

    setView('processing')
    setUploading(true)
    setElapsedTime(0)

    try {
      // Upload all photos in parallel to Supabase images bucket
      const settled = await Promise.allSettled(
        filledPhotos.map(async (photo) => {
          const fileName = `${profile.id}/${Date.now()}-${photo.id}-${photo.file.name}`
          const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(fileName, photo.file)
          if (uploadError) throw uploadError
          return { file_path: fileName, caption: photo.caption }
        })
      )

      // Check for failures and clean up orphaned uploads
      const failed = settled.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        // Clean up any successful uploads to avoid orphaned files
        const successPaths = settled
          .filter((r): r is PromiseFulfilledResult<{ file_path: string; caption: string }> => r.status === 'fulfilled')
          .map((r) => r.value.file_path)
        if (successPaths.length > 0) {
          await supabase.storage.from('images').remove(successPaths)
        }
        throw new Error(`Failed to upload ${failed.length} photo(s). Please try again.`)
      }

      const uploadResults = settled
        .filter((r): r is PromiseFulfilledResult<{ file_path: string; caption: string }> => r.status === 'fulfilled')
        .map((r) => r.value)

      // Create job via server API
      const createResponse = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: uploadResults[0].file_path, // first photo for job history display
          fileName: filledPhotos[0].file.name,
          fileSize: filledPhotos.reduce((sum, p) => sum + p.file.size, 0),
          variantCount: filledPhotos.length,
          jobType: 'photo_captions',
          settings: {
            photos: uploadResults,
            captions: uploadResults.map((r) => r.caption),
            font_size: captionSettings.fontSize,
            position: captionSettings.position,
            generate_video: captionSettings.generateVideo,
            caption_source: captionSource,
            ai_niche: captionSource === 'ai' ? aiNiche : undefined,
            ai_style: captionSource === 'ai' ? aiStyle : undefined,
          },
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create job')
      }

      const { job } = await createResponse.json()
      setCurrentJob(job)
      setUploading(false)

      // Trigger processing
      const processResponse = await fetch('/api/jobs/process-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({}))
        setCurrentJob({
          ...job,
          status: 'failed',
          error_message: errorData.error || 'Failed to start processing',
        })
      }
    } catch (err) {
      console.error('Error starting caption job:', err)
      setUploading(false)
      setView('settings')
      setError(err instanceof Error ? err.message : 'Failed to start processing')
    }
  }

  // Download handler
  const handleDownload = async () => {
    if (!currentJob || !profile) return

    try {
      if (currentJob.output_zip_path) {
        const { data } = await supabase.storage
          .from('outputs')
          .createSignedUrl(currentJob.output_zip_path, 3600)
        if (data?.signedUrl) {
          const a = document.createElement('a')
          a.href = data.signedUrl
          a.download = `${currentJob.source_file_name || 'captions'}_variants.zip`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          return
        }
      }

      const { data: files } = await supabase.storage
        .from('outputs')
        .list(`${profile.id}/${currentJob.id}`, {
          sortBy: { column: 'name', order: 'asc' },
        })

      if (!files?.length) {
        alert('No output files found for this job.')
        return
      }

      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()

      for (const file of files) {
        const { data } = await supabase.storage
          .from('outputs')
          .download(`${profile.id}/${currentJob.id}/${file.name}`)
        if (data) zip.file(file.name, data)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(currentJob.source_file_name || 'captions').replace(/\.[^.]+$/, '')}_variants.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Download failed. Please try again.')
    }
  }

  const handleNewJob = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    setView('upload')
    setPhotos([])
    setCurrentJob(null)
    setMultiplyJob(null)
    setCaptionSource('manual')
    setAiNiche('')
    setAiStyle('')
    setCaptionSettings({ fontSize: 'medium', position: 'center', generateVideo: false })
    setError(null)
  }

  const handleMultiply = () => {
    setView('multiply')
    setMultiplyJob(null)
    setElapsedTime(0)
  }

  const handleStartMultiply = async () => {
    if (!currentJob || !profile) return

    setElapsedTime(0)
    setError(null)

    try {
      // Create multiply job
      const createResponse = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: currentJob.source_file_path,
          fileName: currentJob.source_file_name,
          fileSize: 0,
          variantCount: 0,
          jobType: 'carousel_multiply',
          parentJobId: currentJob.id,
          copyCount: Math.min(multiplyCount, maxCopies),
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create multiply job')
      }

      const { job } = await createResponse.json()
      setMultiplyJob(job)

      // Trigger processing
      const processResponse = await fetch('/api/jobs/process-multiply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({}))
        setMultiplyJob({
          ...job,
          status: 'failed',
          error_message: errorData.error || 'Failed to start multiply processing',
        })
      }
    } catch (err) {
      console.error('Error starting multiply job:', err)
      setError(err instanceof Error ? err.message : 'Failed to start multiply')
    }
  }

  const handleMultiplyDownload = async () => {
    if (!multiplyJob || !profile) return

    try {
      if (multiplyJob.output_zip_path) {
        const { data } = await supabase.storage
          .from('outputs')
          .createSignedUrl(multiplyJob.output_zip_path, 3600)
        if (data?.signedUrl) {
          const a = document.createElement('a')
          a.href = data.signedUrl
          a.download = `${(currentJob?.source_file_name || 'carousel').replace(/\.[^.]+$/, '')}_multiply.zip`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
      }
    } catch (err) {
      console.error('Multiply download failed:', err)
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === view)
  const canProceedToCaptions = photos.length > 0
  const canProceedToSettings = photos.some((p) => p.caption.trim().length > 0)

  // Multiply: calculate max copies based on plan variant limit
  const slideCount = currentJob ? (currentJob.variant_count || 0) : photos.length
  const planConfig = profile ? getPlanById(profile.plan) : null
  const variantLimit = planConfig?.variantLimit ?? 10
  const maxCopies = slideCount > 0 ? Math.floor(variantLimit / slideCount) : 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Photo Captions</h1>
        <p className="text-muted-foreground">
          Upload photos and generate captioned image variants
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  i < stepIndex
                    ? 'bg-primary text-white'
                    : i === stepIndex
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {step.num}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-xs',
                  i <= stepIndex ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'w-16 h-0.5 mx-2 mb-5',
                  i < stepIndex ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        ))}
      </div>

      <div className="max-w-3xl mx-auto">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>
              {view === 'upload'
                ? 'Upload Photos'
                : view === 'captions'
                ? 'Add Captions'
                : view === 'settings'
                ? 'Configure Output'
                : view === 'multiply'
                ? 'Multiply Carousel'
                : 'Processing'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {/* Step 1: Upload */}
              {view === 'upload' && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {/* Photo grid with reorder */}
                  {photos.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {photos.length}/{MAX_PHOTOS} photos ({formatBytes(totalSize)})
                        </p>
                      </div>
                      <Reorder.Group
                        axis="y"
                        values={photos}
                        onReorder={setPhotos}
                        className="space-y-2"
                      >
                        {photos.map((photo, i) => (
                          <Reorder.Item
                            key={photo.id}
                            value={photo}
                            className="flex items-center gap-3 rounded-xl border border-border/40 bg-secondary/20 p-2 cursor-grab active:cursor-grabbing group"
                          >
                            <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                            <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-border/50 shrink-0">
                              <img
                                src={photo.previewUrl}
                                alt={`Photo ${i + 1}`}
                                className="w-full h-full object-cover pointer-events-none"
                              />
                              <div className="absolute top-0 left-0 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br-md">
                                {i + 1}
                              </div>
                            </div>
                            <p className="flex-1 text-sm truncate text-muted-foreground">
                              {photo.file.name}
                            </p>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatBytes(photo.file.size)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removePhoto(photo.id)
                              }}
                              className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>

                      {/* Add more zone */}
                      {photos.length < MAX_PHOTOS && (
                        <div
                          {...getRootProps()}
                          className={cn(
                            'rounded-xl border-2 border-dashed p-4 flex items-center justify-center gap-2 cursor-pointer transition-colors',
                            isDragActive
                              ? 'border-primary bg-primary/10'
                              : 'border-border/50 hover:border-primary/50'
                          )}
                        >
                          <input {...getInputProps()} />
                          <Plus className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Add more photos</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Drag to reorder.
                      </p>
                    </div>
                  )}

                  {/* Empty state dropzone */}
                  {photos.length === 0 && (
                    <div
                      {...getRootProps()}
                      className={cn(
                        'relative rounded-2xl border-2 border-dashed p-12 transition-colors cursor-pointer',
                        isDragActive
                          ? 'border-primary bg-primary/5'
                          : 'border-border/50 hover:border-primary/50 hover:bg-card/50'
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
                          <Image className="w-10 h-10 text-primary" />
                        </motion.div>
                        {isDragActive ? (
                          <p className="text-xl font-medium text-primary">
                            Drop your photos here
                          </p>
                        ) : (
                          <>
                            <p className="text-xl font-medium mb-2">
                              Drag & drop your photos
                            </p>
                            <p className="text-muted-foreground mb-4">
                              or click to browse (up to {MAX_PHOTOS} photos)
                            </p>
                            <p className="text-sm text-muted-foreground">
                              JPG, PNG, WebP &middot; 10MB each &middot; 50MB total
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {error && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive"
                    >
                      {error}
                    </motion.p>
                  )}

                  {canProceedToCaptions && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-end"
                    >
                      <Button
                        onClick={() => { setError(null); setView('captions') }}
                        className="bg-gradient-to-r from-primary to-primary/80"
                      >
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Step 2: Captions */}
              {view === 'captions' && (
                <motion.div
                  key="captions"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <CaptionEditor
                    photos={photos}
                    onPhotosChange={setPhotos}
                    onAiGenerate={handleAiGenerate}
                    aiGenerating={aiGenerating}
                    captionSource={captionSource}
                    onSourceChange={setCaptionSource}
                  />

                  {error && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive"
                    >
                      {error}
                    </motion.p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    <Button
                      variant="ghost"
                      onClick={() => setView('upload')}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={() => { setError(null); setView('settings') }}
                      disabled={!canProceedToSettings}
                      className="bg-gradient-to-r from-primary to-primary/80"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Settings */}
              {view === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <CaptionSettings
                    settings={captionSettings}
                    onChange={setCaptionSettings}
                    captionCount={photos.filter((p) => p.caption.trim().length > 0).length}
                    previewUrl={photos.length > 0 ? photos[0].previewUrl : null}
                  />

                  {error && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive"
                    >
                      {error}
                    </motion.p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    <Button
                      variant="ghost"
                      onClick={() => setView('captions')}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={handleStartProcessing}
                      disabled={uploading}
                      className="bg-gradient-to-r from-primary to-primary/80"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          Start Processing
                          <Zap className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Processing / Preview */}
              {view === 'processing' && currentJob && currentJob.status === 'completed' && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <StorylinePreview
                    job={currentJob}
                    onDownload={handleDownload}
                    onNewJob={handleNewJob}
                    onMultiply={maxCopies >= 2 ? handleMultiply : undefined}
                    elapsedTime={elapsedTime}
                  />
                </motion.div>
              )}

              {view === 'processing' && currentJob && currentJob.status !== 'completed' && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <ProgressTracker
                    job={currentJob}
                    onDownload={handleDownload}
                    onNewJob={handleNewJob}
                  />
                </motion.div>
              )}

              {view === 'processing' && !currentJob && (
                <motion.div
                  key="uploading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
                  <p className="text-lg font-medium">Uploading photos...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please wait while we upload your images
                  </p>
                </motion.div>
              )}

              {/* Step 5: Multiply */}
              {view === 'multiply' && !multiplyJob && (
                <motion.div
                  key="multiply-setup"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                      <Copy className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">Multiply Your Carousel</h3>
                    <p className="text-sm text-muted-foreground">
                      Create unique copies of your {slideCount}-slide carousel. Each copy has imperceptible visual tweaks for safe multi-account posting.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Number of copies</label>
                      <span className="text-xs text-muted-foreground">
                        Max {maxCopies} ({variantLimit} variant limit)
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={2}
                        max={Math.max(2, maxCopies)}
                        value={Math.min(multiplyCount, maxCopies)}
                        onChange={(e) => setMultiplyCount(Number(e.target.value))}
                        className="flex-1 accent-primary"
                      />
                      <span className="text-2xl font-bold tabular-nums w-12 text-right">
                        {Math.min(multiplyCount, maxCopies)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total output: {Math.min(multiplyCount, maxCopies) * slideCount} images ({Math.min(multiplyCount, maxCopies)} sets x {slideCount} slides)
                    </p>
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-destructive"
                    >
                      {error}
                    </motion.p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    <Button
                      variant="ghost"
                      onClick={() => setView('processing')}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={handleStartMultiply}
                      disabled={maxCopies < 2}
                      className="bg-gradient-to-r from-primary to-primary/80"
                    >
                      Start Multiply
                      <Zap className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {view === 'multiply' && multiplyJob && multiplyJob.status === 'completed' && (
                <motion.div
                  key="multiply-done"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-6 py-8"
                >
                  <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                    <Copy className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Multiply Complete!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {multiplyJob.variants_completed} images created in {Math.min(multiplyCount, maxCopies)} unique sets
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      onClick={handleMultiplyDownload}
                      className="bg-gradient-to-r from-primary to-primary/80"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download ZIP
                    </Button>
                    <Button onClick={handleNewJob} variant="outline">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      New Storyline
                    </Button>
                  </div>
                </motion.div>
              )}

              {view === 'multiply' && multiplyJob && multiplyJob.status !== 'completed' && (
                <motion.div
                  key="multiply-processing"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <ProgressTracker
                    job={multiplyJob}
                    onDownload={handleMultiplyDownload}
                    onNewJob={handleNewJob}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
