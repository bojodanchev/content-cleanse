'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Clock, Zap, FileVideo, TrendingUp, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dropzone } from '@/components/upload/dropzone'
import { SettingsPanel, ProcessingSettings } from '@/components/upload/settings-panel'
import { ProgressTracker } from '@/components/upload/progress-tracker'
import { getClient } from '@/lib/supabase/client'
import type { Job, Profile } from '@/lib/supabase/types'
import JSZip from 'jszip'

type ViewState = 'upload' | 'settings' | 'processing'

export default function DashboardPage() {
  const [view, setView] = useState<ViewState>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentJob, setCurrentJob] = useState<Job | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [recentJobs, setRecentJobs] = useState<Job[]>([])
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<ProcessingSettings>({
    variantCount: 10,
    removeWatermark: false,
    addWatermark: false,
  })

  const supabase = getClient()

  useEffect(() => {
    loadProfile()
    loadRecentJobs()
  }, [])

  // Subscribe to job updates
  useEffect(() => {
    if (!currentJob) return

    const channel = supabase
      .channel(`job-${currentJob.id}`)
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
    }, 30000) // Check every 30 seconds

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

  const loadRecentJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) setRecentJobs(data)
  }

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
  }

  const handleClearFile = () => {
    setSelectedFile(null)
  }

  const handleContinue = () => {
    if (selectedFile) {
      setView('settings')
    }
  }

  const handleStartProcessing = async () => {
    if (!selectedFile || !profile) return

    setView('processing')
    setUploading(true)

    try {
      // Upload file to Supabase Storage
      const fileName = `${profile.id}/${Date.now()}-${selectedFile.name}`

      // Simulate upload progress (Supabase doesn't support progress callbacks)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, selectedFile)

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (uploadError) throw uploadError

      // Create job via server API (validates plan limits server-side)
      const createResponse = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: fileName,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          variantCount: settings.variantCount,
          removeWatermark: settings.removeWatermark,
          addWatermark: settings.addWatermark,
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create job')
      }

      const { job } = await createResponse.json()

      setCurrentJob(job)
      setUploading(false)

      // Trigger processing on Modal
      const processResponse = await fetch('/api/jobs/process', {
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
      console.error('Error starting job:', err)
      setUploading(false)
      setView('settings')
      setError(err instanceof Error ? err.message : 'Failed to start processing')
    }
  }

  const downloadJobFiles = async (job: Job) => {
    if (!profile || downloadingJobId) return
    setDownloadingJobId(job.id)

    try {
      // Try pre-built ZIP first if available
      if (job.output_zip_path) {
        const { data } = await supabase.storage
          .from('outputs')
          .createSignedUrl(job.output_zip_path, 3600)

        if (data?.signedUrl) {
          const a = document.createElement('a')
          a.href = data.signedUrl
          a.download = `${job.source_file_name || 'variants'}_variants.zip`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          return
        }
      }

      // Fallback: build ZIP client-side from individual variant files
      const { data: files } = await supabase.storage
        .from('outputs')
        .list(`${profile.id}/${job.id}`, { sortBy: { column: 'name', order: 'asc' } })

      if (!files?.length) {
        alert('No output files found for this job.')
        return
      }

      const variantFiles = files.filter((f) => f.name.endsWith('.mp4'))
      if (!variantFiles.length) {
        alert('No variant files found for this job.')
        return
      }

      const zip = new JSZip()

      for (const file of variantFiles) {
        const { data } = await supabase.storage
          .from('outputs')
          .download(`${profile.id}/${job.id}/${file.name}`)

        if (data) {
          zip.file(file.name, data)
        }
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(job.source_file_name || 'variants').replace(/\.[^.]+$/, '')}_variants.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Download failed. Please try again.')
    } finally {
      setDownloadingJobId(null)
    }
  }

  const handleDownload = async () => {
    if (!currentJob) return
    await downloadJobFiles(currentJob)
  }

  const handleNewJob = () => {
    setView('upload')
    setSelectedFile(null)
    setCurrentJob(null)
    setSettings({
      variantCount: 10,
      removeWatermark: false,
      addWatermark: false,
    })
    loadRecentJobs()
  }

  const maxVariants = profile?.plan === 'agency' ? 100 : profile?.plan === 'pro' ? 100 : 10
  const canRemoveWatermark = profile?.plan === 'pro' || profile?.plan === 'agency'

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Transform your videos into unique variants
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Videos Processed',
            value: recentJobs.filter((j) => j.status === 'completed').length,
            icon: FileVideo,
            color: 'text-primary',
          },
          {
            label: 'Variants Created',
            value: recentJobs
              .filter((j) => j.status === 'completed')
              .reduce((sum, j) => sum + j.variant_count, 0),
            icon: Zap,
            color: 'text-accent',
          },
          {
            label: 'Quota Used',
            value: `${profile?.quota_used || 0}/${profile?.monthly_quota || 5}`,
            icon: TrendingUp,
            color: 'text-green-500',
          },
          {
            label: 'This Month',
            value: recentJobs.filter(
              (j) =>
                j.status === 'completed' &&
                new Date(j.created_at).getMonth() === new Date().getMonth()
            ).length,
            icon: Clock,
            color: 'text-yellow-500',
          },
        ].map((stat, i) => (
          <Card key={i} className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div
                  className={`w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center ${stat.color}`}
                >
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Upload/Processing area */}
        <div className="lg:col-span-2">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>
                {view === 'upload'
                  ? 'Upload Video'
                  : view === 'settings'
                  ? 'Configure Processing'
                  : 'Processing'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {view === 'upload' && (
                <div className="space-y-6">
                  <Dropzone
                    onFileSelect={handleFileSelect}
                    selectedFile={selectedFile}
                    onClear={handleClearFile}
                    uploading={uploading}
                    progress={uploadProgress}
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
                  {selectedFile && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-end"
                    >
                      <Button
                        onClick={() => { setError(null); handleContinue() }}
                        className="bg-gradient-to-r from-primary to-primary/80"
                      >
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </motion.div>
                  )}
                </div>
              )}

              {view === 'settings' && (
                <div className="space-y-6">
                  <SettingsPanel
                    settings={settings}
                    onChange={setSettings}
                    maxVariants={maxVariants}
                    canRemoveWatermark={canRemoveWatermark}
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
                      Back
                    </Button>
                    <Button
                      onClick={handleStartProcessing}
                      className="bg-gradient-to-r from-primary to-primary/80"
                    >
                      Start Processing
                      <Zap className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {view === 'processing' && currentJob && (
                <ProgressTracker
                  job={currentJob}
                  onDownload={handleDownload}
                  onNewJob={handleNewJob}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent jobs */}
        <div>
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Recent Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No jobs yet. Upload your first video!
                </p>
              ) : (
                <div className="space-y-3">
                  {recentJobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => job.status === 'completed' && !downloadingJobId && downloadJobFiles(job)}
                      className={`p-3 rounded-lg bg-secondary/30 border border-border/40 ${
                        job.status === 'completed' && !downloadingJobId
                          ? 'cursor-pointer hover:bg-secondary/50 hover:border-primary/30 transition-colors'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate max-w-[150px]">
                          {job.source_file_name || 'Video'}
                        </span>
                        <div className="flex items-center gap-2">
                          {job.status === 'completed' && (
                            downloadingJobId === job.id ? (
                              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5 text-green-500" />
                            )
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              job.status === 'completed'
                                ? 'bg-green-500/20 text-green-500'
                                : job.status === 'failed'
                                ? 'bg-destructive/20 text-destructive'
                                : 'bg-primary/20 text-primary'
                            }`}
                          >
                            {job.status}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {job.variant_count} variants •{' '}
                        {new Date(job.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
