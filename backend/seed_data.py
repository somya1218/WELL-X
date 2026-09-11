import json
from pathlib import Path
from sqlalchemy import text
from database import engine, SessionLocal, Base
from models import Well
from embeddings import get_embedding, build_embedding_text

JSON_PATH = Path(__file__).resolve().parent.parent / "data" / "wells_data.json"


def seed():
    if engine is None or SessionLocal is None:
        raise RuntimeError(
            "DATABASE_URL is not configured. Set it in backend/.env before seeding."
        )

    # pgvector extension (normally already enabled in Supabase dashboard; this is belt-and-braces)
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()

    Base.metadata.create_all(engine)

    db = SessionLocal()
    try:
        if db.query(Well).count() > 0:
            print("Already seeded — skipping. (Delete rows in Supabase to reseed.)")
            return

        with open(JSON_PATH, encoding="utf-8") as f:
            wells = json.load(f)

        for w in wells:
            db.add(Well(
                well_name=w["well_name"],
                field_name=w.get("field_name"),
                latitude=w["latitude"],
                longitude=w["longitude"],
                depth_start_m=w["depth_start_m"],
                depth_end_m=w["depth_end_m"],
                incident_depth_m=w.get("incident_depth_m"),
                formation_type=w.get("formation_type"),
                incident_type=w.get("incident_type"),
                severity=w.get("severity"),
                incident_date=w.get("incident_date"),
                narrative=w["narrative"],
                embedding=get_embedding(build_embedding_text(w)),
            ))

        db.commit()
        print(f"Seeded {len(wells)} wells with embeddings.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()