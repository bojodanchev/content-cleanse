'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ArrowLeft,
  Upload,
  Image,
  Zap,
  Loader2,
  X,
  File as FileIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CaptionEditor } from '@/components/captions/caption-editor'
import { CaptionSettings, CaptionSettingsValues } from '@/components/captions/caption-settings'
import { ProgressTracker } from '@/components/upload/progress-tracker'
import { getClient } from '@/lib/supabase/client'
import { cn, formatBytes } from '@/lib/utils'
import { useDropzone } from 'react-dropzone'
import type { Job, Profile } from '@/lib/supabase/types'

type ViewState = 'upload' | 'captions' | 'settings' | 'processing'

const ACCEPTED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

const STEPS = [
  { id: 'upload', label: 'Upload', num: 1 },
  { id: 'captions', label: 'Captions', num: 2 },
  { id: 'settings', label: 'Settings', num: 3 },
  { id: 'processing', label: 'Processing', num: 4 },
]

export default function CaptionsPage() {
  const [view, setView] = useState<ViewState>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [currentJob, setCurrentJob] = useState<Job | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Caption state
  const [captions, setCaptions] = useState<string[]>([])
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

  useEffect(() => {
    loadProfile()
  }, [])

  // Generate preview URL for selected file
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [selectedFile])

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

    // Detect stale jobs stuck in processing for >15 minutes
    const staleCheckInterval = setInterval(() => {
      if (
        currentJob.status === 'processing' &&
        currentJob.created_at
      ) {
        const elapsed = Date.now() - new Date(currentJob.created_at).getTime()
        const fifteenMinutes = 15 * 60 * 1000
        if (elapsed > fifteenMinutes) {
          setCurrentJob((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'failed' as const,
                  error_message:
                    'Processing timed out. The server may have encountered an error. Please try again.',
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

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) setProfile(data)
  }

  // Dropzone
  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: unknown[]) => {
      setError(null)
      if (rejectedFiles.length > 0) {
        setError('Invalid file. Please upload a JPG, PNG, or WebP image under 10MB.')
        return
      }
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0])
      }
    },
    []
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_IMAGE_TYPES,
    maxSize: MAX_IMAGE_SIZE,
    multiple: false,
    disabled: uploading,
  })

  const handleClearFile = () => {
    setSelectedFile(null)
    setError(null)
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
      if (selectedFile) {
        formData.append('image', selectedFile)
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
      setCaptions(generated)
    } catch (err) {
      console.error('AI generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate captions')
    } finally {
      setAiGenerating(false)
    }
  }

  // Start processing
  const handleStartProcessing = async () => {
    if (!selectedFile || !profile || captions.length === 0) return

    setView('processing')
    setUploading(true)

    try {
      // Upload photo to Supabase Storage (images bucket)
      const fileName = `${profile.id}/${Date.now()}-${selectedFile.name}`

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, selectedFile)

      if (uploadError) throw uploadError

      // Create job via server API
      const createResponse = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: fileName,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          variantCount: captions.length,
          jobType: 'photo_captions',
          settings: {
            captions,
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

      // Fallback: list files and build ZIP client-side
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
        if (data) {
          zip.file(file.name, data)
        }
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
    setView('upload')
    setSelectedFile(null)
    setCurrentJob(null)
    setCaptions([])
    setCaptionSource('manual')
    setAiNiche('')
    setAiStyle('')
    setCaptionSettings({ fontSize: 'medium', position: 'center', generateVideo: false })
    setError(null)
  }

  // Step index for stepper UI
  const stepIndex = STEPS.findIndex((s) => s.id === view)

  // Validation
  const canProceedToCaptions = !!selectedFile
  const canProceedToSettings = captions.length > 0 && captions.every((c) => c.trim().length > 0)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Photo Captions</h1>
        <p className="text-muted-foreground">
          Upload a photo and generate captioned image variants
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

      {/* Main content */}
      <div className="max-w-3xl mx-auto">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>
              {view === 'upload'
                ? 'Upload Photo'
                : view === 'captions'
                ? 'Add Captions'
                : view === 'settings'
                ? 'Configure Output'
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
                  {selectedFile ? (
                    <div className="relative rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 p-6">
                      <div className="flex items-start gap-4">
                        {previewUrl && (
                          <div className="w-24 h-24 rounded-xl overflow-hidden border border-border/50 shrink-0">
                            <img
                              src={previewUrl}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatBytes(selectedFile.size)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleClearFile}
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
                            Drop your photo here
                          </p>
                        ) : (
                          <>
                            <p className="text-xl font-medium mb-2">
                              Drag & drop your photo
                            </p>
                            <p className="text-muted-foreground mb-4">
                              or click to browse files
                            </p>
                            <p className="text-sm text-muted-foreground">
                              JPG, PNG, WebP up to 10MB
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
                    captions={captions}
                    onChange={setCaptions}
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
                    captionCount={captions.length}
                    previewUrl={previewUrl}
                  />

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

              {/* Step 4: Processing */}
              {view === 'processing' && currentJob && (
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

              {/* Loading state while uploading before job is created */}
              {view === 'processing' && !currentJob && (
                <motion.div
                  key="uploading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
                  <p className="text-lg font-medium">Uploading photo...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please wait while we upload your image
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
