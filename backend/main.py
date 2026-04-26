"""
FastAPI + SSE entrypoint for the AI Startup Idea Validator backend.
Streams validation progress events to the frontend via Server-Sent Events.
"""
import json
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

load_dotenv()

from src.agents.orchestrator import orchestrate_validation
from src.tools.auth_guard import require_admin, require_identity
from src.tools.metrics_store import get_metric_summary, save_metric_event
from src.tools.pii_masker import validate_and_sanitize_hypothesis
from src.tools.report_store import get_report as load_report, save_report

# ─── App Setup ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Validate required env vars on startup
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[WARNING] GEMINI_API_KEY not set. Agents will fail.")
    else:
        print(f"[OK] Gemini API key configured ({api_key[:8]}...)")
    yield
    print("[INFO] Shutting down AI Startup Idea Validator backend")


app = FastAPI(
    title="AI Startup Idea Validator API",
    description="Multi-agent startup validation engine powered by Google Gemini",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request/Response Models ───────────────────────────────────────────────────

class ValidateRequest(BaseModel):
    hypothesis: str = Field(
        ...,
        min_length=20,
        max_length=2000,
        description="The startup idea or hypothesis to validate",
        examples=["Small business owners struggle with invoicing because they spend 5+ hours per week on manual spreadsheets"],
    )
    session_id: str | None = Field(None, description="Optional session ID for resuming")


class HealthResponse(BaseModel):
    status: str
    version: str
    agents_ready: bool


class MetricEventRequest(BaseModel):
    event_type: str = Field(..., min_length=2, max_length=100)
    payload: dict = Field(default_factory=dict)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        agents_ready=bool(os.environ.get("GEMINI_API_KEY")),
    )


@app.post("/api/validate")
async def validate_startup_idea(
    request: ValidateRequest,
    identity: dict = Depends(require_identity),
):
    """
    Main validation endpoint — streams progress events via SSE.
    
    The frontend connects here and receives real-time progress updates
    as each agent completes its task.
    """
    if not os.environ.get("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="Validation service is temporarily unavailable.",
        )

    # ── PII Masking ─────────────────────────────────────────────────
    try:
        sanitized_hypothesis, pii_warnings, _ = validate_and_sanitize_hypothesis(
            request.hypothesis
        )
    except ValueError as e:
        # Hypothesis validation remains explicit so users can correct input quickly.
        raise HTTPException(status_code=422, detail=str(e))

    async def event_generator():
        save_metric_event(
            "validation_started",
            {
                "session_id": request.session_id,
                "hypothesis_length": len(sanitized_hypothesis),
                "uid": identity.get("uid"),
            },
        )

        # Stream any PII warnings as the first event
        if pii_warnings:
            yield {
                "event": "warning",
                "data": json.dumps({
                    "stage": "warning",
                    "status": "warning",
                    "message": pii_warnings[0],
                    "progress": 0,
                }),
            }

        try:
            async for event in orchestrate_validation(
                raw_hypothesis=sanitized_hypothesis,
                session_id=request.session_id,
            ):
                if event.get("stage") == "complete" and isinstance(event.get("data"), dict):
                    save_report(event["data"])
                    report_kpi = event["data"].get("kpi", {})
                    save_metric_event(
                        "validation_completed",
                        {
                            "session_id": event["data"].get("session_id"),
                            "processing_seconds": report_kpi.get("total_processing_seconds"),
                            "within_target": report_kpi.get("processing_within_target"),
                            "uid": identity.get("uid"),
                        },
                    )
                yield {
                    "event": event["stage"],
                    "data": json.dumps(event),
                }
        except Exception as e:
            print(f"[VALIDATION] Internal error: {e}")
            save_metric_event(
                "validation_failed",
                {
                    "session_id": request.session_id,
                    "error": str(e),
                    "uid": identity.get("uid"),
                },
            )
            yield {
                "event": "error",
                "data": json.dumps({
                    "stage": "error",
                    "status": "error",
                    "message": "Validation failed. Please try again in a moment.",
                    "progress": 0,
                }),
            }

    return EventSourceResponse(event_generator())


@app.get("/api/report/{session_id}")
async def get_report(session_id: str, identity: dict = Depends(require_identity)):
    """
    Retrieve a completed report by session ID.
    In production, this fetches from Firestore; in local dev it falls back to
    in-memory storage when Firestore isn't configured.
    """
    report = load_report(session_id)
    if not report:
        raise HTTPException(status_code=404, detail="Requested report is unavailable")
    save_metric_event(
        "report_loaded",
        {"session_id": session_id, "uid": identity.get("uid")},
    )
    return report


@app.post("/api/metrics/event")
async def record_metric_event(
    request: MetricEventRequest,
    identity: dict = Depends(require_identity),
):
    """Capture engagement events for DAU and product KPI tracking."""
    payload = dict(request.payload)
    payload.setdefault("uid", identity.get("uid"))
    save_metric_event(request.event_type, payload)
    return {"status": "ok"}


@app.get("/api/metrics/summary")
async def metrics_summary(
    days: int = Query(default=7, ge=1, le=90),
    _: dict = Depends(require_admin),
):
    """Return aggregated KPI metrics for dashboarding."""
    return get_metric_summary(days=days)


# ─── Dev Server ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
