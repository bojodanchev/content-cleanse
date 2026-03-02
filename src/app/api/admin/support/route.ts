import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/admin/auth'

export async function GET(request: Request) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const category = searchParams.get('category') || 'all'
    const priority = searchParams.get('priority') || 'all'
    const search = searchParams.get('search') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const offset = (page - 1) * limit

    const supabase = createServiceClient()

    // If searching by email, find matching user IDs first
    let searchUserIds: string[] | null = null
    if (search) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', `%${search}%`)

      if (!profiles || profiles.length === 0) {
        return NextResponse.json({
          tickets: [],
          total: 0,
          page,
          totalPages: 0,
          stats: { open: 0, in_progress: 0, resolved: 0 },
        })
      }

      searchUserIds = profiles.map((p) => p.id)
    }

    // Build tickets query
    let query = supabase
      .from('support_tickets')
      .select('*', { count: 'exact' })

    if (searchUserIds) {
      query = query.in('user_id', searchUserIds)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (priority && priority !== 'all') {
      query = query.eq('priority', priority)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: tickets, count, error } = await query

    if (error) {
      console.error('Admin support tickets query error:', error)
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
    }

    // Batch-fetch user profiles for the tickets in this page
    const uniqueUserIds = [...new Set((tickets ?? []).map((t) => t.user_id).filter(Boolean))]
    const profileMap = new Map<string, { email: string; plan: string; created_at: string }>()

    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, plan, created_at')
        .in('id', uniqueUserIds)

      if (profiles) {
        for (const profile of profiles) {
          profileMap.set(profile.id, {
            email: profile.email,
            plan: profile.plan,
            created_at: profile.created_at,
          })
        }
      }
    }

    // Get last message date per ticket
    const ticketIds = (tickets ?? []).map((t) => t.id)
    const lastMessageMap = new Map<string, string>()

    if (ticketIds.length > 0) {
      const { data: messages } = await supabase
        .from('ticket_messages')
        .select('ticket_id, created_at')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: false })

      if (messages) {
        for (const msg of messages) {
          if (!lastMessageMap.has(msg.ticket_id)) {
            lastMessageMap.set(msg.ticket_id, msg.created_at)
          }
        }
      }
    }

    // Fetch stats (unfiltered counts)
    const [
      { count: openCount },
      { count: inProgressCount },
      { count: resolvedCount },
    ] = await Promise.all([
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
    ])

    const total = count ?? 0

    return NextResponse.json({
      tickets: (tickets ?? []).map((t) => {
        const profile = profileMap.get(t.user_id)
        return {
          id: t.id,
          user_id: t.user_id,
          user_email: profile?.email ?? null,
          user_plan: profile?.plan ?? null,
          user_created_at: profile?.created_at ?? null,
          subject: t.subject,
          category: t.category,
          status: t.status,
          priority: t.priority,
          created_at: t.created_at,
          updated_at: t.updated_at,
          resolved_at: t.resolved_at,
          last_message_at: lastMessageMap.get(t.id) ?? t.created_at,
        }
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        open: openCount ?? 0,
        in_progress: inProgressCount ?? 0,
        resolved: resolvedCount ?? 0,
      },
    })
  } catch (error) {
    console.error('Admin support tickets error:', error)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}
