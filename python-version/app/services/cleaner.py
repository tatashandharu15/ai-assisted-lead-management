from __future__ import annotations

import re
from datetime import datetime, UTC
from typing import Optional

import pandas as pd
from dateutil import parser as dateparser

from app.schemas import LEAD_STATUSES
VALID_STATUSES = set(LEAD_STATUSES)

LEGAL_SUFFIXES_STRICT = r"\s*(inc|ltd|pte|co|llc|srl|gmbh|ab|ltda)\.?$"
INDUSTRY_PRESERVE = {"freight", "logistics", "trading"}
LEGAL_SUFFIXES_BROAD = r"\s*(inc|ltd|pte|co|llc|srl|holdings|gmbh|ab|ltda|partners|solutions|studio|retail|digital|trading|freight|logistics|consulting|analytics|robotics|group|ventures)\.?$"

COLUMN_RENAME_MAP = {
    "Record ID": "record_id",
    "First Name": "first_name",
    "Last Name": "last_name",
    "Full Name": "full_name",
    "Job Title": "job_title",
    "Company Name": "company_name",
    "Email": "email",
    "Phone Number": "phone_number",
    "Country/Region": "country",
    "Lead Status": "lead_status",
    "Lifecycle Stage": "lifecycle_stage",
    "Original Source": "original_source",
    "Contact Owner": "contact_owner",
    "Create Date": "create_date",
    "Last Modified Date": "last_modified_date",
    "Notes": "notes",
    "Lead Score": "lead_score",
}

DROP_COLUMNS = [
    "City",
    "Original Source Drill-Down 1",
    "Annual Revenue",
    "Marketing contact status",
    "GDPR consent",
]


def normalize_lead_status(raw_status: str) -> str:
    if raw_status is None:
        return "new"
    s = str(raw_status).strip().lower()
    s = re.sub(r"\s+", "_", s)
    if s not in VALID_STATUSES:
        return "new"
    return s


def normalize_phone_digits(raw_phone: str) -> str:
    if raw_phone is None:
        return ""
    return re.sub(r"\D", "", str(raw_phone))


def normalize_company_tokens(name: str) -> str:
    if not name:
        return ""
    s = str(name).strip().lower()
    for _ in range(10):
        new_s = re.sub(LEGAL_SUFFIXES_BROAD, "", s, flags=re.IGNORECASE)
        new_s = new_s.strip().rstrip(",").rstrip(".").strip()
        if new_s == s:
            break
        tokens = s.split()
        new_tokens = new_s.split()
        removed_token_count = len(tokens) - len(new_tokens)
        if removed_token_count >= 1 and len(new_tokens) <= 2 and len(tokens) > 1:
            removed = [t.rstrip(".").rstrip(",") for t in tokens if t.rstrip(".").rstrip(",") not in [nt.rstrip(".").rstrip(",") for nt in new_tokens]]
            last_removed = removed[-1] if removed else ""
            strict_match = re.match(LEGAL_SUFFIXES_STRICT, " " + last_removed, re.IGNORECASE)
            if not strict_match and last_removed in INDUSTRY_PRESERVE:
                break
        s = new_s
    return s.strip()


def parse_mixed_date(raw: str) -> Optional[datetime]:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    raw_str = str(raw).strip()
    if not raw_str:
        return None
    try:
        dt = dateparser.parse(raw_str, dayfirst=False, fuzzy=True)
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        else:
            dt = dt.astimezone(UTC)
        return dt
    except (ValueError, OverflowError, TypeError):
        return None


def parse_full_name(full: str) -> tuple[str, str]:
    if not full:
        return "", ""
    parts = str(full).strip().split()
    if len(parts) == 0:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def load_and_clean_csv(csv_path: str) -> list[dict]:
    df = pd.read_csv(csv_path)

    for drop_col in DROP_COLUMNS:
        if drop_col in df.columns:
            df = df.drop(columns=[drop_col])

    df = df.rename(columns=COLUMN_RENAME_MAP)

    result: list[dict] = []
    for _, row in df.iterrows():
        row_dict: dict = {}

        row_dict["record_id"] = str(row["record_id"]) if pd.notna(row.get("record_id")) else None
        row_dict["first_name"] = str(row["first_name"]).strip() if pd.notna(row.get("first_name")) else None
        row_dict["last_name"] = str(row["last_name"]).strip() if pd.notna(row.get("last_name")) else None
        row_dict["full_name"] = str(row["full_name"]).strip() if pd.notna(row.get("full_name")) else None
        row_dict["job_title"] = str(row["job_title"]).strip() if pd.notna(row.get("job_title")) else None
        row_dict["company_name"] = str(row["company_name"]).strip() if pd.notna(row.get("company_name")) else ""
        row_dict["email"] = str(row["email"]).strip().lower() if pd.notna(row.get("email")) else ""
        row_dict["phone_number"] = str(row["phone_number"]).strip() if pd.notna(row.get("phone_number")) else ""
        row_dict["country"] = str(row["country"]).strip() if pd.notna(row.get("country")) else ""
        row_dict["lead_status"] = normalize_lead_status(str(row["lead_status"]) if pd.notna(row.get("lead_status")) else "")
        row_dict["lifecycle_stage"] = str(row["lifecycle_stage"]).strip() if pd.notna(row.get("lifecycle_stage")) else None
        row_dict["original_source"] = str(row["original_source"]).strip() if pd.notna(row.get("original_source")) else None
        row_dict["contact_owner"] = str(row["contact_owner"]).strip() if pd.notna(row.get("contact_owner")) else ""
        row_dict["create_date"] = parse_mixed_date(row.get("create_date")) or datetime(2025, 1, 1, tzinfo=UTC)
        row_dict["last_modified_date"] = parse_mixed_date(row.get("last_modified_date"))
        row_dict["notes"] = str(row["notes"]) if pd.notna(row.get("notes")) else ""
        row_dict["lead_score"] = int(row["lead_score"]) if pd.notna(row.get("lead_score")) else None

        row_dict["phone_digits"] = normalize_phone_digits(row_dict["phone_number"])

        if (not row_dict["first_name"] or not row_dict["last_name"]) and row_dict["full_name"]:
            f, l = parse_full_name(row_dict["full_name"])
            if not row_dict["first_name"]:
                row_dict["first_name"] = f or None
            if not row_dict["last_name"]:
                row_dict["last_name"] = l or None

        if row_dict["full_name"] is None or not row_dict["full_name"].strip():
            fn = row_dict["first_name"] or ""
            ln = row_dict["last_name"] or ""
            combined = f"{fn} {ln}".strip()
            if combined:
                row_dict["full_name"] = combined

        if not row_dict["contact_owner"]:
            row_dict["contact_owner"] = "Unassigned"

        if not row_dict["company_name"]:
            row_dict["company_name"] = "Unknown"

        if not row_dict["country"]:
            row_dict["country"] = "Unknown"

        if not row_dict["email"]:
            row_dict["email"] = f"unknown_{row_dict['record_id'] or 'x'}@unknown.invalid"

        if not row_dict["phone_number"]:
            row_dict["phone_number"] = "0"
            row_dict["phone_digits"] = "0"

        result.append(row_dict)

    return result


if __name__ == "__main__":
    rows = load_and_clean_csv("../data/leads_seed.csv")
    print(f"Loaded and cleaned: {len(rows)} rows")
