'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Loader2, Download, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { Job } from '@/lib/supabase/types'

interface ProgressTrackerProps {
  job: Job
  onDownload: () => void
  onNewJob: () => void
}

const statusSteps = [
  { id: 'pending', label: 'Starting job' },
  { id: 'processing', label: 'Creating variants' },
  { id: 'completed', label: 'Ready to download' },
]

export function ProgressTracker({ job, onDownload, onNewJob }: ProgressTrackerProps) {
  const [elapsedTime, setElapsedTime] = useState(0)

  useEffect(() => {
    if (job.status === 'processing' || job.status === 'uploading') {
      const interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [job.status])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getCurrentStep = () => {
    switch (job.status) {
      case 'pending':
      case 'uploading':
        return 0
      case 'processing':
        return 1
      case 'completed':
        return 2
      case 'failed':
        return -1
      default:
        return 0
    }
  }

  const currentStep = getCurrentStep()

  if (job.status === 'failed') {
    return (
      <div className="rounded-2xl border border-destructive/50 bg-destructive/10 p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-destructive/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Processing Failed</h3>
        <p className="text-muted-foreground mb-6">
          {job.error_message || 'An unexpected error occurred'}
        </p>
        <Button onClick={onNewJob} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }

  if (job.status === 'completed') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-primary/50 bg-primary/5 p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6"
        >
          <Check className="w-10 h-10 text-white" />
        </motion.div>
        <h3 className="text-2xl font-bold mb-2">Processing Complete!</h3>
        <p className="text-muted-foreground mb-2">
          {job.variant_count} unique variants created
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Processed in {formatTime(elapsedTime)}
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={onDownload}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Download className="w-4 h-4 mr-2" />
            Download ZIP
          </Button>
          <Button onClick={onNewJob} variant="outline">
            Process Another
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-8">
      {/* Progress steps */}
      <div className="flex items-center justify-between mb-8">
        {statusSteps.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  i < currentStep
                    ? 'bg-primary text-white'
                    : i === currentStep
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {i < currentStep ? (
                  <Check className="w-5 h-5" />
                ) : i === currentStep ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={`mt-2 text-sm ${
                  i <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < statusSteps.length - 1 && (
              <div
                className={`w-20 h-0.5 mx-2 ${
                  i < currentStep ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Current progress */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {job.status === 'uploading' || job.status === 'pending'
              ? 'Starting processing...'
              : (job.variants_completed || 0) >= job.variant_count
              ? 'Finalizing variants...'
              : `Creating variant ${(job.variants_completed || 0) + 1} of ${job.variant_count}...`}
          </span>
          <span className="text-sm font-medium">{job.progress}%</span>
        </div>
        <Progress value={job.progress} className="h-3" />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Elapsed: {formatTime(elapsedTime)}</span>
          <span>
            {job.variants_completed}/{job.variant_count} variants
          </span>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-6 p-4 rounded-lg bg-secondary/30">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Tip:</strong> You can close this
          page and come back later. We&apos;ll send you an email when processing is
          complete.
        </p>
      </div>
    </div>
  )
}
