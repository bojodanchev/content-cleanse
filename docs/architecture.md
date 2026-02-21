# Architecture

## Tech Stack
- **Frontend**: Next.js 16 (App Router) + Tailwind CSS 4 + shadcn/ui
- **Backend**: Supabase (Postgres, Auth, Storage, Realtime)
- **Processing**: Modal.com (serverless Python containers — FFmpeg, Pillow, InsightFace)
- **Payments**: NOWPayments (crypto-only, 30-day access per payment)
- **AI**: OpenAI GPT-4o-mini (caption generation), InsightFace + GFPGAN (faceswap)
- **Hosting**: Vercel

## Directory Structure
```
src/
├── app/
│   ├── (marketing)/          # Public landing + pricing pages
│   ├── (auth)/               # Login/signup
│   ├── (dashboard)/          # Protected app
│   │   ├── dashboard/        # Video uniquification
│   │   ├── captions/         # Photo captions + carousel multiply
│   │   ├── faceswap/         # Face swap wizard
│   │   ├── library/          # Job history
│   │   └── settings/         # Account, billing, notifications
│   └── api/
│       ├── jobs/             # create, process-*, process-multiply
│       ├── captions/         # AI generation
│       ├── faces/            # Face CRUD
│       ├── checkout/         # NOWPayments invoice creation
│       └── webhooks/         # NOWPayments IPN
├── components/
│   ├── ui/                   # shadcn base components
│   ├── upload/               # Dropzone, progress tracker
│   ├── captions/             # Caption editor, settings, storyline preview
│   ├── dashboard/            # Sidebar, stats
│   └── marketing/            # Landing page sections
├── lib/
│   ├── supabase/             # Client, server, types
│   ├── crypto/               # NOWPayments plans config
│   └── modal/                # Modal.com API client
└── workers/
    └── process-video/        # Modal Python worker + helpers
        ├── main.py           # All endpoints + processing functions
        ├── image_augmenter.py # Brightness/saturation/tint augmentation
        ├── text_renderer.py  # Pillow caption rendering
        ├── face_swapper.py   # InsightFace pipeline
        └── fonts/            # Anton-Regular.ttf
```

## Database Schema (Supabase)
| Table | Purpose |
|-------|---------|
| `profiles` | User profile, plan, quota, plan_expires_at |
| `jobs` | Processing jobs (video, photo_captions, faceswap, carousel_multiply) |
| `variants` | Individual output files per job |
| `watermarks` | User-uploaded watermark images |
| `payments` | NOWPayments transaction records |
| `affiliates` | Affiliate program codes |
| `referrals` | Affiliate referral tracking |
| `commissions` | Affiliate commission records |
| `faces` | Saved face profiles for faceswap |
| `events` | Analytics events |
| `api_usage` | API usage tracking (Agency plan) |

**Migrations**: 001–013 in `supabase/migrations/`

## Key Patterns
- **Job lifecycle**: Create job (API) → Trigger processing (API → Modal) → Progress via Realtime → Download ZIP
- **Quota**: Atomic `try_consume_quota` RPC prevents race conditions; `refund_quota` on failure
- **Plan enforcement**: Triple-layer — frontend limits UI, create route caps values, process route re-validates
- **Modal worker**: Receives Supabase credentials in request body (no Modal secrets needed)
- **Storage buckets**: `videos`, `outputs`, `watermarks`, `images`, `faces` (all private with RLS)
- **Realtime**: Enabled on `jobs`, `payments`, `commissions` tables

## Processing Features
| Feature | Route | Job Type | Modal Endpoint |
|---------|-------|----------|----------------|
| Video uniquification | /dashboard | `video` | `start-processing` |
| Photo captions | /captions | `photo_captions` | `start-caption-processing` |
| Photo cleaning | /captions | `photo_clean` | `start-image-processing` |
| Face swap | /faceswap | `faceswap` | `start-faceswap-processing` |
| Carousel multiply | /captions | `carousel_multiply` | `start-multiply-processing` |

## Important Files
- `src/lib/supabase/types.ts` — All TypeScript types (JobType, settings interfaces)
- `src/lib/crypto/plans.ts` — Plan config (quota, variantLimit, faceswapLimit)
- `src/workers/process-video/main.py` — All Modal processing functions + endpoints
- `src/app/api/jobs/create/route.ts` — Job creation with plan enforcement
- `src/app/(dashboard)/captions/page.tsx` — Captions + multiply UI (largest frontend file)

## Design System
**Theme**: Dark cyberpunk — electric magenta primary, cyan accent, deep black background

**CSS Variables** (globals.css):
- `--primary`: Electric Magenta (318 100% 60%)
- `--accent`: Electric Cyan (185 100% 50%)
- `--background`: Deep black (0 0% 4%)

**Custom utilities**: `.glow-magenta`, `.glow-cyan`, `.gradient-text`, `.glass`, `.grid-pattern`, `.noise-overlay`
