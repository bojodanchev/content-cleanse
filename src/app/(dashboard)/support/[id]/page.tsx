'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Send, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SupportTicket, TicketMessage } from '@/lib/supabase/types'

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

export default function TicketDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadTicket()
  }, [id])

  const loadTicket = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/support/tickets/${id}`)
      if (res.ok) {
        const data = await res.json()
        setTicket(data.ticket)
        setMessages(data.messages)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async () => {
    if (!reply.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/support/tickets/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data.message])
        setReply('')
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <Link
          href="/support"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Support
        </Link>
        <p className="text-muted-foreground">Ticket not found.</p>
      </div>
    )
  }

  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed'
  const canReply = ticket.status === 'open' || ticket.status === 'in_progress'

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/support"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Support
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-3">{ticket.subject}</h1>
        <div className="flex items-center gap-2 flex-wrap">
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
          <span className="text-sm text-muted-foreground">
            Opened {timeAgo(ticket.created_at)}
          </span>
        </div>
      </div>

      {/* Resolved Banner */}
      {isResolved && (
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-4 mb-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-zinc-400 flex-shrink-0" />
          <p className="text-sm text-zinc-400">
            This ticket has been {ticket.status === 'closed' ? 'closed' : 'resolved'}.
          </p>
        </div>
      )}

      {/* Message Thread */}
      <div className="space-y-4 mb-8">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl p-4 ${
              msg.is_admin
                ? 'bg-pink-500/10 border border-pink-500/20'
                : 'bg-secondary/30 border border-border/40'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {msg.is_admin && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pink-500/20 text-pink-400 border border-pink-500/30">
                  Admin
                </span>
              )}
              <span className="text-xs text-muted-foreground">{timeAgo(msg.created_at)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
          </div>
        ))}
      </div>

      {/* Reply Section */}
      {canReply && (
        <div className="rounded-xl border border-border/40 bg-card/50 p-4">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, 5000))}
            placeholder="Type your reply..."
            rows={4}
            className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 px-3 py-2 text-sm focus:border-pink-500 focus:ring-1 focus:ring-pink-500 focus:outline-none resize-none mb-3"
            maxLength={5000}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{reply.length}/5000</p>
            <Button
              onClick={handleReply}
              disabled={sending || !reply.trim()}
              className="bg-pink-600 hover:bg-pink-500 text-white"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Reply
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
