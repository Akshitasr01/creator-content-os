"""Creator Content OS API.

Run from the backend folder:
    .venv\\Scripts\\activate
    uvicorn main:app --reload
Interactive API docs: http://127.0.0.1:8000/docs
"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api import content, creators, feedback, generate, health, projects
from core.config import get_settings
from core.errors import AppError

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("creator_content_os")
# httpx logs every request URL at INFO; keep logs focused on our own messages.
logging.getLogger("httpx").setLevel(logging.WARNING)

settings = get_settings()

app = FastAPI(
    title="Creator Content OS API",
    version="1.0.0",
    description="Turn one long-form piece of content into platform-specific content in the creator's voice.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,  # auth uses a Bearer header, not cookies
    allow_methods=["GET", "POST", "PUT", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(AppError)
def handle_app_error(_: Request, error: AppError):
    return JSONResponse(status_code=error.status_code, content={"detail": error.message, "code": error.code})


@app.exception_handler(Exception)
def handle_unexpected_error(_: Request, error: Exception):
    logger.exception("Unhandled error: %s", type(error).__name__)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our side. Please try again.", "code": "server_error"},
    )


@app.get("/", include_in_schema=False)
def root():
    return {"message": "Creator Content OS backend is running", "docs": "/docs"}


for router in (health.router, creators.router, projects.router, generate.router, content.router, feedback.router):
    app.include_router(router)

logger.info("AI provider: %s", settings.ai_provider)
