# Support Tickets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a customer support ticket system where logged-in users submit tickets with conversation threads, and admins manage them via a new Support tab in the admin panel.

**Architecture:** New `support_tickets` and `ticket_messages` Supabase tables with RLS. User-facing routes under `/(dashboard)/support`. Admin routes under `/api/admin/support`. Admin UI as a third tab in the existing admin panel page. All follows existing patterns: `createClient()` for user auth, `verifyAdminSession()` + `createServiceClient()` for admin auth.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Tailwind CSS, lucide-react icons

**Design doc:** `docs/plans/2026-03-02-support-tickets-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: migration via Supabase MCP `apply_migration`

**Step 1: Apply migration 014 via Supabase MCP**

Run `apply_migration` with name `support_tickets` and this SQL:

```sql
-- Enums
CREATE TYPE ticket_category AS ENUM ('billing', 'processing', 'bug', 'feature_request', 'account', 'other');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high');

-- Support tickets table
CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (char_length(subject) <= 200),
  category ticket_category NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Ticket messages table
CREATE TABLE ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  message text NOT NULL CHECK (char_length(message) <= 5000),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created_at ON ticket_messages(created_at ASC);

-- RLS: support_tickets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS: ticket_messages
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages on own tickets"
  ON ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add messages to own open tickets"
  ON ticket_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
      AND support_tickets.status IN ('open', 'in_progress')
    )
  );

-- Auto-update updated_at on support_tickets
CREATE OR REPLACE FUNCTION update_support_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_ticket_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_updated_at();
```

**Step 2: Verify migration**

Run `list_tables` via Supabase MCP and confirm `support_tickets` and `ticket_messages` appear.

**Step 3: Commit**

```bash
# Nothing to commit locally — migration is applied directly to Supabase
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/supabase/types.ts`

**Step 1: Add support ticket types to the end of `types.ts`**

Add these types after the existing type definitions (after the `MultiplySettings` interface area):

```typescript
// Support tickets
export type TicketCategory = 'billing' | 'processing' | 'bug' | 'feature_request' | 'account' | 'other'

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export type TicketPriority = 'low' | 'medium' | 'high'

export interface SupportTicket {
  id: string
  user_id: string
  subject: string
  category: TicketCategory
  status: TicketStatus
  priority: TicketPriority | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export interface TicketMessage {
  id: string
  ticket_id: string
  user_id: string
  is_admin: boolean
  message: string
  created_at: string
}
```

**Step 2: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: add support ticket TypeScript types"
```

---

### Task 3: User API — Create Ticket

**Files:**
- Create: `src/app/api/support/tickets/route.ts`

**Step 1: Create the route file**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TicketCategory } from '@/lib/supabase/types'

const VALID_CATEGORIES: TicketCategory[] = ['billing', 'processing', 'bug', 'feature_request', 'account', 'other']

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subject, category, message } = await request.json()

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0 || subject.length > 200) {
      return NextResponse.json({ error: 'Subject is required (max 200 characters)' }, { status: 400 })
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0 || message.length > 5000) {
      return NextResponse.json({ error: 'Message is required (max 5000 characters)' }, { status: 400 })
    }

    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({ user_id: user.id, subject: subject.trim(), category })
      .select()
      .single()

    if (ticketError || !ticket) {
      console.error('Create ticket error:', ticketError)
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
    }

    // Create first message
    const { error: msgError } = await supabase
      .from('ticket_messages')
      .insert({ ticket_id: ticket.id, user_id: user.id, message: message.trim() })

    if (msgError) {
      console.error('Create message error:', msgError)
      // Clean up the ticket if message creation fails
      await supabase.from('support_tickets').delete().eq('id', ticket.id)
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
    }

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    console.error('Create ticket error:', error)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    let query = supabase
      .from('support_tickets')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data: tickets, count, error } = await query

    if (error) {
      console.error('List tickets error:', error)
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
    }

    return NextResponse.json({
      tickets: tickets || [],
      total: count || 0,
      page,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
    })
  } catch (error) {
    console.error('List tickets error:', error)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/support/tickets/route.ts
git commit -m "feat: add create and list support tickets API"
```

---

### Task 4: User API — Ticket Detail + Reply

**Files:**
- Create: `src/app/api/support/tickets/[id]/route.ts`
- Create: `src/app/api/support/tickets/[id]/messages/route.ts`

**Step 1: Create ticket detail route**

`src/app/api/support/tickets/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
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

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const { data: messages, error: msgError } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('Fetch messages error:', msgError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({ ticket, messages: messages || [] })
  } catch (error) {
    console.error('Ticket detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 })
  }
}
```

**Step 2: Create message reply route**

`src/app/api/support/tickets/[id]/messages/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    if (!message || typeof message !== 'string' || message.trim().length === 0 || message.length > 5000) {
      return NextResponse.json({ error: 'Message is required (max 5000 characters)' }, { status: 400 })
    }

    // Verify ticket belongs to user and is open/in_progress
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return NextResponse.json({ error: 'Cannot reply to a resolved or closed ticket' }, { status: 400 })
    }

    const { data: msg, error: msgError } = await supabase
      .from('ticket_messages')
      .insert({ ticket_id: id, user_id: user.id, message: message.trim() })
      .select()
      .single()

    if (msgError) {
      console.error('Create message error:', msgError)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ message: msg }, { status: 201 })
  } catch (error) {
    console.error('Reply error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/support/tickets/[id]/route.ts src/app/api/support/tickets/[id]/messages/route.ts
git commit -m "feat: add ticket detail and reply API routes"
```

---

### Task 5: Admin API — List, Update, Reply

**Files:**
- Create: `src/app/api/admin/support/route.ts`
- Create: `src/app/api/admin/support/[id]/route.ts`
- Create: `src/app/api/admin/support/[id]/messages/route.ts`

**Step 1: Create admin list route**

`src/app/api/admin/support/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/admin/auth'

export async function GET(request: Request) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    // Get tickets with user email via join
    let query = supabase
      .from('support_tickets')
      .select('*, profiles!inner(email, plan, created_at)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      query = query.eq('status', status)
    }
    if (category) {
      query = query.eq('category', category)
    }
    if (priority) {
      query = query.eq('priority', priority)
    }
    if (search) {
      query = query.ilike('profiles.email', `%${search}%`)
    }

    const { data: tickets, count, error } = await query

    if (error) {
      console.error('Admin list tickets error:', error)
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
    }

    // Get last message date for each ticket
    const ticketIds = (tickets || []).map(t => t.id)
    let lastMessages: Record<string, string> = {}

    if (ticketIds.length > 0) {
      const { data: msgs } = await supabase
        .from('ticket_messages')
        .select('ticket_id, created_at')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: false })

      if (msgs) {
        for (const msg of msgs) {
          if (!lastMessages[msg.ticket_id]) {
            lastMessages[msg.ticket_id] = msg.created_at
          }
        }
      }
    }

    const enriched = (tickets || []).map(t => ({
      id: t.id,
      user_id: t.user_id,
      user_email: (t.profiles as { email: string })?.email || null,
      user_plan: (t.profiles as { plan: string })?.plan || null,
      user_created_at: (t.profiles as { created_at: string })?.created_at || null,
      subject: t.subject,
      category: t.category,
      status: t.status,
      priority: t.priority,
      created_at: t.created_at,
      updated_at: t.updated_at,
      resolved_at: t.resolved_at,
      last_message_at: lastMessages[t.id] || t.created_at,
    }))

    // Stats
    const [openRes, inProgressRes, resolvedRes] = await Promise.all([
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
    ])

    return NextResponse.json({
      tickets: enriched,
      total: count || 0,
      page,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
      stats: {
        open: openRes.count || 0,
        in_progress: inProgressRes.count || 0,
        resolved: resolvedRes.count || 0,
      },
    })
  } catch (error) {
    console.error('Admin support error:', error)
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
  }
}
```

**Step 2: Create admin update route**

`src/app/api/admin/support/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyAdminSession } from '@/lib/admin/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const { id } = await params

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*, profiles!inner(email, plan, full_name, created_at)')
      .eq('id', id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const { data: messages, error: msgError } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('Admin fetch messages error:', msgError)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({ ticket, messages: messages || [] })
  } catch (error) {
    console.error('Admin ticket detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdminSession()
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const { id } = await params
    const body = await request.json()

    const updates: Record<string, unknown> = {}

    if (body.status && ['open', 'in_progress', 'resolved', 'closed'].includes(body.status)) {
      updates.status = body.status
      if (body.status === 'resolved' || body.status === 'closed') {
        updates.resolved_at = new Date().toISOString()
      }
    }

    if (body.priority !== undefined) {
      if (body.priority === null || ['low', 'medium', 'high'].includes(body.priority)) {
        updates.priority = body.priority
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error || !ticket) {
      console.error('Admin update ticket error:', error)
      return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
    }

    return NextResponse.json({ ticket })
  } catch (error) {
    console.error('Admin update error:', error)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}
```

**Step 3: Create admin reply route**

`src/app/api/admin/support/[id]/messages/route.ts`:

```typescript
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

    const supabase = createServiceClient()
    const { id } = await params
    const { message } = await request.json()

    if (!message || typeof message !== 'string' || message.trim().length === 0 || message.length > 5000) {
      return NextResponse.json({ error: 'Message is required (max 5000 characters)' }, { status: 400 })
    }

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Insert admin message (using the ticket owner's user_id for FK, but is_admin = true)
    const { data: msg, error: msgError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: id,
        user_id: ticket.user_id,
        is_admin: true,
        message: message.trim(),
      })
      .select()
      .single()

    if (msgError) {
      console.error('Admin reply error:', msgError)
      return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
    }

    // Auto-set ticket to in_progress if it was open
    await supabase
      .from('support_tickets')
      .update({ status: 'in_progress' })
      .eq('id', id)
      .eq('status', 'open')

    return NextResponse.json({ message: msg }, { status: 201 })
  } catch (error) {
    console.error('Admin reply error:', error)
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }
}
```

**Step 4: Commit**

```bash
git add src/app/api/admin/support/route.ts src/app/api/admin/support/[id]/route.ts src/app/api/admin/support/[id]/messages/route.ts
git commit -m "feat: add admin support ticket API routes"
```

---

### Task 6: User Support Page — Ticket List

**Files:**
- Create: `src/app/(dashboard)/support/page.tsx`

**Step 1: Create the support page**

This is a `'use client'` page with:
- Header row: "Support" title + "New Ticket" button (opens dialog)
- Filter tabs: All / Open / Resolved
- Ticket card list showing subject, category badge, status badge, relative time
- Empty state when no tickets
- Pagination
- Click a ticket card → navigate to `/support/[id]`

Badge classes to reuse (matching existing patterns in the codebase):

```typescript
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
```

The "New Ticket" dialog contains:
- Subject input (text, max 200 chars)
- Category select dropdown (6 options)
- Message textarea (max 5000 chars)
- Cancel + Submit buttons
- On success: redirect to `/support/[ticketId]`

Follow the same page structure as other dashboard pages: full-width container with `p-6` or `p-8`, cards with `rounded-xl border border-border/40 bg-card/50`.

**Step 2: Commit**

```bash
git add src/app/(dashboard)/support/page.tsx
git commit -m "feat: add user support ticket list page"
```

---

### Task 7: User Support Page — Ticket Detail

**Files:**
- Create: `src/app/(dashboard)/support/[id]/page.tsx`

**Step 1: Create the ticket detail page**

This is a `'use client'` page with:
- Back link to `/support`
- Header: subject, category badge, status badge, created date
- Message thread: chronological list
  - User messages: aligned left, `bg-secondary/30` background
  - Admin messages: aligned left but with `bg-pink-500/10 border-pink-500/20` background and "Admin" badge
  - Each message shows: message text, relative timestamp
- Reply section at bottom (only if status is `open` or `in_progress`):
  - Textarea + Send button
  - On success: append message to thread, clear textarea
- If status is `resolved` or `closed`: show banner "This ticket has been resolved" with muted styling

Fetch: `GET /api/support/tickets/[id]` on mount.
Reply: `POST /api/support/tickets/[id]/messages` with `{ message }`.

**Step 2: Commit**

```bash
git add src/app/(dashboard)/support/[id]/page.tsx
git commit -m "feat: add user support ticket detail page"
```

---

### Task 8: Dashboard Navigation — Add Support Link

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx` (lines 5-24)
- Modify: `src/components/dashboard/mobile-nav.tsx` (lines 7-27)

**Step 1: Update layout.tsx navigation array**

In `src/app/(dashboard)/layout.tsx`:

1. Add `LifeBuoy` to the lucide-react import (line 11, alongside `Repeat`)
2. Add support entry to the `navigation` array after Settings (after line 23):

```typescript
{ name: 'Support', href: '/support', icon: LifeBuoy },
```

**Step 2: Update mobile-nav.tsx navigation array**

In `src/components/dashboard/mobile-nav.tsx`:

1. Add `LifeBuoy` to the lucide-react import (line 14, alongside `X`)
2. Add same entry to the `navigation` array after Settings (after line 26):

```typescript
{ name: 'Support', href: '/support', icon: LifeBuoy },
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/layout.tsx src/components/dashboard/mobile-nav.tsx
git commit -m "feat: add Support link to dashboard sidebar navigation"
```

---

### Task 9: Admin Panel — Support Tab

**Files:**
- Modify: `src/app/(marketing)/admin/page.tsx`

**Step 1: Add Support tab to admin panel**

This is the largest UI change. In the existing `admin/page.tsx`:

1. Add new types at the top (after `RevenueByUser` interface, around line 65):

```typescript
interface AdminTicketRow {
  id: string
  user_id: string
  user_email: string | null
  user_plan: string | null
  user_created_at: string | null
  subject: string
  category: string
  status: string
  priority: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  last_message_at: string
}

interface AdminTicketsResponse {
  tickets: AdminTicketRow[]
  total: number
  page: number
  totalPages: number
  stats: { open: number; in_progress: number; resolved: number }
}

interface AdminTicketMessage {
  id: string
  ticket_id: string
  user_id: string
  is_admin: boolean
  message: string
  created_at: string
}

interface AdminTicketDetail {
  ticket: AdminTicketRow & { profiles: { email: string; plan: string; full_name: string | null; created_at: string } }
  messages: AdminTicketMessage[]
}
```

2. Update `activeTab` type (line 110) from `'users' | 'financials'` to `'users' | 'financials' | 'support'`

3. Add support state variables (after `financialsLoaded`, around line 153):

```typescript
// Support tickets
const [supportTickets, setSupportTickets] = useState<AdminTicketRow[]>([])
const [supportTotal, setSupportTotal] = useState(0)
const [supportPage, setSupportPage] = useState(1)
const [supportStats, setSupportStats] = useState<{ open: number; in_progress: number; resolved: number }>({ open: 0, in_progress: 0, resolved: 0 })
const [supportSearch, setSupportSearch] = useState('')
const [supportSearchInput, setSupportSearchInput] = useState('')
const [supportStatusFilter, setSupportStatusFilter] = useState('all')
const [supportCategoryFilter, setSupportCategoryFilter] = useState('all')
const [supportPriorityFilter, setSupportPriorityFilter] = useState('all')
const [supportLoading, setSupportLoading] = useState(false)
const [supportLoaded, setSupportLoaded] = useState(false)

// Ticket detail (inline expand)
const [expandedTicket, setExpandedTicket] = useState<string | null>(null)
const [ticketDetail, setTicketDetail] = useState<AdminTicketDetail | null>(null)
const [ticketDetailLoading, setTicketDetailLoading] = useState(false)
const [adminReplyText, setAdminReplyText] = useState('')
const [adminReplySending, setAdminReplySending] = useState(false)
const [adminStatusChange, setAdminStatusChange] = useState('')
const [adminPriorityChange, setAdminPriorityChange] = useState('')
```

4. Add fetch functions (after `fetchRevenueByUser`, around line 272):

```typescript
// Fetch support tickets
const fetchSupportTickets = useCallback(async () => {
  setSupportLoading(true)
  try {
    const params = new URLSearchParams({ page: String(supportPage), limit: String(pageSize) })
    if (supportSearch) params.set('search', supportSearch)
    if (supportStatusFilter !== 'all') params.set('status', supportStatusFilter)
    if (supportCategoryFilter !== 'all') params.set('category', supportCategoryFilter)
    if (supportPriorityFilter !== 'all') params.set('priority', supportPriorityFilter)
    const res = await fetch(`/api/admin/support?${params}`)
    if (res.ok) {
      const data: AdminTicketsResponse = await res.json()
      setSupportTickets(data.tickets)
      setSupportTotal(data.total)
      setSupportStats(data.stats)
    }
  } catch { /* silent */ }
  setSupportLoading(false)
}, [supportPage, supportSearch, supportStatusFilter, supportCategoryFilter, supportPriorityFilter])

// Fetch single ticket detail
const fetchTicketDetail = async (ticketId: string) => {
  setTicketDetailLoading(true)
  try {
    const res = await fetch(`/api/admin/support/${ticketId}`)
    if (res.ok) {
      setTicketDetail(await res.json())
    }
  } catch { /* silent */ }
  setTicketDetailLoading(false)
}

// Admin reply
const handleAdminReply = async (ticketId: string) => {
  if (!adminReplyText.trim()) return
  setAdminReplySending(true)
  try {
    const res = await fetch(`/api/admin/support/${ticketId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: adminReplyText }),
    })
    if (res.ok) {
      setAdminReplyText('')
      fetchTicketDetail(ticketId)
      fetchSupportTickets()
    }
  } catch { /* silent */ }
  setAdminReplySending(false)
}

// Admin update ticket
const handleTicketUpdate = async (ticketId: string, updates: { status?: string; priority?: string | null }) => {
  try {
    const res = await fetch(`/api/admin/support/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      fetchTicketDetail(ticketId)
      fetchSupportTickets()
    }
  } catch { /* silent */ }
}
```

5. Add effects for support tab lazy-loading (after the financials effects, around line 296):

```typescript
// Load support data when tab switches
useEffect(() => {
  if (authed && activeTab === 'support' && !supportLoaded) {
    fetchSupportTickets()
    setSupportLoaded(true)
  }
}, [authed, activeTab, supportLoaded, fetchSupportTickets])

// Refetch support when filters/page change
useEffect(() => {
  if (supportLoaded) fetchSupportTickets()
}, [supportPage, supportSearch, supportStatusFilter, supportCategoryFilter, supportPriorityFilter, fetchSupportTickets, supportLoaded])

// Debounced search (support)
useEffect(() => {
  const t = setTimeout(() => { setSupportSearch(supportSearchInput); setSupportPage(1) }, 400)
  return () => clearTimeout(t)
}, [supportSearchInput])

// Reset page on filter change
useEffect(() => { setSupportPage(1) }, [supportStatusFilter, supportCategoryFilter, supportPriorityFilter])
```

6. Add `'support'` to the tabs array (line 432):

Change `(['users', 'financials'] as const)` to `(['users', 'financials', 'support'] as const)`

7. Add the support tab JSX **after the financials tab closing `</>` and before the edit modal** (after line 861, before line 863):

This should render:
- Stats cards: Open / In Progress / Resolved counts (same card pattern as Users tab)
- Filter bar: email search, status dropdown, category dropdown, priority dropdown
- Table: user email, subject (truncated), category badge, priority badge, status badge, created date, last reply date
- Click row → toggles `expandedTicket` state and calls `fetchTicketDetail(id)`
- Expanded row below shows: user info, message thread, admin action bar (priority dropdown, status dropdown, reply textarea + send)
- Pagination

Badge class additions:

```typescript
const ticketCategoryBadge: Record<string, string> = {
  billing: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  processing: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  bug: 'bg-red-500/20 text-red-400 border border-red-500/30',
  feature_request: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  account: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  other: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
}

const ticketStatusBadge: Record<string, string> = {
  open: 'bg-green-500/20 text-green-400 border border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  resolved: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
  closed: 'bg-zinc-700 text-zinc-500',
}

const ticketPriorityBadge: Record<string, string> = {
  low: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  high: 'bg-red-500/20 text-red-400 border border-red-500/30',
}
```

Add these after the existing `statusBadgeClass` (around line 81).

Category labels for display:

```typescript
const categoryLabels: Record<string, string> = {
  billing: 'Billing',
  processing: 'Processing',
  bug: 'Bug Report',
  feature_request: 'Feature Request',
  account: 'Account',
  other: 'Other',
}
```

**Step 2: Commit**

```bash
git add src/app/(marketing)/admin/page.tsx
git commit -m "feat: add Support tab to admin panel with ticket management"
```

---

### Task 10: Build Verification + Final Commit

**Files:**
- None new

**Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 2: Fix any build errors**

If any type errors or import issues, fix them.

**Step 3: Verify all routes exist**

Check that these paths resolve:
- `src/app/(dashboard)/support/page.tsx`
- `src/app/(dashboard)/support/[id]/page.tsx`
- `src/app/api/support/tickets/route.ts`
- `src/app/api/support/tickets/[id]/route.ts`
- `src/app/api/support/tickets/[id]/messages/route.ts`
- `src/app/api/admin/support/route.ts`
- `src/app/api/admin/support/[id]/route.ts`
- `src/app/api/admin/support/[id]/messages/route.ts`

**Step 4: Manual smoke test**

Run `npm run dev`, then:
1. Log in as test user → navigate to `/support` → verify empty state shows
2. Create a ticket → verify it appears in the list
3. Click ticket → verify detail page with message thread
4. Navigate to `/admin` → log in → verify Support tab appears
5. Click Support tab → verify the test ticket shows
6. Reply as admin → verify reply appears on user side

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete support tickets feature — user + admin"
```
