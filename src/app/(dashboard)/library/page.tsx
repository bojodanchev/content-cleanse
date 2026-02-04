'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Download,
  MoreVertical,
  FileVideo,
  Trash2,
  Clock,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { getClient } from '@/lib/supabase/client'
import { formatBytes } from '@/lib/utils'
import type { Job } from '@/lib/supabase/types'

export default function LibraryPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all')

  const supabase = getClient()

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setJobs(data)
    setLoading(false)
  }

  const handleDownload = async (job: Job) => {
    if (!job.output_zip_path) return

    const { data } = await supabase.storage
      .from('outputs')
      .createSignedUrl(job.output_zip_path, 3600)

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  const handleDelete = async (jobId: string) => {
    await supabase.from('jobs').delete().eq('id', jobId)
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.source_file_name?.toLowerCase().includes(search.toLowerCase()) ||
      job.id.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'all' ||
      (filter === 'processing' &&
        (job.status === 'processing' || job.status === 'uploading' || job.status === 'pending')) ||
      job.status === filter
    return matchesSearch && matchesFilter
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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Video Library</h1>
        <p className="text-muted-foreground">
          View and manage all your processed videos
        </p>
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
            <div className="flex gap-2">
              {(['all', 'completed', 'processing', 'failed'] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'bg-primary' : 'border-border/50'}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-card/50 animate-pulse"
            />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-16 text-center">
            <FileVideo className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No videos found</h3>
            <p className="text-muted-foreground">
              {search || filter !== 'all'
                ? 'Try adjusting your filters'
                : 'Upload your first video to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    {/* Thumbnail placeholder */}
                    <div className="w-20 h-14 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                      <FileVideo className="w-6 h-6 text-muted-foreground" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">
                          {job.source_file_name || 'Untitled Video'}
                        </h3>
                        <Badge
                          variant="outline"
                          className={getStatusColor(job.status)}
                        >
                          {job.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{job.variant_count} variants</span>
                        {job.source_file_size && (
                          <span>{formatBytes(job.source_file_size)}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {job.status === 'completed' && (
                        <Button
                          size="sm"
                          onClick={() => handleDownload(job)}
                          className="bg-primary/20 text-primary hover:bg-primary/30"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {job.status === 'completed' && (
                            <DropdownMenuItem onClick={() => handleDownload(job)}>
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
                  </div>

                  {/* Progress bar for processing jobs */}
                  {(job.status === 'processing' || job.status === 'uploading') && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">
                          Processing...
                        </span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
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
          ))}
        </div>
      )}
    </div>
  )
}
