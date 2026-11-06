from fastapi import APIRouter

from core.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    settings = get_settings()
    return {
        "status": "ok",
        "ai_provider": settings.ai_provider,
        "supabase_configured": bool(settings.supabase_url and settings.supabase_publishable_key),
    }
