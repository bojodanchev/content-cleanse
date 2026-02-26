# Gotchas & Lessons Learned

## Supabase
- **Realtime must be enabled per-table**: `ALTER PUBLICATION supabase_realtime ADD TABLE tablename;` — without this, `postgres_changes` subscriptions receive NO updates
- **Auth trigger needs GRANT**: Trigger on `auth.users` needs `GRANT ALL ON profiles TO supabase_auth_admin`
- **Auth trigger needs exception handler**: Wrap in BEGIN/EXCEPTION so signup doesn't fail if profile creation errors
- **File size limit**: 50MB per file on Supabase free tier

## Modal.com
- **`@modal.fastapi_endpoint`** not deprecated `@modal.web_endpoint`
- **FastAPI must be pip_installed** explicitly in the container image
- **`Image.add_local_dir/add_local_file`** (Modal v1.3.2+), NOT `modal.Mount`
- **Image build ordering**: `add_local_*` must come AFTER `run_commands` (or use `copy=True`)
- **Worker receives Supabase credentials via request body** — no Modal secrets needed

## Modal Model Downloads (Faceswap)
- **buffalo_l**: GitHub releases `https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip` — zip has NO subdirectory, must unzip into `buffalo_l/` folder
- **inswapper_128**: HuggingFace `https://huggingface.co/ezioruan/inswapper_128.onnx/resolve/main/inswapper_128.onnx` — facefusion-assets repo 404'd
- **GFPGANv1.4**: `https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth`
- **InsightFace old CDN dead**: `insightface-data.oss-cn-beijing.aliyuncs.com` returns 404, `storage.insightface.ai` DNS fails

## Vercel
- **Env var newlines**: Use `echo -n 'value' > /tmp/file && vercel env add NAME production < /tmp/file` to avoid trailing `\n` corruption
- **`NEXT_PUBLIC_` vars are baked at build time**: Must redeploy after changing them
- **`vercel env rm` with `yes |`**: Loops forever — use `echo y |` instead

## Supabase Storage
- **Filenames with emojis/special chars**: Supabase Storage rejects keys containing emojis, apostrophes, and non-ASCII characters with "Invalid key" error. Use `sanitizeFilename()` from `@/lib/sanitize-filename` on all uploads.

## Next.js / React
- **Radix UI DropdownMenuItem with `asChild` + `<form>`**: Doesn't work — dropdown closes before form submits
- **Logo icon cropping**: Pillow `getbbox()` → `crop()` for tight transparent padding trim
- **react-simple-maps + React 19**: Peer dep conflict — needs `.npmrc` with `legacy-peer-deps=true` for Vercel builds
- **`loading="lazy"` invalid on `<video>`**: Build error — only valid on `<img>` and `<iframe>`. Use `preload="none"` instead
- **Next.js 16 async params**: Dynamic route handlers must use `params: Promise<{ id: string }>` and `await params` — old `{ id: string }` causes type error
- **Fixed aspect ratio clips tall content**: `aspect-[16/10]` + `overflow-hidden` clips portrait (9:16) video grids. Remove aspect constraint, let content flow

## Payments
- **NOWPayments IPN verification**: Sort payload keys alphabetically, JSON.stringify, HMAC-SHA512 with IPN secret, timingSafeEqual comparison
- **order_id format**: `{userId}__{plan}__{timestamp}__{affiliateCode}` — parsed in webhook; affiliate code sanitized to prevent `__` delimiter injection
- **Stripe was replaced** by Coinbase Commerce, then by NOWPayments. CLAUDE.md references to Stripe are outdated.

## Security (Production Hardening 2026-02-21)
- **Open redirect on login**: `redirect` query param must start with `/` and not `//` — prevents attacker-crafted login links
- **File path ownership**: All API routes that accept file paths must verify `filePath.startsWith(\`${user.id}/\`)` to prevent cross-user file access
- **Job status guard**: All process routes must check `job.status !== 'pending'` to prevent reprocessing (quota drain attack)
- **Quota refund in catch**: All process routes must refund quota in catch blocks if quota was consumed before the error
- **Fetch timeouts**: All external API calls (Modal, NOWPayments) use AbortController with timeouts (30s Modal, 15s NOWPayments)
- **video.play() returns Promise**: Must `.catch(() => {})` to avoid unhandled rejection on hover play
- **Niche length cap**: AI caption generation limits niche input to 100 chars to mitigate prompt injection
- **User email null check**: Checkout route must verify `user.email` exists before passing to NOWPayments
