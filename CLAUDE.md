# Creator Engine

SaaS platform for content uniquification — video variants, photo captions, face swap, carousel multiply. (Next.js 16 + Supabase + Modal.com + Vercel)

## Quick Start
```bash
npm install
npm run dev                                          # Frontend
modal deploy src/workers/process-video/main.py       # Modal worker
```

## Key Commands
| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `modal deploy src/workers/process-video/main.py` | Deploy all Modal endpoints |
| `git push origin main` | Deploy frontend (Vercel auto-deploy) |

## Project Structure
```
src/app/(dashboard)/     # captions/, faceswap/, dashboard/, library/, settings/
src/app/api/jobs/        # create, process-captions, process-multiply, process-faceswap
src/lib/supabase/        # client, server, types.ts (all DB types)
src/lib/crypto/plans.ts  # Plan config (quota, variantLimit, faceswapLimit)
src/lib/modal/client.ts  # Modal API client (trigger*Processing functions)
src/workers/process-video/main.py  # ALL Modal processing functions + endpoints
```

## Architecture
> Deep dive: [docs/architecture.md](docs/architecture.md)

- **Job lifecycle**: Create (API) → Trigger (API→Modal) → Progress (Realtime) → Download ZIP
- **Quota**: Atomic `try_consume_quota` RPC + `refund_quota` on failure
- **Plan enforcement**: Frontend limits → create route caps → process route re-validates
- **Payments**: NOWPayments crypto-only, 30-day access, auto-downgrade on expiry
- **Job types**: `video`, `photo_captions`, `faceswap`, `photo_clean`, `carousel_multiply`

## Environment & Services
> Details: [docs/environment.md](docs/environment.md) | [docs/mcp-config.md](docs/mcp-config.md)

- Supabase project: `vljbyrayyiwpymbuzedb`
- Production: `https://creatorengine.app` (Vercel, custom domain)
- `NEXT_PUBLIC_` vars baked at build time — redeploy after changes

## Design System
Dark cyberpunk theme. Primary: electric magenta. Accent: cyan. Background: deep black.

## Rules & Style
- All processing goes through Modal.com — never process in API routes
- Modal worker receives Supabase creds via request body (no Modal secrets)
- Storage buckets: `videos`, `outputs`, `watermarks`, `images`, `faces`
- New job types need: types.ts union + create route branch + process route + Modal function + Modal endpoint

## Gotchas (Top 5)
> Full list: [docs/gotchas.md](docs/gotchas.md)

- Realtime must be enabled per-table: `ALTER PUBLICATION supabase_realtime ADD TABLE tablename;`
- Modal image ordering: `add_local_*` AFTER `run_commands`
- `@modal.fastapi_endpoint` not `@modal.web_endpoint`
- Vercel env vars: use `echo -n` to avoid trailing newline corruption
- `NEXT_PUBLIC_` vars require redeploy — they're baked at build time

## DB Migrations
013 migrations applied (001–013). Apply via Supabase MCP `apply_migration`.

## Recent Decisions
> History: [docs/decisions/](docs/decisions/)

- [2026-02-21] Carousel multiply as separate job type with parent_job_id link

## Active Context
Rebranded Content Cleanse → Creator Engine (2026-02-21). Production hardening: security fixes, fetch timeouts, job status guards. Modal needs redeployment for new app name.

## Discovery Log
> Full log: [docs/discovery-log.md](docs/discovery-log.md)

- [2026-02-21] Rebrand to Creator Engine + production hardening (19 security/quality fixes)
