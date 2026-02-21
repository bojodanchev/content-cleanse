# Discovery Log

Reverse-chronological. Most recent first.

## [2026-02-21] Rebrand Content Cleanse → Creator Engine
**Context**: Bought domain `creatorengine.app`, rebranding entire project
**Learnings**:
- Kept two-tone logo style: `Creator<span className="text-primary">Engine</span>`
- Changed: sidebar, nav, footer, metadata, pricing email, crypto order descriptions, package.json, Modal app name
- Did NOT change: CLAUDE.md (project docs update separate), SQL migrations (already applied), docs/
- Modal app renamed in code to `creator-engine` but needs `modal deploy` to update actual endpoints
- `NEXT_PUBLIC_APP_URL` env var on Vercel needs updating to `https://creatorengine.app`
**Files touched**: 14 files across marketing, auth, dashboard layouts, API routes, workers

## [2026-02-21] Production hardening — 19 security/quality fixes
**Context**: Comprehensive code review with `/code-review` then fix all actionable issues
**Learnings**:
- Open redirect: validate `redirect` param starts with `/` and not `//`
- File path ownership: verify `filePath.startsWith(\`${user.id}/\`)` in job create + faces routes
- Job status guards: all 5 process routes now check `status !== 'pending'` to prevent reprocessing
- Quota refund: all process routes refund on crash via catch blocks with `refund_quota` RPC
- Fetch timeouts: `fetchWithTimeout` helper (30s) for Modal, AbortController (15s) for NOWPayments
- Faceswap limit bypass: count query was missing `'pending'` status filter
- Removed: broken Google OAuth button, forgot-password link, broken Terms/Privacy links
- UX: replaced `alert()` with inline error banners, clamped quota% to 100%, fixed 500MB→50MB typo
- Items NOT fixed (need infrastructure): rate limiting, Modal endpoint auth, Sentry, active sidebar indicator
**Files touched**: 17 files — 5 process routes, 2 auth pages, pricing, dashboard, modal client, crypto client, faces, checkout, captions generate

## [2026-02-21] Carousel Multiply feature shipped
**Context**: Adding ability to create N unique copies of a captioned carousel
**Learnings**:
- `parent_job_id` column links multiply jobs to their source caption job
- Job type `carousel_multiply` with `MultiplySettings` (copy_count, source_job_id, slide_count)
- Modal worker downloads source slides from `outputs` bucket (not `images`), applies augment_image per slide per set
- ZIP preserves `set_XX/slide_XXX.jpg` folder structure
- Frontend sends clamped `Math.min(multiplyCount, maxCopies)` to avoid plan drift
- `setError(null)` must be called at start of async handlers to clear stale errors
- `variant_count` on caption jobs equals the slide count (number of photos with captions)
**Files touched**: 8 files — migration 013, types, modal client, job create, process-multiply API, modal worker, storyline-preview, captions page

## [2026-02-19] Payment flow fix + logo crop
**Context**: Pricing page was broken for logged-in users
**Learnings**:
- `/pricing` "Get Started" linked to `/signup?plan=X` even when authenticated — needed to POST to `/api/checkout` instead
- Logo icon had "CONTENT CLEANSE" text at bottom; cropped with Pillow `getbbox()` → `crop()`

## [2026-02-11] Faceswap feature added
**Context**: InsightFace-based face swapping for images and videos
**Learnings**:
- InsightFace old CDN is dead — use GitHub releases and HuggingFace mirrors
- buffalo_l zip has no subdirectory — must unzip into named folder
- Frame-by-frame video swap is slow — 15min timeout, 8GB RAM needed
- `faces` storage bucket with separate RLS policies

## [2026-02-09] Photo Captions feature added
**Context**: Multi-photo carousel with AI or manual captions
**Learnings**:
- Modal v1.3.2 uses `Image.add_local_dir/add_local_file`, NOT `modal.Mount`
- Separate `images` bucket from `videos` bucket
- Atomic quota with `try_consume_quota` RPC prevents race conditions

## [2026-02-08] Auth system working
**Context**: Supabase Auth setup
**Learnings**:
- Auth trigger on `auth.users` needs `GRANT ALL ON profiles TO supabase_auth_admin`
- Trigger needs exception handler so signup doesn't fail on profile creation errors
