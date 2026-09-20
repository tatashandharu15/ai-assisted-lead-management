from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

LeadStatus = Literal[
    "new",
    "contacted",
    "connected",
    "qualified",
    "opportunity",
    "closed_won",
    "closed_lost",
]
LEAD_STATUSES: tuple[str, ...] = LeadStatus.__args__

SourceChannel = Literal[
    "Website",
    "Event",
    "LinkedIn",
    "Organic Search",
    "Referral",
    "Manual/Sales",
    "Other",
]


class LeadBase(BaseModel):
    record_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    job_title: Optional[str] = None
    company_name: str
    email: str
    phone_number: str
    phone_digits: Optional[str] = None
    country: str
    lead_status: LeadStatus
    lifecycle_stage: Optional[str] = None
    original_source: Optional[str] = None
    contact_owner: str
    create_date: datetime
    last_modified_date: Optional[datetime] = None
    notes: str = ""
    lead_score: Optional[int] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    lead_status: Optional[LeadStatus] = None
    contact_owner: Optional[str] = None
    notes: Optional[str] = None


class LeadResponse(LeadBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DedupeCandidateGroup(BaseModel):
    group_id: int
    confidence: float
    lead_ids: list[int]
    explanation: str
    leads_preview: list[dict]


class SourceExtractResult(BaseModel):
    channel: SourceChannel
    detail: str


class DashboardResponse(BaseModel):
    by_status: dict[str, int]
    by_channel: dict[str, int]


class DedupRequest(BaseModel):
    min_confidence: Optional[float] = 0.7
    limit: Optional[int] = 50


class ExtractSourceRequest(BaseModel):
    text: str
    use_llm: Optional[bool] = True


class IngestLeadItem(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    country: Optional[str] = None
    message: Optional[str] = None
    submitted_at: Optional[datetime | str] = None

    model_config = {"extra": "allow"}
