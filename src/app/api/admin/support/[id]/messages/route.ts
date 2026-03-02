import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/admin/auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message must be under 5000 characters' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify ticket exists and get its user_id
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('id, user_id, status')
      .eq('id', id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Insert admin reply (use ticket's user_id, mark as admin)
    const { error: insertError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: id,
        user_id: ticket.user_id,
        is_admin: true,
        message: message.trim(),
      })

    if (insertError) {
      console.error('Admin reply insert error:', insertError)
      return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
    }

    // Auto-update ticket status from open to in_progress
    if (ticket.status === 'open') {
      await supabase
        .from('support_tickets')
        .update({ status: 'in_progress' })
        .eq('id', id)
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Admin reply error:', error)
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }
}
