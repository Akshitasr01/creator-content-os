# Creator Content OS

AI-powered content repurposing for educators, coaches and professional creators.

> **Turn one long-form piece of content into a week of platform-specific content written in the creator's voice.**

Paste a transcript, article, script or notes → the app builds a **Content Brief** → suggests **content ideas** →
writes **Instagram Reel scripts, LinkedIn posts and carousel copy** in your voice → you review, edit, rewrite,
rate and copy everything in the **Content Studio**.

---

## Features (V1)

| Area | What it does |
|---|---|
| Auth | Email/password sign up & sign in (Supabase Auth), email-confirmation aware, protected routes, session persistence |
| Creator profile | One onboarding form: niche, audience, language (English/Hindi/Hinglish), tone, style, things to avoid, target platforms, 3 sample posts. Editable in **Settings**, plus per-platform length & CTA preferences |
| Projects | Title + source type (transcript/article/notes/script) + pasted text, length-validated, **saved before any AI call** |
| Analysis | Structured Content Brief (topic, audience, summary, key themes, examples, strong claims, hooks, angles). User can **edit/correct** it |
| Ideas | 10 standalone angles labelled with the platforms they fit; select the ones you want or let the app pick |
| Generation | Reels (hook, 30-60s spoken script, caption, CTA, hashtags), LinkedIn posts (strong first line, readable body, CTA), carousels (slide-by-slide copy) |
| Creator voice | Profile + sample posts + brief + idea + platform rules in every generation prompt |
| Content Studio | Grouped by platform, slide preview, copy (whole asset or per section), edit with explicit save, approve, **version history with restore** |
| Rewrite | Shorter · Stronger hook · More conversational · More professional · Simplify · More storytelling · Convert to Hinglish · Regenerate - affects only that asset |
| Feedback | 👍 / 👎 with a quick reason (too formal, too long, weak hook, sounds AI, not my voice, other) + optional note |
| Safety & cost | Backend-only API keys, token verification on every request, RLS, per-minute rate limit, daily AI-call limit, token/cost logging per user/project |
| Demo mode | `AI_PROVIDER=mock` gives free, clearly labelled **Demo output** so you can test everything without an API key |

Out of scope for V1 (per the build guide): video/YouTube ingestion, scheduling, teams, analytics, payments, vector memory.

## Tech stack

- **Frontend:** React 19 + Vite + Tailwind CSS v4 + React Router
- **Backend:** Python + FastAPI + Pydantic
- **Database & Auth:** Supabase (Postgres + Auth, Row Level Security)
- **AI:** OpenAI Responses API with structured outputs, behind one `llm_service` (or the free mock provider)

```
React (browser)  --Bearer token-->  FastAPI  --user's token-->  Supabase Postgres (RLS)
     |                                 |
     '-- Supabase Auth (login only)    '--> OpenAI API (or mock)
```

The browser uses Supabase **only for login**. All app data goes through FastAPI, which verifies the user's
token and queries Supabase **as that user**, so Row Level Security always applies. The service-role key is
never used.

## Folder structure

```
creator-content-os/
├── backend/
│   ├── main.py                 # FastAPI app, CORS, error handlers
│   ├── api/                    # HTTP routes only (thin)
│   │   ├── deps.py             #   auth (token verification), repository, LLM per request
│   │   ├── health.py  creators.py  projects.py  generate.py  content.py  feedback.py
│   ├── services/               # business logic
│   │   ├── llm_service.py      #   the ONLY place that calls an AI provider
│   │   ├── mock_provider.py    #   free demo output
│   │   ├── content_analyzer.py  idea_generator.py
│   │   ├── reel_generator.py  linkedin_generator.py  carousel_generator.py  rewriter.py
│   │   ├── project_service.py  content_service.py  profile_service.py  usage_service.py
│   ├── prompts/                # all prompt text (voice, analyzer, ideas, reel, linkedin, carousel, rewrite)
│   ├── schemas/                # Pydantic request/response + structured AI output models
│   ├── db/                     # Supabase REST client + repository (user-scoped queries)
│   ├── core/                   # settings + error types
│   ├── tests/                  # pytest (in-memory DB + mock AI)
│   ├── golden/inputs/          # 5 benchmark sources for prompt-quality checks
│   └── scripts/run_golden.py
├── frontend/src/
│   ├── pages/                  # Landing, Auth, Onboarding, Dashboard, NewProject, Project (brief+ideas), ContentStudio, Settings
│   ├── components/             # ui.jsx primitives, AppShell, RouteGuards, ProfileForm, project/*, studio/*
│   ├── context/  hooks/        # auth, profile, toast state
│   ├── services/api.js         # every backend call
│   └── lib/                    # supabase client, constants
└── supabase/migrations/        # versioned SQL
```

## Setup

### 1. Prerequisites
Python 3.12+, Node 20+, a Supabase project, and (optionally) an OpenAI API key.

### 2. Database (Supabase)
1. Supabase Dashboard → **SQL Editor** → **New query**.
2. Paste `supabase/migrations/001_v1_content_os.sql` → **Run**.
   It is additive and safe to re-run: it adds missing columns/tables (`feedback`, `platform_preferences`,
   `usage_events`) and owner-only RLS policies, and never drops anything.
3. **Authentication → Providers → Email** must be enabled. If "Confirm email" is on, new users must click the
   email link before signing in (the app handles this, including a "Resend link" button).
4. **Authentication → URL Configuration**: add `http://localhost:5173` to the Redirect URLs.

### 3. Backend
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env          # then fill in the values
uvicorn main:app --reload
```
API: http://127.0.0.1:8000 · Interactive docs: **http://127.0.0.1:8000/docs**

### 4. Frontend
```powershell
cd frontend
npm install
copy .env.example .env.local    # then fill in the values
npm run dev
```
App: http://localhost:5173

### Environment variables

| File | Variable | Purpose |
|---|---|---|
| backend/.env | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Verify users and query the DB as them |
| backend/.env | `AI_PROVIDER` | `mock` (free demo) or `openai` |
| backend/.env | `OPENAI_API_KEY`, `OPENAI_MODEL` | Required when `AI_PROVIDER=openai` |
| backend/.env | `DAILY_AI_CALL_LIMIT`, `AI_REQUESTS_PER_MINUTE`, `SOURCE_MIN_CHARS`, `SOURCE_MAX_CHARS`, `MAX_ASSETS_PER_REQUEST` | Free-beta limits |
| backend/.env | `OPENAI_INPUT_COST_PER_1M`, `OPENAI_OUTPUT_COST_PER_1M` | Optional, for cost estimates |
| backend/.env | `CORS_ORIGINS` | Allowed frontend origins |
| frontend/.env.local | `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Public browser config |

Never put secret keys in `frontend/.env.local` - everything there ends up in the browser.

### Switching between demo and real AI
In `backend/.env` set `AI_PROVIDER=mock` (free) or `AI_PROVIDER=openai` (uses credits) and restart uvicorn.
Demo assets show an amber **Demo output** badge and are stored with `provider = mock`.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Service status + active AI provider |
| GET / PUT | `/creator-profile` | Load / create-or-update profile (+ platform preferences) |
| GET | `/usage` | Today's AI calls vs the daily limit |
| POST / GET | `/projects` | Create (saved as `draft`) / list with asset counts |
| GET | `/projects/{id}` | Project + all generated content |
| PUT | `/projects/{id}/analysis` | Save user corrections to the brief |
| POST | `/projects/{id}/analyze` | Create the Content Brief |
| POST | `/projects/{id}/ideas` | Add 10 content ideas |
| POST | `/projects/{id}/generate` | `{"outputs":[{"type":"reel","count":3},…],"idea_indexes":[…]}` |
| PATCH | `/content/{id}` | Edit content (old version kept) and/or set status |
| POST | `/content/{id}/rewrite` | `{"instruction":"stronger_hook"}` |
| POST | `/content/{id}/feedback` | `{"rating":"down","reason":"weak_hook","note":"…"}` |

All routes except `/health` need `Authorization: Bearer <Supabase access token>`.
Project status: `draft → analyzing → analyzed → generating → ready`, or `failed` with `error_message`.

## Testing

```powershell
cd backend
.venv\Scripts\activate
pytest                          # unit, pipeline, security & limit tests (no network, no cost)
python scripts/run_golden.py    # benchmark inputs -> golden/outputs/<timestamp>/ (uses AI_PROVIDER)

cd ..\frontend
npm run lint
npm run build
```

`run_golden.py` with `AI_PROVIDER=openai` makes 25 AI calls - run it after prompt or model changes and compare outputs.

## Known limitations

- Generation is synchronous (the request waits, up to ~1 min for 6 assets). Background jobs are a V2 item.
- The per-minute rate limiter is in memory (per backend process); the daily limit is stored in the database.
- Token cost is only estimated if you set the per-1M-token prices.
- Only pasted text input; no file upload, YouTube or audio yet (V2).
- Feedback is collected but not yet used to adapt generation (by design: collect data first).
- Production deployment (Vercel + Render/Railway) is not set up yet; set `CORS_ORIGINS` to your real domain when deploying.
