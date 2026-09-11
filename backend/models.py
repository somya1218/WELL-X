from sqlalchemy import Column, Integer, String, Float, Text
from pgvector.sqlalchemy import Vector
from database import Base

class Well(Base):
    __tablename__ = "wells"

    id = Column(Integer, primary_key=True, index=True)
    well_name = Column(String, nullable=False)
    field_name = Column(String)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    depth_start_m = Column(Float, nullable=False)   # drilled interval
    depth_end_m = Column(Float, nullable=False)
    incident_depth_m = Column(Float)                # exact depth where incident occurred

    formation_type = Column(String)
    incident_type = Column(String)                  # "stuck pipe", "lost circulation", "kick"...
    severity = Column(String)                       # "low" / "medium" / "high"
    incident_date = Column(String)                  # string keeps JSON simple for hackathon

    narrative = Column(Text, nullable=False)
    embedding = Column(Vector(1536))                # matches text-embedding-3-small