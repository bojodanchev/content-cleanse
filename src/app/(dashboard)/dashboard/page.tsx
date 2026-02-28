'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Search,
  Download,
  Loader2,
  FileVideo,
  ImageIcon,
  Repeat,
  Eraser,
  FolderOpen,
  TrendingUp,
  Zap,
  Clock,
  MoreVertical,
  Trash2,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getClient } from '@/lib/supabase/client'
import { getJobThumbnails } from '@/lib/supabase/thumbnails'
import { formatBytes } from '@/lib/utils'
import type { Job, Profile } from '@/lib/supabase/types'
import { downloadJobFiles as downloadFiles } from '@/lib/download'
import Link from 'next/link'

const PAGE_SIZE = 20

const JOB_TYPE_LABELS: Record<string, { label: string; icon: typeof FileVideo; color: string }> = {
  video: { label: 'Video', icon: FileVideo, color: 'text-blue-400' },
  photo_captions: { label: 'Captions', icon: ImageIcon, color: 'text-amber-400' },
  faceswap: { label: 'Face Swap', icon: Repeat, color: 'text-purple-400' },
  photo_clean: { label: 'Photo Clean', icon: Eraser, color: 'text-emerald-400' },
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map())
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'photo_captions' | 'faceswap' | 'photo_clean'>('all')
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null)
  const [totalJobs, setTotalJobs] = useState(0)
  const [totalVariants, setTotalVariants] = useState(0)

  const supabase = getClient()

  useEffect(() => {
    loadProfile()
    loadJobs(true)
  }, [])

  // Subscribe to job updates for in-progress jobs
  useEffect(() => {
    const processingJobs = jobs.filter(
      (j) => j.status === 'processing' || j.status === 'pending' || j.status === 'uploading'
    )
    if (processingJobs.length === 0) return

    const channel = supabase
      .channel('dashboard-jobs')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
        },
        (payload) => {
          const updated = payload.new as Job
          setJobs((prev) =>
            prev.map((j) => (j.id === updated.id ? updated : j))
          )
          // If job just completed, fetch its thumbnail
          if (updated.status === 'completed') {
            loadThumbnailsForJobs([updated])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [jobs.filter((j) => j.status === 'processing' || j.status === 'pending').length])

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

  const loadThumbnailsForJobs = async (jobList: Job[]) => {
    const completedIds = jobList
      .filter((j) => j.status === 'completed')
      .map((j) => j.id)

    if (completedIds.length === 0) return

    const newThumbnails = await getJobThumbnails(supabase, completedIds)
    setThumbnails((prev) => {
      const merged = new Map(prev)
      for (const [k, v] of newThumbnails) {
        merged.set(k, v)
      }
      return merged
    })
  }

  const loadJobs = async (initial = false) => {
    if (initial) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    const offset = initial ? 0 : jobs.length
    const { data, count } = await supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (data) {
      const newJobs = initial ? data : [...jobs, ...data]
      setJobs(newJobs)
      setHasMore(data.length === PAGE_SIZE)

      // Compute stats from all loaded jobs
      const completed = newJobs.filter((j) => j.status === 'completed')
      setTotalJobs(count ?? newJobs.length)
      setTotalVariants(completed.reduce((sum, j) => sum + j.variant_count, 0))

      // Load thumbnails for completed jobs
      await loadThumbnailsForJobs(data)
    }

    setLoading(false)
    setLoadingMore(false)
  }

  const handleDelete = async (jobId: string) => {
    await supabase.from('jobs').delete().eq('id', jobId)
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }

  const handleDownloadJob = async (job: Job) => {
    if (!profile || downloadingJobId) return
    setDownloadingJobId(job.id)
    try {
      await downloadFiles(supabase, profile.id, job)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Download failed. Please try again.')
    } finally {
      setDownloadingJobId(null)
    }
  }

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      !search ||
      job.source_file_name?.toLowerCase().includes(search.toLowerCase()) ||
      job.id.toLowerCase().includes(search.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'processing' &&
        (job.status === 'processing' || job.status === 'uploading' || job.status === 'pending')) ||
      job.status === statusFilter
    const matchesType = typeFilter === 'all' || job.job_type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-500 border-green-500/30'
      case 'failed':
        return 'bg-destructive/20 text-destructive border-destructive/30'
      case 'processing':
      case 'uploading':
        return 'bg-primary/20 text-primary border-primary/30'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const isImageJob = (job: Job) =>
    job.job_type === 'photo_captions' || job.job_type === 'photo_clean' ||
    (job.job_type === 'faceswap' && (job.settings as any)?.source_type === 'image')

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Your content at a glance
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        {[
          {
            label: 'Total Jobs',
            value: totalJobs,
            icon: FileVideo,
            color: 'text-primary',
          },
          {
            label: 'Variants Created',
            value: totalVariants,
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
            label: 'Plan',
            value: (profile?.plan || 'free').charAt(0).toUpperCase() + (profile?.plan || 'free').slice(1),
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

      {/* Filters */}
      <Card className="bg-card/50 border-border/50 mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by filename..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-secondary/50"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'completed', 'processing', 'failed'] as const).map((f) => (
                <Button
                  key={f}
                  variant={statusFilter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(f)}
                  className={statusFilter === f ? 'bg-primary' : 'border-border/50'}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          {/* Type filter */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {([
              { key: 'all', label: 'All Types' },
              { key: 'video', label: 'Video' },
              { key: 'photo_captions', label: 'Captions' },
              { key: 'faceswap', label: 'Face Swap' },
              { key: 'photo_clean', label: 'Photo Clean' },
            ] as const).map((t) => (
              <Button
                key={t.key}
                variant={typeFilter === t.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter(t.key)}
                className={typeFilter === t.key ? 'bg-accent text-accent-foreground' : 'border-border/50'}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gallery grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="aspect-[4/3] rounded-xl bg-card/50 animate-pulse"
            />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-16 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {search || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'No matching jobs found'
                : 'No content yet'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {search || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start creating unique content variants'}
            </p>
            {!search && statusFilter === 'all' && typeFilter === 'all' && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href="/clean">
                  <Button className="bg-primary">
                    Clean Video/Photo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/captions">
                  <Button variant="outline">Caption Ultimate</Button>
                </Link>
                <Link href="/faceswap">
                  <Button variant="outline">Face Swap</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredJobs.map((job, i) => {
              const thumbUrl = thumbnails.get(job.id)
              const typeInfo = JOB_TYPE_LABELS[job.job_type] || JOB_TYPE_LABELS.video
              const TypeIcon = typeInfo.icon
              const isImg = isImageJob(job)

              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors overflow-hidden group">
                    {/* Thumbnail area */}
                    <div className="relative aspect-[4/3] bg-secondary/30 overflow-hidden">
                      {job.status === 'completed' && thumbUrl ? (
                        isImg ? (
                          <img
                            src={thumbUrl}
                            alt={job.source_file_name || 'Output'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <video
                            src={thumbUrl}
                            preload="metadata"
                            muted
                            className="w-full h-full object-cover"
                            onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                            onMouseLeave={(e) => {
                              const v = e.target as HTMLVideoElement
                              v.pause()
                              v.currentTime = 0
                            }}
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {job.status === 'processing' || job.status === 'pending' || job.status === 'uploading' ? (
                            <div className="text-center">
                              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                              <span className="text-xs text-muted-foreground">{job.progress}%</span>
                            </div>
                          ) : job.status === 'failed' ? (
                            <div className="text-center text-destructive">
                              <span className="text-xs">Failed</span>
                            </div>
                          ) : (
                            <TypeIcon className={`w-8 h-8 text-muted-foreground`} />
                          )}
                        </div>
                      )}

                      {/* Type badge */}
                      <div className="absolute top-2 left-2">
                        <Badge
                          variant="outline"
                          className="bg-background/80 backdrop-blur-sm text-xs"
                        >
                          <TypeIcon className={`w-3 h-3 mr-1 ${typeInfo.color}`} />
                          {typeInfo.label}
                        </Badge>
                      </div>

                      {/* Hover overlay with download */}
                      {job.status === 'completed' && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownloadJob(job)
                            }}
                            disabled={!!downloadingJobId}
                            className="bg-primary hover:bg-primary/90"
                          >
                            {downloadingJobId === job.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : (
                              <Download className="w-4 h-4 mr-1" />
                            )}
                            Download
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Card info */}
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {job.source_file_name || 'Untitled'}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{job.variant_count} variants</span>
                            {job.source_file_size && (
                              <>
                                <span className="text-border">|</span>
                                <span>{formatBytes(job.source_file_size)}</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${getStatusColor(job.status)}`}
                            >
                              {job.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(job.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <MoreVertical className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {job.status === 'completed' && (
                              <DropdownMenuItem onClick={() => handleDownloadJob(job)}>
                                <Download className="w-4 h-4 mr-2" />
                                Download ZIP
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDelete(job.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Progress bar for processing jobs */}
                      {(job.status === 'processing' || job.status === 'uploading') && (
                        <div className="mt-2">
                          <div className="h-1 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <Button
                variant="outline"
                onClick={() => loadJobs(false)}
                disabled={loadingMore}
                className="border-border/50"
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
