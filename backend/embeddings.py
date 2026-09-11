import os
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).resolve().parent / ".env")
api_key = os.getenv("OPENAI_API_KEY")
if api_key and any(marker in api_key for marker in ("your_", "YOUR_", "REAL_", "sk-...")):
    api_key = None
client = OpenAI(api_key=api_key) if api_key else None

def build_embedding_text(well: dict) -> str:
    """Embed structured fields + narrative together so the vector captures context, not just prose."""
    return (
        f"Formation: {well.get('formation_type', 'unknown')}. "
        f"Incident type: {well.get('incident_type', 'unspecified')}. "
        f"Severity: {well.get('severity', 'unknown')}. "
        f"Narrative: {well.get('narrative', '')}"
    )

def get_embedding(text: str):
    """Returns a 1536-dim vector, or None if the API fails (demo-safe degraded mode)."""
    if client is None:
        return None
    try:
        resp = client.embeddings.create(model="text-embedding-3-small", input=text)
        return resp.data[0].embedding
    except Exception as e:
        print(f"[embeddings] OpenAI call failed: {e}")
        return None