'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ArrowLeft,
  Zap,
  Loader2,
  X,
  File as FileIcon,
  Repeat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FaceSelector } from '@/components/faceswap/face-selector'
import { FaceswapSettings, FaceswapSettingsValues } from '@/components/faceswap/faceswap-settings'
import { ProgressTracker } from '@/components/upload/progress-tracker'
import { getClient } from '@/lib/supabase/client'
import { cn, formatBytes } from '@/lib/utils'
import { useDropzone } from 'react-dropzone'
import { getPlanById } from '@/lib/crypto/plans'
import type { Job, Profile, Face } from '@/lib/supabase/types'

type ViewState = 'upload' | 'face' | 'settings' | 'processing'

const ACCEPTED_TYPES = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const STEPS = [
  { id: 'upload', label: 'Source', num: 1 },
  { id: 'face', label: 'New Face', num: 2 },
  { id: 'settings', label: 'Settings', num: 3 },
  { id: 'processing', label: 'Processing', num: 4 },
]

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

export default function FaceswapPage() {
  const [view, setView] = useState<ViewState>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [currentJob, setCurrentJob] = useState<Job | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Face state
  const [selectedFace, setSelectedFace] = useState<Face | null>(null)
  const [uploadedFaceFile, setUploadedFaceFile] = useState<File | null>(null)
  const [uploadedFaceName, setUploadedFaceName] = useState('')
  const [saveFaceForLater, setSaveFaceForLater] = useState(true)
  const [facePreviewUrl, setFacePreviewUrl] = useState<string | null>(null)

  // Settings state
  const [faceswapSettings, setFaceswapSettings] = useState<FaceswapSettingsValues>({
    swapOnly: false,
    variantCount: 10,
  })

  const supabase = getClient()

  useEffect(() => { loadProfile() }, [])

  useEffect(() => {
    if (selectedFile) {
      if (!isVideoFile(selectedFile)) {
        const url = URL.createObjectURL(selectedFile)
        setPreviewUrl(url)
        return () => URL.revokeObjectURL(url)
      }
    }
    setPreviewUrl(null)
  }, [selectedFile])

  // Face preview from saved face
  useEffect(() => {
    if (selectedFace) {
      supabase.storage
        .from('faces')
        .createSignedUrl(selectedFace.file_path, 3600)
        .then(({ data }) => {
          if (data?.signedUrl) setFacePreviewUrl(data.signedUrl)
        })
    } else if (uploadedFaceFile) {
      const url = URL.createObjectURL(uploadedFaceFile)
      setFacePreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setFacePreviewUrl(null)
    }
  }, [selectedFace, uploadedFaceFile])

  // Realtime subscription for job updates
  useEffect(() => {
    if (!currentJob) return

    const channel = supabase
      .channel(`faceswap-job-${currentJob.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${currentJob.id}`,
        },
        (payload) => { setCurrentJob(payload.new as Job) }
      )
      .subscribe()

    const staleCheckInterval = setInterval(() => {
      if (currentJob.status === 'processing' && currentJob.created_at) {
        const elapsed = Date.now() - new Date(currentJob.created_at).getTime()
        if (elapsed > 15 * 60 * 1000) {
          setCurrentJob((prev) =>
            prev ? { ...prev, status: 'failed' as const, error_message: 'Processing timed out. Please try again.' } : prev
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) setProfile(data)
  }

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: unknown[]) => {
    setError(null)
    if (rejectedFiles.length > 0) {
      setError('Invalid file. Upload a video (MP4, MOV) or image (JPG, PNG, WebP) under 50MB.')
      return
    }
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: uploading,
  })

  const handleClearFile = () => {
    setSelectedFile(null)
    setError(null)
  }

  const handleFaceUpload = (file: File, name: string, save: boolean) => {
    setUploadedFaceFile(file)
    setUploadedFaceName(name)
    setSaveFaceForLater(save)
    setSelectedFace(null) // Deselect saved face when uploading new one
  }

  const handleStartProcessing = async () => {
    if (!selectedFile || !profile || (!selectedFace && !uploadedFaceFile)) return

    setView('processing')
    setUploading(true)

    try {
      const sourceType = isVideoFile(selectedFile) ? 'video' : 'image'
      const bucket = sourceType === 'video' ? 'videos' : 'images'

      // Upload source file
      const sourceFileName = `${profile.id}/${Date.now()}-${selectedFile.name}`
      const { error: uploadError } = await supabase.storage.from(bucket).upload(sourceFileName, selectedFile)
      if (uploadError) throw uploadError

      // Upload face (if new) and get face path
      let facePath: string
      let faceId: string | null = null

      if (selectedFace) {
        facePath = selectedFace.file_path
        faceId = selectedFace.id
      } else if (uploadedFaceFile) {
        facePath = `${profile.id}/${Date.now()}-face-${uploadedFaceFile.name}`
        const { error: faceUploadError } = await supabase.storage.from('faces').upload(facePath, uploadedFaceFile)
        if (faceUploadError) throw faceUploadError

        // Save face profile if requested
        if (saveFaceForLater && uploadedFaceName.trim()) {
          const saveResponse = await fetch('/api/faces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: uploadedFaceName.trim(), filePath: facePath }),
          })
          if (saveResponse.ok) {
            const { face } = await saveResponse.json()
            faceId = face.id
          }
        }
      } else {
        throw new Error('No face selected')
      }

      // Create job
      const createResponse = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: sourceFileName,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          variantCount: faceswapSettings.swapOnly ? 1 : faceswapSettings.variantCount,
          jobType: 'faceswap',
          settings: {
            face_id: faceId,
            face_path: facePath,
            source_type: sourceType,
            swap_only: faceswapSettings.swapOnly,
            variant_count: faceswapSettings.swapOnly ? 1 : faceswapSettings.variantCount,
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
      const processResponse = await fetch('/api/jobs/process-faceswap', {
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
      console.error('Error starting faceswap job:', err)
      setUploading(false)
      setView('settings')
      setError(err instanceof Error ? err.message : 'Failed to start processing')
    }
  }

  const handleDownload = async () => {
    if (!currentJob || !profile) return

    try {
      if (currentJob.output_zip_path) {
        const { data } = await supabase.storage.from('outputs').createSignedUrl(currentJob.output_zip_path, 3600)
        if (data?.signedUrl) {
          const a = document.createElement('a')
          a.href = data.signedUrl
          a.download = `${currentJob.source_file_name || 'faceswap'}_result.zip`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          return
        }
      }

      // Fallback: build ZIP client-side
      const { data: files } = await supabase.storage.from('outputs').list(`${profile.id}/${currentJob.id}`, {
        sortBy: { column: 'name', order: 'asc' },
      })

      if (!files?.length) {
        alert('No output files found for this job.')
        return
      }

      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()

      for (const file of files) {
        const { data } = await supabase.storage.from('outputs').download(`${profile.id}/${currentJob.id}/${file.name}`)
        if (data) zip.file(file.name, data)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(currentJob.source_file_name || 'faceswap').replace(/\.[^.]+$/, '')}_result.zip`
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
    setSelectedFace(null)
    setUploadedFaceFile(null)
    setUploadedFaceName('')
    setSaveFaceForLater(true)
    setFaceswapSettings({ swapOnly: false, variantCount: 10 })
    setError(null)
  }

  const stepIndex = STEPS.findIndex((s) => s.id === view)
  const hasFaceSelected = !!selectedFace || !!uploadedFaceFile
  const planConfig = profile ? getPlanById(profile.plan) : null
  const maxVariants = planConfig?.variantLimit ?? 10
  const faceswapLimit = planConfig?.faceswapLimit ?? 2

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Face Swap</h1>
        <p className="text-muted-foreground">
          Swap faces in videos and photos with your model&apos;s face
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
                  i < stepIndex ? 'bg-primary text-white'
                    : i === stepIndex ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                {step.num}
              </div>
              <span className={cn('mt-1.5 text-xs', i <= stepIndex ? 'text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('w-16 h-0.5 mx-2 mb-5', i < stepIndex ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      <div className="max-w-3xl mx-auto">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>
              {view === 'upload' ? 'Upload the video or photo to modify'
                : view === 'face' ? 'Choose the replacement face'
                : view === 'settings' ? 'Configure Output'
                : 'Processing'}
            </CardTitle>
            {view === 'upload' && (
              <CardDescription>This is the original content where faces will be swapped</CardDescription>
            )}
            {view === 'face' && (
              <CardDescription>Upload a clear, front-facing photo of the face to swap in</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {/* Step 1: Upload */}
              {view === 'upload' && (
                <motion.div key="upload" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                  {selectedFile ? (
                    <div className="relative rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 p-6">
                      <div className="flex items-start gap-4">
                        {previewUrl && (
                          <div className="w-24 h-24 rounded-xl overflow-hidden border border-border/50 shrink-0">
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                        {isVideoFile(selectedFile) && (
                          <div className="w-24 h-24 rounded-xl border border-border/50 shrink-0 bg-secondary/50 flex items-center justify-center">
                            <FileIcon className="w-10 h-10 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">{formatBytes(selectedFile.size)}</p>
                          <p className="text-xs text-primary mt-1">
                            {isVideoFile(selectedFile) ? 'Video' : 'Image'}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleClearFile} className="shrink-0">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      {...getRootProps()}
                      className={cn(
                        'relative rounded-2xl border-2 border-dashed p-12 transition-colors cursor-pointer',
                        isDragActive ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/50 hover:bg-card/50'
                      )}
                    >
                      <input {...getInputProps()} />
                      <div className="text-center">
                        <motion.div
                          animate={{ scale: isDragActive ? 1.1 : 1, y: isDragActive ? -5 : 0 }}
                          className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6"
                        >
                          <Repeat className="w-10 h-10 text-primary" />
                        </motion.div>
                        {isDragActive ? (
                          <p className="text-xl font-medium text-primary">Drop your file here</p>
                        ) : (
                          <>
                            <p className="text-xl font-medium mb-2">Drop the video or photo you want faces swapped in</p>
                            <p className="text-muted-foreground mb-4">or click to browse files</p>
                            <p className="text-sm text-muted-foreground">MP4, MOV, JPG, PNG, WebP up to 50MB</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {error && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive">{error}</motion.p>
                  )}

                  {selectedFile && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
                      <Button onClick={() => { setError(null); setView('face') }} className="bg-gradient-to-r from-primary to-primary/80">
                        Continue <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Step 2: Face Selection */}
              {view === 'face' && (
                <motion.div key="face" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                  <FaceSelector
                    selectedFace={selectedFace}
                    onFaceSelect={setSelectedFace}
                    onNewFaceUpload={handleFaceUpload}
                    uploadedFaceFile={uploadedFaceFile}
                    uploadedFaceName={uploadedFaceName}
                    onUploadedFaceNameChange={setUploadedFaceName}
                    saveFaceForLater={saveFaceForLater}
                    onSaveFaceForLaterChange={setSaveFaceForLater}
                  />

                  {error && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive">{error}</motion.p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    <Button variant="ghost" onClick={() => setView('upload')}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                      onClick={() => { setError(null); setView('settings') }}
                      disabled={!hasFaceSelected}
                      className="bg-gradient-to-r from-primary to-primary/80"
                    >
                      Continue <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Settings */}
              {view === 'settings' && (
                <motion.div key="settings" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                  <FaceswapSettings
                    settings={faceswapSettings}
                    onChange={setFaceswapSettings}
                    maxVariants={maxVariants}
                    sourcePreviewUrl={previewUrl}
                    facePreviewUrl={facePreviewUrl}
                  />

                  {error && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive">
                      {error}
                    </motion.p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-border/40">
                    <Button variant="ghost" onClick={() => setView('face')}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                      onClick={handleStartProcessing}
                      disabled={uploading}
                      className="bg-gradient-to-r from-primary to-primary/80"
                    >
                      {uploading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                      ) : (
                        <>Start Processing <Zap className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 4: Processing */}
              {view === 'processing' && currentJob && (
                <motion.div key="processing" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <ProgressTracker job={currentJob} onDownload={handleDownload} onNewJob={handleNewJob} />
                </motion.div>
              )}

              {view === 'processing' && !currentJob && (
                <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                  <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
                  <p className="text-lg font-medium">Uploading files...</p>
                  <p className="text-sm text-muted-foreground mt-1">Please wait while we upload your media</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
