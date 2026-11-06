# Creator Content OS - notes for Claude Code

Product spec: `Creator_AI_Content_OS_Build_Guide.pdf` (V1 = paste text -> brief -> ideas -> Reel/LinkedIn/Carousel -> Studio). Don't add V2 features (YouTube, scheduling, teams, vector DB, multiple LLM providers) unless asked.

## Architecture rules
- Browser uses Supabase **for auth only**. All data reads/writes go through FastAPI (`frontend/src/services/api.js`).
- FastAPI verifies the Bearer token (`api/deps.py`) and queries Supabase **with the user's token** (`db/repository.py`) so RLS applies. Never use or add the service-role key.
- Routes in `api/` stay thin -> `services/` hold logic -> prompt text lives only in `prompts/` -> AI calls go only through `services/llm_service.py`.
- Every AI output has a Pydantic schema (`schemas/`). Keep AI output models free of non-None defaults (OpenAI strict mode). Old DB rows must keep validating - add new fields with defaults only in non-AI models.
- `AI_PROVIDER=mock` must stay free and clearly labelled (provider="mock", "Demo output" badge). Never present mock output as AI.
- Ideas are appended, never replaced: `generated_content.idea_index` points into `projects.content_ideas.ideas`.
- Content changes keep the previous version in `previous_versions`.

## Database
Existing tables: `creator_profiles`, `projects` (analysis, content_ideas JSONB), `generated_content` (content JSONB). Migration `001` adds `feedback`, `platform_preferences`, `usage_events` + columns. Schema changes = new numbered file in `supabase/migrations/`, additive and idempotent; the user runs it in the Supabase SQL Editor.

## Commands
- Backend (from `backend/`, venv): `uvicorn main:app --reload` · `pytest` · `python scripts/run_golden.py`
- Frontend (from `frontend/`): `npm run dev` · `npm run lint` · `npm run build`
- Windows machine; backend venv at `backend/.venv`.

## Conventions
- Frontend: Tailwind; reuse primitives from `components/ui.jsx`; data fetching via `hooks/useApiData.js`; toasts via `useToast`. ESLint uses react-hooks v7 strict rules (no synchronous setState in effects).
- Never read/print/overwrite `backend/.env` or `frontend/.env.local` values; update the `.env.example` files instead.
- Don't make real OpenAI calls in tests; tests use `tests/fakes.py` + mock provider.
- Ask before committing, pushing, deleting files, or destructive SQL.
