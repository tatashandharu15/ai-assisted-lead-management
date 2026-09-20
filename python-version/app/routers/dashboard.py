from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Lead
from app.schemas import DashboardResponse, LEAD_STATUSES
from app.services.source_extract import CHANNELS, extract_source

router = APIRouter()

ALL_STATUSES = list(LEAD_STATUSES)


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    leads = db.query(Lead).limit(5000).all()

    status_counter: Counter = Counter()
    channel_counter: Counter = Counter()

    for lead in leads:
        status_counter[lead.lead_status] += 1
        text = (lead.notes or "") + " " + (lead.original_source or "")
        result = extract_source(text, use_llm=False)
        ch = result.get("channel", "Other")
        if ch not in CHANNELS:
            ch = "Other"
        channel_counter[ch] += 1

    by_status = {s: int(status_counter.get(s, 0)) for s in ALL_STATUSES}
    by_channel = {c: int(channel_counter.get(c, 0)) for c in CHANNELS}

    return DashboardResponse(by_status=by_status, by_channel=by_channel)
