# Content Cleanse - Video Uniquification Platform

## Project Overview

Content Cleanse is a SaaS platform that transforms single videos into multiple unique variants using FFmpeg transformations and AI watermark removal. It targets OFM (OnlyFans Management) agencies who need to reupload content across multiple accounts without platform duplicate detection.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS 4 + shadcn/ui
- **Backend**: Supabase (Postgres, Auth, Storage, Realtime)
- **Processing**: Modal.com (serverless FFmpeg containers)
- **Payments**: Stripe (subscriptions)
- **AI**: Replicate API (watermark inpainting)
- **Hosting**: Vercel

## Project Structure

```
src/
├── app/
│   ├── (marketing)/     # Public landing pages
│   ├── (auth)/          # Login/signup
│   ├── (dashboard)/     # Protected app (dashboard, library, settings)
│   └── api/             # API routes (webhooks, jobs, auth)
├── components/
│   ├── ui/              # shadcn components
│   ├── upload/          # Dropzone, settings, progress
│   ├── dashboard/       # Dashboard-specific components
│   └── marketing/       # Landing page components
├── lib/
│   ├── supabase/        # Database client & types
│   ├── stripe/          # Payment integration
│   ├── ffmpeg/          # FFmpeg command builders
│   └── modal/           # Modal.com API client
└── workers/
    └── process-video/   # Modal Python worker
```

## Key Files

- `src/lib/supabase/types.ts` - Database TypeScript types
- `src/lib/stripe/plans.ts` - Pricing plans configuration
- `src/workers/process-video/main.py` - FFmpeg processing worker
- `supabase/migrations/001_initial_schema.sql` - Database schema

## Design System

**Theme**: Dark cyberpunk with electric magenta (#FF00FF variant) and cyan (#00FFFF variant) accents

**CSS Variables** (in globals.css):
- `--primary`: Electric Magenta (318 100% 60%)
- `--accent`: Electric Cyan (185 100% 50%)
- `--background`: Deep black (0 0% 4%)

**Custom Utilities**:
- `.glow-magenta` / `.glow-cyan` - Box shadow glows
- `.gradient-text` - Gradient text effect
- `.glass` - Glassmorphism
- `.grid-pattern` - Background grid
- `.noise-overlay` - Subtle noise texture

## Database Schema

- `profiles` - User profiles with plan, quota, Stripe IDs
- `jobs` - Processing jobs with status, settings, progress
- `variants` - Individual video variants with transformations
- `watermarks` - User-uploaded watermark images
- `events` - Analytics events
- `api_usage` - API usage tracking (Agency plan)

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `MODAL_TOKEN_ID`
- `MODAL_TOKEN_SECRET`
- `REPLICATE_API_TOKEN`

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Run Supabase locally
supabase start

# Deploy Modal worker
modal deploy src/workers/process-video/main.py

# Run Modal worker locally
modal run src/workers/process-video/main.py
```

## Pricing Plans

| Plan | Price | Videos/mo | Variants | Watermark Removal |
|------|-------|-----------|----------|-------------------|
| Free | $0 | 5 | 10 | No |
| Pro | $99 | 100 | 100 | Yes |
| Agency | $249 | Unlimited | 100 | Yes + API |

## FFmpeg Transformations

Each variant gets randomized:
- Brightness: ±3%
- Saturation: ±3%
- Hue: ±5°
- Crop: 1-3px from edges
- Speed: 0.98x-1.02x
- Metadata: Completely stripped

## Notes

- Job progress updates via Supabase Realtime subscriptions
- Files stored in Supabase Storage buckets: `videos`, `outputs`, `watermarks`
- Modal.com worker has 10-minute timeout, 4GB RAM
- Stripe webhooks handle subscription lifecycle
