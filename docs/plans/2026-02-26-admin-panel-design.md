# Admin Panel Design

## Overview
Password-protected admin page at `/admin` for managing users and their plans. No database role system — access controlled by a shared password stored in `ADMIN_PASSWORD` env var.

## Access & Auth
- **Route**: `/admin` (marketing layout, no Supabase auth required)
- **Flow**: Password prompt → POST `/api/admin/auth` → validates against `ADMIN_PASSWORD` env var
- **Session**: `admin_session` httpOnly cookie, 24h expiry
- **All `/api/admin/*` routes**: Check cookie before processing
- **Password**: Set via Vercel env var `ADMIN_PASSWORD`

## Page Layout

### Summary Stats (top row cards)
- Total Users
- Free / Pro / Agency (count per plan)
- Active Last 7 Days (users with jobs created in last 7 days)

### User Table
- **Columns**: Email, Full Name, Plan, Plan Expires, Quota Used / Monthly Quota, Signed Up
- **Sort**: Newest first (by `created_at`)
- **Search**: By email or name (server-side)
- **Filter**: All / Free / Pro / Agency dropdown
- **Pagination**: 25 per page

### Edit User (modal)
- **Change Plan**: Dropdown (Free / Pro / Agency)
  - Updates `plan` on profile
  - Sets `plan_expires_at` to 30 days from now
  - Recalculates `monthly_quota` from plan config (5 / 100 / 10000)
  - Resets `quota_used` to 0
- **Adjust Quota**: Two number inputs
  - `quota_used` — reset or adjust current usage
  - `monthly_quota` — override default if needed

## API Routes
- `POST /api/admin/auth` — Validate password, set cookie
- `GET /api/admin/users` — List users (search, filter, pagination)
- `GET /api/admin/stats` — Summary stats
- `PATCH /api/admin/users/[id]` — Update plan or quota

All admin API routes use Supabase service role client and verify admin cookie.

## Tech Decisions
- No DB migration needed (no role/admin columns)
- Reuses existing plan config from `src/lib/crypto/plans.ts`
- Follows project dark cyberpunk theme
- Standalone page (no sidebar/dashboard nav)
