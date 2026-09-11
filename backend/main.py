from typing import Optional
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import DATABASE_URL, engine
from embeddings import client
from search import search_similar_incidents

app = FastAPI(title="WELL X API", version="0.1")

allowed_origins = [origin.strip() for origin in os.getenv(
    "CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173"
).split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins, allow_methods=["*"], allow_headers=["*"],
)


@app.get("/health")
def health():
    database_status = "not_configured"
    if engine is not None:
        try:
            with engine.connect() as connection:
                connection.exec_driver_sql("SELECT 1")
            database_status = "ok"
        except Exception:
            database_status = "unavailable"

    return {
        "status": "ok" if database_status == "ok" else "degraded",
        "service": "well-x-api",
        "database": database_status,
        "embeddings": "configured" if client is not None else "not_configured",
    }


@app.get("/")
def root():
    return {
        "service": "well-x-api",
        "message": "WELL X backend is running.",
        "docs": "/docs",
        "health": "/health",
    }

ALERT_THRESHOLDS = {"HIGH": 0.65, "MEDIUM": 0.50, "LOW": 0.35}  # combined-score cutoffs


@app.get("/search")
def search(lat: float, lon: float, depth_m: float, query: str, top_k: int = 5):
    """Interactive search: frontend sends map-click coords + depth + free text."""
    try:
        results = search_similar_incidents(lat, lon, depth_m, query, top_k)
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return {"query": {"lat": lat, "lon": lon, "depth_m": depth_m, "text": query}, "results": results}


class RiskCheckRequest(BaseModel):
    lat: float
    lon: float
    current_depth_m: float
    planned_formation: Optional[str] = None
    top_k: int = 5


@app.post("/check_risk")
def check_risk(req: RiskCheckRequest):
    """Live-feed endpoint: simulator sends current drilling state, we fire proactive alerts."""
    # Construct a semantic query from live conditions (no free text exists in a live feed)
    query_text = (
        f"Drilling incident such as stuck pipe, lost circulation, gas kick or wellbore "
        f"instability in {req.planned_formation or 'unknown'} formation "
        f"at around {int(req.current_depth_m)} metres depth"
    )

    try:
        results = search_similar_incidents(req.lat, req.lon, req.current_depth_m, query_text, req.top_k)
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    top = results[0]["scores"]["combined"] if results else 0.0
    alert_level = "NONE"
    for level, threshold in ALERT_THRESHOLDS.items():
        if top >= threshold:
            alert_level = level
            break

    alerts = [r for r in results if r["scores"]["combined"] >= ALERT_THRESHOLDS["LOW"]]

    message = None
    if alerts:
        a = alerts[0]
        message = (
            f"⚠️ {a['incident_type']} ({a['severity']} severity) recorded at "
            f"{int(a['incident_depth_m'])} m in {a['well_name']}, "
            f"{a['distance_km']} km away. Current bit depth: {int(req.current_depth_m)} m."
        )

    return {
        "current_state": req.model_dump(),
        "alert_level": alert_level,
        "message": message,
        "alerts": alerts,
    }