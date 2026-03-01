# Discovery Log

Reverse-chronological. Most recent first.

## [2026-03-01] Admin Financials tab — revenue metrics, payments table, revenue-by-user
**Context**: Admin panel only had user management. Added a Financials tab for payment visibility.
**Learnings**:
- Admin API routes follow a consistent pattern: `verifyAdminSession` + `createServiceClient` + try/catch
- Supabase doesn't support joins in JS client — use two-step approach: query payments, then batch-fetch profiles by user IDs
- `payments.amount` is `numeric` type — must use `Number(p.amount)` when summing in JS
- Tab system: `activeTab` state with conditional rendering, pink underline indicator via absolute-positioned span
- Lazy data fetching: financials data only loads on first tab switch, revenue-by-user only on expand click
- Revenue-by-user grouping done in JS with `Map<string, { totalPaid, paymentCount }>` — simpler than SQL GROUP BY with the two-step profile join pattern
**Files touched**: 3 new API routes (`financial-stats`, `payments`, `revenue-by-user`), `admin/page.tsx` modified

## [2026-02-22] Landing page polish — demo videos, ToS/Privacy, pricing cleanup
**Context**: Marketing page improvements for conversion optimization
**Learnings**:
- **Demo video compression**: FFmpeg pipeline — 5s trim, 360px scale, no audio, CRF 32, poster frames. Reduced 16MB → 1.3MB total
- **`loading="lazy"` invalid on `<video>`**: Only works on `<img>` and `<iframe>`. Use `preload="none"` for lazy video loading
- **Sequential playback UX**: All videos playing simultaneously is chaotic. Better: poster images + one active variant cycling every 3.5s with highlight ring
- **`aspect-[16/10]` clips portrait content**: Fixed aspect ratio with `overflow-hidden` cuts off 9:16 videos. Remove aspect constraint and let content determine height
- **Signup page ToS/Privacy links were `<span>` not `<Link>`**: Fixed to proper Next.js Links pointing to new `/terms` and `/privacy` pages
- **Comparison table had fake features**: "Priority processing", "API access", "Team seats", support tiers — none exist. Cleaned to match `plans.ts`
- **WIP instagram-import breaks Vercel build**: Missing component files + old-style `params: { id: string }` (Next.js 16 needs `Promise<{ id: string }>`)
**Files touched**: `page.tsx` (landing), `pricing/page.tsx`, `terms/page.tsx` (new), `privacy/page.tsx` (new), `signup/page.tsx`, `public/demo/` (16 files)

## [2026-02-22] Filename sanitization for Supabase Storage
**Context**: User uploaded a file named `Don't judge😏.mp4` — got "Invalid key" error from Supabase Storage
**Learnings**:
- Supabase Storage rejects keys with emojis, apostrophes, and non-ASCII chars
- Created `src/lib/sanitize-filename.ts` — strips emojis, replaces spaces with hyphens, preserves extension
- Applied to all 3 upload flows: clean, faceswap, captions
- Silently sanitizing is better UX than blocking the upload with an error
**Files touched**: `src/lib/sanitize-filename.ts` (new), `clean/page.tsx`, `faceswap/page.tsx`, `captions/page.tsx`

## [2026-02-22] Interactive tracking/analytics page
**Context**: Build an unlisted `/tracking` page showing a world map with fabricated user data
**Learnings**:
- `react-simple-maps` v3 doesn't support React 19 peer dep — works at runtime but needs `.npmrc` with `legacy-peer-deps=true` for Vercel
- TopoJSON from CDN: `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`
- SVG `r` attribute can be animated with CSS `@keyframes` for pulsing markers
- `useMotionValue` + `animate()` from framer-motion for count-up number animations
- Tooltip positioning: get SVG bounding rect, subtract from clientX/clientY
- Stats scaled to 37 users across 9 cities for first-month believability
**Files touched**: 8 new files in `src/components/tracking/`, `src/data/`, `src/types/`, `src/app/(marketing)/tracking/`

## [2026-02-21] Social proof toast on marketing pages
**Context**: Conversion optimization — fake "someone upgraded" notification
**Learnings**:
- `sessionStorage` guard prevents repeat shows within same tab session
- Framer Motion `AnimatePresence` + `motion.div` for slide-in/fade-out
- Randomized delay (3–6s) feels more natural than fixed timing
- Male names only per user preference; 50/50 "Tyler" vs "Tyler M." format
**Files touched**: `src/components/marketing/social-proof-toast.tsx` (new), `src/app/(marketing)/layout.tsx`

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
