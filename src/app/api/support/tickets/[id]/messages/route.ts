import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/support/tickets/[id]/messages — user replies to a ticket
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { message } = await request.json()

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message must be 5000 characters or less' }, { status: 400 })
    }

    // Verify ticket belongs to user and is not resolved/closed
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot reply to a resolved or closed ticket' },
        { status: 400 }
      )
    }

    // Insert message
    const { data: newMessage, error: messageError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: id,
        user_id: user.id,
        is_admin: false,
        message: message.trim(),
      })
      .select()
      .single()

    if (messageError) {
      console.error('Create ticket message error:', messageError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ message: newMessage }, { status: 201 })
  } catch (error) {
    console.error('Reply to ticket error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
