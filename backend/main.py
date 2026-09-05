from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from schemas.analysis import (
    AnalyzeRequest,
    ContentAnalysis,
)

from services.ai_service import analyze_content

app = FastAPI(
    title="Creator Content OS API",
    version="1.0.0"
)

# Frontend addresses that are allowed
# to communicate with this backend.
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Creator Content OS backend is running"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "message": "Frontend can communicate with backend"
    }

@app.post(
    "/api/analyze",
    response_model=ContentAnalysis
)
def analyze_project(
    request: AnalyzeRequest
):
    return analyze_content(request)