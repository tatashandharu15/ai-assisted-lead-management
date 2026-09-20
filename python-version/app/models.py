from __future__ import annotations

from datetime import datetime, UTC
from sqlalchemy import Column, Integer, String, Text, DateTime, Index

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(String, unique=True, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    job_title = Column(String, nullable=True)
    company_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)
    phone_digits = Column(String, nullable=True)
    country = Column(String, nullable=False)
    lead_status = Column(String, nullable=False)
    lifecycle_stage = Column(String, nullable=True)
    original_source = Column(String, nullable=True)
    contact_owner = Column(String, nullable=False)
    create_date = Column(DateTime, nullable=False)
    last_modified_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=False, default="")
    lead_score = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    updated_at = Column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        Index("ix_leads_email", "email"),
        Index("ix_leads_phone_digits", "phone_digits"),
        Index("ix_leads_lead_status", "lead_status"),
    )
