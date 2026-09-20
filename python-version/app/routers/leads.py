from __future__ import annotations

import csv
import io
import re
from datetime import datetime, UTC
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Lead
from app.schemas import (
    DedupRequest,
    ExtractSourceRequest,
    IngestLeadItem,
    LeadResponse,
    LeadUpdate,
    SourceExtractResult,
)
from app.services.cleaner import normalize_phone_digits, parse_full_name
from app.services.dedup import find_dedupe_candidates
from app.services.source_extract import extract_source

router = APIRouter()

CSV_DANGEROUS_PREFIX = re.compile(r"^[=+\-@\t\r]")


def _sanitize_csv_cell(val):
    s = "" if val is None else str(val)
    if CSV_DANGEROUS_PREFIX.match(s):
        return "'" + s
    return s


def _build_query(
    db: Session,
    status: Optional[str] = None,
    owner: Optional[str] = None,
    country: Optional[str] = None,
    q: Optional[str] = None,
):
    query = db.query(Lead)
    filters = []
    if status:
        filters.append(Lead.lead_status == status)
    if owner:
        filters.append(Lead.contact_owner.ilike(f"%{owner}%"))
    if country:
        filters.append(Lead.country.ilike(f"%{country}%"))
    if q:
        like = f"%{q}%"
        filters.append(
            or_(
                Lead.first_name.ilike(like),
                Lead.last_name.ilike(like),
                Lead.full_name.ilike(like),
                Lead.company_name.ilike(like),
                Lead.email.ilike(like),
            )
        )
    if filters:
        query = query.filter(and_(*filters))
    return query


@router.get("/leads", response_model=list[LeadResponse])
def list_leads(
    status: Optional[str] = Query(None),
    owner: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    query = _build_query(db, status, owner, country, q)
    return query.order_by(Lead.id.asc()).limit(limit).all()


@router.get("/leads/export")
def export_leads(
    status: Optional[str] = Query(None),
    owner: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = _build_query(db, status, owner, country, q)
    leads = query.order_by(Lead.id.asc()).all()

    fieldnames = [
        "id",
        "record_id",
        "first_name",
        "last_name",
        "full_name",
        "job_title",
        "company_name",
        "email",
        "phone_number",
        "phone_digits",
        "country",
        "lead_status",
        "lifecycle_stage",
        "original_source",
        "contact_owner",
        "create_date",
        "last_modified_date",
        "notes",
        "lead_score",
    ]

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for lead in leads:
        row = {}
        for f in fieldnames:
            val = getattr(lead, f, "")
            if isinstance(val, datetime):
                val = val.isoformat()
            if val is None:
                val = ""
            row[f] = _sanitize_csv_cell(val)
        writer.writerow(row)
    csv_content = buf.getvalue()

    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=leads_export.csv",
        },
    )


@router.get("/leads/{lead_id}", response_model=LeadResponse)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.patch("/leads/{lead_id}", response_model=LeadResponse)
def update_lead(lead_id: int, body: LeadUpdate, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if body.lead_status is not None:
        lead.lead_status = body.lead_status
    if body.contact_owner is not None:
        lead.contact_owner = body.contact_owner
    if body.notes is not None:
        lead.notes = body.notes
    lead.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/leads/ingest")
def ingest_leads(
    items: list[IngestLeadItem],
    db: Session = Depends(get_db),
):
    results = []
    for item in items:
        item_dict = item.model_dump()
        name = item_dict.get("name", "") or ""
        email = (item_dict.get("email", "") or "").strip().lower()
        phone = item_dict.get("phone", "") or ""
        company = item_dict.get("company", "") or "Unknown"
        country = item_dict.get("country", "") or "Unknown"
        message = item_dict.get("message", "") or ""
        submitted_at_raw = item_dict.get("submitted_at")
        phone_digits = normalize_phone_digits(phone)

        first_name, last_name = parse_full_name(name)
        full_name = name or f"{first_name} {last_name}".strip()

        try:
            if submitted_at_raw:
                if isinstance(submitted_at_raw, datetime):
                    create_date = submitted_at_raw
                else:
                    from dateutil import parser as dateparser

                    create_date = dateparser.parse(str(submitted_at_raw))
                    if create_date and create_date.tzinfo is None:
                        create_date = create_date.replace(tzinfo=UTC)
            else:
                create_date = datetime.now(UTC)
        except Exception:
            create_date = datetime.now(UTC)

        if not email:
            email = f"unknown_ingest_{datetime.now(UTC).strftime('%Y%m%d%H%M%S%f')}@unknown.invalid"
        if not phone:
            phone = "0"
            phone_digits = "0"

        result_for_item = None
        for attempt in range(3):
            try:
                with db.begin_nested():
                    phone_match = None
                    email_match = None
                    if phone_digits:
                        phone_match = (
                            db.query(Lead)
                            .filter(Lead.phone_digits == phone_digits)
                            .with_for_update()
                            .first()
                        )
                    if email and email != "unknown*":
                        email_match = (
                            db.query(Lead)
                            .filter(Lead.email == email)
                            .with_for_update()
                            .first()
                        )

                    if phone_match and email_match and phone_match.id != email_match.id:
                        result_for_item = {
                            "action": "conflict",
                            "matched_on": "conflict_phone_email_split",
                            "phone_lead_id": phone_match.id,
                            "email_lead_id": email_match.id,
                            "detail": (
                                "Phone and email match different existing records; "
                                "manual merge required"
                            ),
                        }
                        break

                    matched_on: Optional[str] = None
                    existing = None
                    if phone_match and email_match:
                        existing = phone_match
                        matched_on = "both"
                    elif phone_match:
                        existing = phone_match
                        matched_on = "phone"
                    elif email_match:
                        existing = email_match
                        matched_on = "email"

                    if existing:
                        if first_name:
                            existing.first_name = first_name
                        if last_name:
                            existing.last_name = last_name
                        if full_name:
                            existing.full_name = full_name
                        if company and company != "Unknown":
                            existing.company_name = company
                        if country and country != "Unknown":
                            existing.country = country
                        if message:
                            ingest_stamp = datetime.now(UTC).strftime("%Y-%m-%d")
                            new_note = f"[Ingest {ingest_stamp}]: {message}"
                            if existing.notes:
                                existing.notes = existing.notes.rstrip() + "\n" + new_note
                            else:
                                existing.notes = new_note
                        if phone:
                            existing.phone_number = phone
                            existing.phone_digits = phone_digits
                        if email:
                            existing.email = email
                        existing.updated_at = datetime.now(UTC)
                        db.flush()
                        db.refresh(existing)
                        result_for_item = {
                            "action": "updated",
                            "lead_id": existing.id,
                            "matched_on": matched_on,
                        }
                        break
                    else:
                        new_lead = Lead(
                            first_name=first_name or None,
                            last_name=last_name or None,
                            full_name=full_name or None,
                            company_name=company,
                            email=email,
                            phone_number=phone,
                            phone_digits=phone_digits,
                            country=country,
                            lead_status="new",
                            contact_owner="Unassigned",
                            create_date=create_date,
                            notes=message,
                        )
                        db.add(new_lead)
                        db.flush()
                        db.refresh(new_lead)
                        result_for_item = {
                            "action": "created",
                            "lead_id": new_lead.id,
                            "matched_on": None,
                        }
                        break
            except IntegrityError:
                db.rollback()
                continue

        if result_for_item is None:
            result_for_item = {
                "action": "failed",
                "matched_on": None,
                "detail": "Race conflict retries exhausted, please retry",
            }
        results.append(result_for_item)

    db.commit()
    return results


@router.post("/leads/dedupe-candidates")
def post_dedupe_candidates(
    body: DedupRequest,
    db: Session = Depends(get_db),
):
    groups, _ = find_dedupe_candidates(
        session=db,
        min_confidence=body.min_confidence or 0.7,
        limit=body.limit,
    )
    return groups


@router.post("/leads/extract-source", response_model=SourceExtractResult)
def post_extract_source(body: ExtractSourceRequest):
    result = extract_source(body.text, use_llm=body.use_llm if body.use_llm is not None else True)
    return SourceExtractResult(**result)


@router.get("/leads/{lead_id}/extracted-source", response_model=SourceExtractResult)
def get_lead_extracted_source(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    text = (lead.notes or "") + " " + (lead.original_source or "")
    result = extract_source(text, use_llm=True)
    return SourceExtractResult(**result)
