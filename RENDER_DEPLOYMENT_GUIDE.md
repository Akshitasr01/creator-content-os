# Deploying Creator Content OS on Render (free plans)

Two Render services, Supabase unchanged:

```
Browser ──> Render Static Site  "creator-content-os-web"  (React/Vite build in frontend/dist)
   │  login only
   ├──────> Supabase Auth
   │  Bearer token
   └──────> Render Web Service "creator-content-os-api"   (FastAPI in backend/)
               ├─> Supabase Postgres (user's token → Row Level Security)
               ├─> Supabase Storage "video-clips" (rendered MP4s)
               └─> OpenAI / YouTube APIs (keys only on the backend)
```

Everything is described in [`render.yaml`](render.yaml) (a Render *Blueprint*), so Render can create both
services for you. Manual settings are listed too in case you prefer to click through the dashboard.

> Prices and limits below are from Render's documentation as I last knew it. Check
> <https://render.com/pricing> and <https://render.com/docs/free> before relying on them.

---

## 1. Before you start

1. All code is pushed to GitHub (`Akshitasr01/creator-content-os`, branch `main`).
2. You can sign in to <https://dashboard.render.com> with GitHub. **No payment method is needed for free services. Don't add one.**
3. Supabase migrations `001`–`003` are applied (they already are).
4. Have these values ready (from `backend/.env`, `frontend/.env.local`, Supabase and OpenAI). Don't paste them into chats or commits.

---

## 2. Deploy with the Blueprint (recommended)

1. Render dashboard → **New → Blueprint**.
2. Connect the GitHub repo `creator-content-os` and pick branch `main`. Render finds `render.yaml`.
3. Render lists two services: `creator-content-os-api` (Web Service, **Free**) and
   `creator-content-os-web` (Static Site, free). Check that the plan says **Free**.
4. Render asks for every `sync: false` variable. Fill them using the table in section 4.
   On the first pass you don't know the final URLs yet. Use these placeholders and fix them in step 6:
   - `CORS_ORIGINS` = `https://creator-content-os-web.onrender.com`
   - `VITE_API_BASE_URL` = `https://creator-content-os-api.onrender.com`
5. Click **Apply**. Both services build. The backend takes several minutes because the speech-to-text packages are large.
6. Open each service and copy its real URL (top of the service page). If Render added a suffix
   (for example `creator-content-os-api-abcd.onrender.com`), update:
   - backend → Environment → `CORS_ORIGINS` = the **static site** URL, then **Save, rebuild and deploy**.
   - static site → Environment → `VITE_API_BASE_URL` = the **backend** URL, then **Save, rebuild and deploy**.
     Vite bakes this value in at build time, so the site must be rebuilt after changing it.
7. Do section 5 (Supabase and Google settings), then run the checklist in section 7.

## 3. Manual setup (same result, without the Blueprint)

**Backend: New → Web Service → connect repo**

| Setting | Value |
|---|---|
| Name | `creator-content-os-api` |
| Language / Runtime | Python 3 |
| Branch | `main` |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1` |
| Instance Type | **Free** |
| Health Check Path (Advanced) | `/health` |
| Environment | backend variables from section 4, plus `PYTHON_VERSION=3.13.0` |

Keep `--workers 1`. The video job queue lives inside the process.

**Frontend: New → Static Site → connect repo**

| Setting | Value |
|---|---|
| Name | `creator-content-os-web` |
| Branch | `main` |
| Root Directory | `frontend` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |
| Environment | `NODE_VERSION=22` plus the three `VITE_` variables |
| Redirects/Rewrites tab | Source `/*` → Destination `/index.html` → Action **Rewrite** |

The rewrite rule makes refreshing `/dashboard`, `/projects/…` or `/videos/…` work instead of returning a 404.

---

## 4. Environment variables

### Backend (Web Service → Environment)

| Variable | Secret? | Value / where to get it |
|---|---|---|
| `SUPABASE_URL` | No | Supabase → Project Settings → API → Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | No (public by design) | Supabase → Project Settings → API Keys → **publishable** key. **Never the service-role / secret key.** |
| `AI_PROVIDER` | No | `mock` (free demo output) first; `openai` once you've set an OpenAI spending limit |
| `OPENAI_API_KEY` | **Yes** | platform.openai.com → API keys. Only needed when `AI_PROVIDER=openai` |
| `OPENAI_MODEL` | No | A model id from platform.openai.com/docs/models that supports structured outputs |
| `CORS_ORIGINS` | No | The static site URL, e.g. `https://creator-content-os-web.onrender.com` (exact, no trailing slash; comma-separate several) |
| `YOUTUBE_API_KEY` | **Yes** | Optional. Google Cloud → APIs & Services → Credentials (YouTube Data API v3) |
| `GOOGLE_OAUTH_CLIENT_ID` | No (public) | Optional. OAuth **Client ID** for "Sign in with Google" captions |
| `PYTHON_VERSION` | No | `3.13.0` (set by the Blueprint) |
| `DAILY_AI_CALL_LIMIT` | No | `30` (set by the Blueprint). Real AI calls per user per day |
| `WHISPER_MODEL` | No | `tiny` (set by the Blueprint). Smallest speech model, to fit 512 MB RAM |
| `VIDEO_MAX_DURATION_MINUTES` | No | `10` (set by the Blueprint) |
| `VIDEO_MAX_UPLOAD_MB` / `VIDEO_MAX_URL_DOWNLOAD_MB` | No | `200` (set by the Blueprint) |

Optional, with defaults in code: `OPENAI_TIMEOUT_SECONDS` (90), `OPENAI_INPUT_COST_PER_1M` / `OPENAI_OUTPUT_COST_PER_1M` (0),
`AI_REQUESTS_PER_MINUTE` (10), `SOURCE_MIN_CHARS` (200), `SOURCE_MAX_CHARS` (30000), `MAX_ASSETS_PER_REQUEST` (8),
`WHISPER_COMPUTE_TYPE` (int8), `VIDEO_FRAME_MODE` (fit), `VIDEO_STORAGE_BUCKET` (video-clips), `CLIP_MIN_SECONDS` (15),
`CLIP_MAX_SECONDS` (90), `FFMPEG_PATH` / `FFPROBE_PATH` (auto-detected), `VIDEO_MEDIA_DIR` (temporary folder inside the service).

### Frontend (Static Site → Environment). All values here are public.

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | Backend URL, e.g. `https://creator-content-os-api.onrender.com` (no trailing slash) |
| `VITE_SUPABASE_URL` | Same as backend `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same publishable key as the backend |
| `NODE_VERSION` | `22` |

**Never** put `OPENAI_API_KEY`, `YOUTUBE_API_KEY` or any Supabase secret/service-role key in a `VITE_` variable.
Everything starting with `VITE_` ends up in the public JavaScript.

The production build **stops with an error** if any of the three `VITE_` values is missing, or if
`VITE_API_BASE_URL` points to localhost on Render (see `frontend/vite.config.js`).

---

## 5. Settings outside Render (required)

**Supabase → Authentication → URL Configuration**
- **Site URL**: `https://<your-static-site>.onrender.com`
- **Redirect URLs**: add `https://<your-static-site>.onrender.com/**`.
  Keep `http://localhost:5173/**` for local development.
  Without this, confirmation emails link to localhost.

**Supabase → Authentication → Emails / SMTP**
- Supabase's built-in email sender only sends a few emails per hour, which is fine for testing but not for public sign-ups.
  For real users, configure **Custom SMTP** (many providers have a free tier).

**Google Cloud Console** (only if you use "Sign in with Google" for YouTube captions)
- OAuth Client → **Authorized JavaScript origins**: add `https://<your-static-site>.onrender.com`.

**OpenAI** (before setting `AI_PROVIDER=openai`)
- platform.openai.com → Settings → Limits: set a **monthly budget**. Sign-up is public, and each new
  user gets their own daily allowance (`DAILY_AI_CALL_LIMIT`).

---

## 6. CORS and frontend–backend connection

- The frontend sends every API call to `VITE_API_BASE_URL` (`frontend/src/lib/apiBase.js`) with the
  user's Supabase token in the `Authorization` header. No cookies are used.
- The backend allows only the origins listed in `CORS_ORIGINS` (`backend/core/config.py`).
  The value must match the browser's address bar exactly: `https`, no trailing slash, no path.
- Change either URL → update the other service's variable → redeploy that service.

---

## 7. Post-deployment checklist

Tick each item only after trying it on the live site.

- [ ] `https://<api>.onrender.com/health` returns `{"status":"ok", …, "supabase_configured": true}`
- [ ] `https://<api>.onrender.com/projects` (no login) returns **401**, not data
- [ ] Static site loads; refreshing `/login` and `/dashboard` doesn't show a 404
- [ ] Browser DevTools → Network: API calls go to the `onrender.com` backend, not `127.0.0.1`
- [ ] Sign up → confirmation email arrives → link opens the **Render** site (not localhost) → sign in works
- [ ] Sign out, sign in again; reloading the page keeps you signed in
- [ ] Onboarding saves a creator profile; Settings shows it
- [ ] New text project → Analyze → Ideas → Generate → Content Studio edit, rewrite, approve, history
- [ ] Second test account can't see the first account's projects (open a project URL from account A while signed in as B → "not found")
- [ ] With `AI_PROVIDER=mock`: outputs show "Demo output". Switch to `openai` only after the budget is set, then generate once
- [ ] `/create` → YouTube link → validate → paste a transcript → clip suggestions appear
- [ ] Video upload / direct link (see section 9 for what to expect on the free plan)
- [ ] DevTools → Sources: search the JS for `sk-`. Nothing should be found

---

## 8. Common errors

| Symptom | Cause | Fix |
|---|---|---|
| Static site build: `Missing environment variable(s) for the production build` | A `VITE_` variable isn't set | Add it under Static Site → Environment, then redeploy |
| Build: `VITE_API_BASE_URL points to localhost` | Copied the local value | Use the backend's `https://….onrender.com` URL |
| Browser console: `blocked by CORS policy` | `CORS_ORIGINS` doesn't exactly match the site URL | Fix the backend variable (no trailing slash), redeploy backend |
| Every API call returns 401 "session expired" | Frontend and backend point at different Supabase projects/keys | Make `SUPABASE_URL`/key identical on both services |
| 404 when refreshing a page | Missing rewrite rule | Static Site → Redirects/Rewrites: `/*` → `/index.html`, Rewrite |
| First request takes ~1 minute | Free backend was asleep (spins down after 15 min idle) | Expected on the free plan; the request completes once it wakes |
| Confirmation email links to localhost | Supabase Site URL / Redirect URLs | Section 5 |
| "Server setup incomplete: FFmpeg is not installed" on video pages | FFmpeg isn't available in Render's Python runtime | See section 9 (text and YouTube-transcript features still work) |
| Backend restarts with "Ran out of memory" in Render events | Video transcription/rendering exceeded 512 MB | Use shorter videos; `WHISPER_MODEL=tiny`; or a paid instance |
| Build fails installing packages | Wrong Python version | Ensure `PYTHON_VERSION=3.13.0` |
| Video job shows "interrupted (the server restarted)" | Instance slept/redeployed mid-job | Click **Retry**; keep the page open while processing |

Logs: each service → **Logs** tab. Events (deploys, restarts, out-of-memory): **Events** tab.
Roll back: service → **Events** → choose an earlier successful deploy → **Rollback**.

---

## 9. Free-plan limitations and possible costs

**What works well on the free plan**
- Sign-up/login, profiles, text projects (brief, ideas, Reels/LinkedIn/carousel generation), Content Studio,
  YouTube links with pasted transcripts or captions, clip *suggestions*. These need little CPU or memory.

**What is limited**
| Limitation (free Web Service) | Effect on this app |
|---|---|
| Sleeps after ~15 min without traffic; ~1 min to wake | The first visit after a quiet period is slow. A video job can be cut off if nobody has the page open (the app detects this and offers Retry) |
| 512 MB RAM, 0.1 CPU | Speech-to-text and MP4 rendering are **very slow** and may run out of memory on longer videos. Limits are set to 10-minute videos and the `tiny` speech model |
| Temporary disk (wiped on every restart/deploy) | Uploaded **source** videos disappear after a restart, so re-rendering later needs the file attached again. **Rendered clips are safe** (stored in Supabase Storage) and all project data is in Supabase |
| FFmpeg availability in the native Python runtime is not guaranteed | If missing, the app shows "Server setup incomplete" on upload pages and disables rendering. Text features are unaffected. The fix is switching the backend to Render's Docker runtime with FFmpeg installed (still free; ask before changing) |
| Maximum upload size through Render | Not verified. Very large uploads may be rejected; the app limit is set to 200 MB |
| Monthly free instance hours / bandwidth / build minutes | Enough for a demo; heavy use can exceed them. Render then suspends free services rather than charging, unless you add a payment method and upgrade |

**Things that can cost money**
- **OpenAI**: every real generation (`AI_PROVIDER=openai`). Set a budget.
- **Render upgrades** (only if you choose them): a paid instance with more RAM/CPU, persistent disks, extra bandwidth.
- **Supabase**: free plan has 500 MB database, 1 GB storage (rendered clips count), and an email limit.
- **YouTube Data API**: free daily quota; no charge unless you request more.

---

## 10. Updating the live site

- **Code changes**: commit and push to `main` → Render redeploys both services automatically
  (turn off with service → Settings → Auto-Deploy if you prefer manual deploys).
- **Environment variables**: change in the dashboard → *Save, rebuild and deploy*. Frontend `VITE_` changes always need a rebuild.
- **Database changes**: add a new numbered, additive SQL file in `supabase/migrations/` and run it in the
  Supabase SQL Editor **before** deploying code that needs it. Never edit or drop existing tables in production.
- **Rollback**: service → Events → previous deploy → Rollback.
