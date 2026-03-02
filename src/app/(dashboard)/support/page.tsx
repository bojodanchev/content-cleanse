'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Loader2,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SupportTicket, TicketCategory, TicketStatus } from '@/lib/supabase/types'

const categoryBadgeClass: Record<string, string> = {
  billing: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  processing: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  bug: 'bg-red-500/20 text-red-400 border border-red-500/30',
  feature_request: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  account: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  other: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
}

const statusBadgeClass: Record<string, string> = {
  open: 'bg-green-500/20 text-green-400 border border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  resolved: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
  closed: 'bg-zinc-700 text-zinc-500',
}

const categoryLabels: Record<string, string> = {
  billing: 'Billing',
  processing: 'Processing',
  bug: 'Bug Report',
  feature_request: 'Feature Request',
  account: 'Account',
  other: 'Other',
}

const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

type FilterStatus = 'all' | 'open' | 'resolved'

const LIMIT = 20

export default function SupportPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<TicketCategory>('other')
  const [message, setMessage] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  useEffect(() => {
    loadTickets()
  }, [filter, page])

  const loadTickets = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (filter !== 'all') params.set('status', filter)
      const res = await fetch(`/api/support/tickets?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), category, message: message.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setDialogOpen(false)
        setSubject('')
        setCategory('other')
        setMessage('')
        router.push(`/support/${data.ticket.id}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleFilterChange = (f: FilterStatus) => {
    setFilter(f)
    setPage(1)
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Support</h1>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-pink-600 hover:bg-pink-500 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-secondary/30 border border-border/40 w-fit">
        {(['all', 'open', 'resolved'] as FilterStatus[]).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-pink-600 text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Resolved'}
          </button>
        ))}
      </div>

      {/* Ticket List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-1">No tickets yet</h3>
          <p className="text-muted-foreground text-sm mb-4 max-w-sm">
            Have a question or need help? Submit a support ticket and we will get back to you.
          </p>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-pink-600 hover:bg-pink-500 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Submit Your First Ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/support/${ticket.id}`}>
              <div className="rounded-xl border border-border/40 bg-card/50 p-4 hover:bg-card/80 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{ticket.subject}</h3>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          categoryBadgeClass[ticket.category] || categoryBadgeClass.other
                        }`}
                      >
                        {categoryLabels[ticket.category] || ticket.category}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          statusBadgeClass[ticket.status] || statusBadgeClass.open
                        }`}
                      >
                        {statusLabels[ticket.status] || ticket.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(ticket.created_at)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* New Ticket Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>New Support Ticket</DialogTitle>
            <DialogDescription>
              Describe your issue and we will get back to you as soon as possible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, 200))}
                placeholder="Brief description of your issue"
                className="bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">{subject.length}/200</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-500 focus:outline-none"
              >
                <option value="billing">Billing</option>
                <option value="processing">Processing Issues</option>
                <option value="bug">Bug Report</option>
                <option value="feature_request">Feature Request</option>
                <option value="account">Account</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 5000))}
                placeholder="Describe your issue in detail..."
                rows={5}
                className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 px-3 py-2 text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-500 focus:outline-none resize-none"
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/5000</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !subject.trim() || !message.trim()}
              className="bg-pink-600 hover:bg-pink-500 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Ticket'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
