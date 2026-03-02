# Support Tickets Feature Design

**Date**: 2026-03-02
**Status**: Approved

## Overview

Customer support ticket system where logged-in users submit tickets and have back-and-forth conversations with admins. Admin panel gets a new "Support" tab for ticket management and triage.

## Data Model

### support_tickets

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| user_id | uuid FK → profiles.id | ON DELETE CASCADE |
| subject | text | required, max 200 chars |
| category | ticket_category enum | billing, processing, bug, feature_request, account, other |
| status | ticket_status enum | open, in_progress, resolved, closed (default: open) |
| priority | ticket_priority enum | low, medium, high (nullable — admin-set only) |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |
| resolved_at | timestamptz | set when status → resolved/closed |

### ticket_messages

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| ticket_id | uuid FK → support_tickets.id | ON DELETE CASCADE |
| user_id | uuid FK → profiles.id | message author |
| is_admin | boolean | true = admin reply, false = user message (default: false) |
| message | text | required, max 5000 chars |
| created_at | timestamptz | default now() |

The ticket description is stored as the first row in `ticket_messages`. The ticket row itself is metadata only.

## API Routes

### User-facing

| Method | Route | Purpose |
|--------|-------|---------|
| POST | /api/support/tickets | Create ticket (subject, category, message) |
| GET | /api/support/tickets | List user's tickets (status filter, pagination) |
| GET | /api/support/tickets/[id] | Get ticket + all messages |
| POST | /api/support/tickets/[id]/messages | Add reply to ticket |

- Creating a ticket creates the `support_tickets` row + first `ticket_messages` row in one transaction
- Users can only reply to their own open/in_progress tickets

### Admin

| Method | Route | Purpose |
|--------|-------|---------|
| GET | /api/admin/support | List all tickets (filter by status/category/priority, search by email, pagination) |
| PATCH | /api/admin/support/[id] | Update ticket (status, priority) |
| POST | /api/admin/support/[id]/messages | Admin reply to ticket |

- Reuses existing `verifyAdminSession()` auth pattern
- Uses service role client (bypasses RLS)

## User-Facing UI

### Route: `/(dashboard)/support`

New sidebar nav item with `LifeBuoy` icon, placed after Settings.

### Ticket list view (default)

- Header: "Support" title + "New Ticket" button
- Filter tabs: All / Open / Resolved
- Card list: subject, category badge, status badge, time ago
- Empty state: "No tickets yet" with CTA

### New ticket form (dialog)

- Subject input (text, required)
- Category dropdown (6 categories)
- Message textarea (required, max 5000 chars)
- Submit → redirects to ticket detail view

### Ticket detail view (`/support/[id]`)

- Header: subject, category badge, status badge, created date
- Message thread: chronological, admin replies visually distinct (different bg/accent)
- Reply textarea + send button (hidden if resolved/closed)
- Resolved banner when applicable

## Admin Panel UI

### New "Support" tab in admin panel

### Stats cards row

- Open Tickets count
- In Progress count
- Resolved (last 30d) count
- Avg Response Time (placeholder "—" for now)

### Ticket table

- Filter bar: search by email, filter by status/category/priority
- Columns: user email, subject, category badge, priority badge, status badge, created date, last reply date
- Pagination: 20 per page
- Click row → detail view

### Ticket detail (inline expand)

- User info: email, plan badge, account age
- Full message thread
- Admin action bar: priority dropdown, status dropdown, reply textarea + send

## Migration (014)

### Enums

- `ticket_category`: billing, processing, bug, feature_request, account, other
- `ticket_status`: open, in_progress, resolved, closed
- `ticket_priority`: low, medium, high

### Indexes

- `support_tickets`: user_id, status, created_at DESC
- `ticket_messages`: ticket_id, created_at ASC

### RLS (support_tickets)

- SELECT: `user_id = auth.uid()`
- INSERT: `user_id = auth.uid()`
- UPDATE: none (admin-only via service role)

### RLS (ticket_messages)

- SELECT: ticket belongs to `auth.uid()` (join check)
- INSERT: ticket belongs to `auth.uid()` AND ticket status in (open, in_progress)

### Realtime

Not enabled — simple fetch-on-load pattern.

## Decisions

- No notifications for now (admin checks panel manually)
- Priority is admin-set only (users don't see it)
- No file attachments (can add later)
- No Realtime subscriptions (keep simple)
