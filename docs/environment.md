# Environment

## Prerequisites
- Node.js 20+
- Python 3.11 (for Modal worker)
- Modal CLI (`pip install modal`)
- Supabase CLI (optional, for local dev)

## Setup
```bash
npm install
cp .env.example .env.local  # Fill in values
npm run dev
```

## Commands
| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `modal deploy src/workers/process-video/main.py` | Deploy Modal worker |
| `modal run src/workers/process-video/main.py` | Run Modal worker locally |
| `supabase start` | Local Supabase (optional) |

## Environment Variables (Vercel Production)
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `MODAL_TOKEN_ID` | Modal.com auth |
| `MODAL_TOKEN_SECRET` | Modal.com auth |
| `MODAL_ENDPOINT_URL` | Base Modal endpoint (video processing) |
| `NOWPAYMENTS_API_KEY` | NOWPayments API key |
| `NOWPAYMENTS_IPN_SECRET` | NOWPayments IPN webhook secret |
| `NEXT_PUBLIC_APP_URL` | `https://creatorengine.app` |
| `OPENAI_API_KEY` | OpenAI for AI caption generation |

## External Services
| Service | Purpose | Dashboard |
|---------|---------|-----------|
| **Supabase** (vljbyrayyiwpymbuzedb) | DB, Auth, Storage, Realtime | supabase.com/dashboard |
| **Modal.com** | Serverless processing containers | modal.com/apps |
| **Vercel** | Frontend hosting + API routes | vercel.com/dashboard |
| **NOWPayments** | Crypto payment processing | nowpayments.io |
| **OpenAI** | GPT-4o-mini for caption AI | platform.openai.com |

## Deployment
| Component | How to deploy |
|-----------|---------------|
| Frontend + API | `git push origin main` → Vercel auto-deploy |
| Modal worker | `modal deploy src/workers/process-video/main.py` |
| DB migrations | Supabase MCP `apply_migration` or SQL editor |

## Modal Endpoints (Production)
> **NOTE**: App renamed to `creator-engine` in code. After `modal deploy`, URLs will change to `creator-engine-*`. Until then, old URLs still work:
- Video: `https://bojodanchev--content-cleanse-start-processing.modal.run`
- Captions: `https://bojodanchev--content-cleanse-start-caption-processing.modal.run`
- Image cleaning: `https://bojodanchev--content-cleanse-start-image-processing.modal.run`
- Faceswap: `https://bojodanchev--content-cleanse-start-faceswap-processing.modal.run`
- Multiply: `https://bojodanchev--content-cleanse-start-multiply-processing.modal.run`
