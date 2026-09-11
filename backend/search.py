import json
import math
from pathlib import Path
from types import SimpleNamespace
from typing import Optional, cast
from sqlalchemy import select
from database import SessionLocal
from models import Well
from embeddings import get_embedding, build_embedding_text

# --- weights — tune these live during the demo ---
W_SEMANTIC = 0.5
W_GEO = 0.3
W_DEPTH = 0.2

MAX_RADIUS_KM = 100.0       # wells farther than this contribute nothing
DEPTH_TOLERANCE_M = 500.0   # depth score falls off linearly over this range
LOCAL_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "wells_data.json"


def local_rows():
    with LOCAL_DATA_PATH.open(encoding="utf-8") as data_file:
        return [(SimpleNamespace(**well), None) for well in json.load(data_file)]


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def geo_score(well, lat, lon):
    d = haversine_km(lat, lon, well.latitude, well.longitude)
    return max(0.0, 1.0 - d / MAX_RADIUS_KM)


def depth_score(well, depth_m):
    # If we know the exact incident depth, use it; otherwise treat the drilled interval as safe zone
    if well.incident_depth_m is not None:
        dist = abs(depth_m - well.incident_depth_m)
    elif well.depth_start_m <= depth_m <= well.depth_end_m:
        return 1.0
    else:
        dist = min(abs(depth_m - well.depth_start_m), abs(depth_m - well.depth_end_m))
    return max(0.0, 1.0 - dist / DEPTH_TOLERANCE_M)


def search_similar_incidents(lat: float, lon: float, depth_m: float, query_text: str, top_k: int = 5):
    """Hybrid search: pgvector semantic ranking, reranked by geographic + depth proximity."""
    query_vec = get_embedding(query_text)

    db = None
    try:
        if SessionLocal is None:
            rows = local_rows()
        else:
            try:
                db = SessionLocal()
                if query_vec is not None:
                    dist_expr = Well.embedding.cosine_distance(query_vec)
                    rows = db.execute(
                        select(Well, dist_expr).order_by(dist_expr).limit(20)
                    ).all()
                else:
                    # Degraded mode: OpenAI unreachable -> rank by geo/depth only
                    rows = [(w, None) for w in db.query(Well).all()]
            except Exception as error:
                print(f"[search] Database unavailable, using local JSON fallback: {error}")
                if db is not None:
                    db.close()
                    db = None
                rows = local_rows()

        results = []
        for well, sem_dist in rows:
            incident_depth = cast(Optional[float], well.incident_depth_m)
            sem = (1.0 - sem_dist) if sem_dist is not None else 0.0
            g = geo_score(well, lat, lon)
            d = depth_score(well, depth_m)
            combined = W_SEMANTIC * sem + W_GEO * g + W_DEPTH * d

            results.append({
                "well_name": well.well_name,
                "field_name": well.field_name,
                "latitude": well.latitude,
                "longitude": well.longitude,
                "formation_type": well.formation_type,
                "incident_type": well.incident_type,
                "severity": well.severity,
                "incident_date": well.incident_date,
                "incident_depth_m": incident_depth,
                "narrative": well.narrative,
                "distance_km": round(haversine_km(lat, lon, well.latitude, well.longitude), 1),
                "depth_delta_m": (
                    round(abs(depth_m - incident_depth), 0)
                    if incident_depth is not None
                    else 0.0
                ),
                "scores": {
                    "semantic": round(sem, 3),
                    "geo": round(g, 3),
                    "depth": round(d, 3),
                    "combined": round(combined, 3),
                },
            })

        results.sort(key=lambda r: r["scores"]["combined"], reverse=True)
        return results[:top_k]
    finally:
        if db is not None:
            db.close()