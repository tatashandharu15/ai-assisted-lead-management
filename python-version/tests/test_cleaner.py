from __future__ import annotations

import os
import sys
from datetime import datetime

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from app.services.cleaner import (
    load_and_clean_csv,
    normalize_company_tokens,
    normalize_lead_status,
    normalize_phone_digits,
    parse_full_name,
    parse_mixed_date,
)


class TestNormalizeLeadStatus:
    def test_new_variants(self):
        assert normalize_lead_status("NEW") == "new"
        assert normalize_lead_status("new") == "new"
        assert normalize_lead_status(" New ") == "new"

    def test_closed_lost(self):
        assert normalize_lead_status("closed lost") == "closed_lost"
        assert normalize_lead_status("Closed Lost") == "closed_lost"

    def test_closed_won(self):
        assert normalize_lead_status("closed won") == "closed_won"
        assert normalize_lead_status(" Closed Won ") == "closed_won"

    def test_qualified(self):
        assert normalize_lead_status("Qualified ") == "qualified"
        assert normalize_lead_status("qualified") == "qualified"

    def test_other_statuses(self):
        assert normalize_lead_status("Contacted") == "contacted"
        assert normalize_lead_status("connected") == "connected"
        assert normalize_lead_status("OPPORTUNITY") == "opportunity"

    def test_invalid_defaults_new(self):
        assert normalize_lead_status("junk") == "new"
        assert normalize_lead_status("") == "new"


class TestNormalizePhoneDigits:
    def test_plus_and_parens(self):
        assert normalize_phone_digits("+62 (875) 4899-5562") == "6287548995562"

    def test_spaces_and_dashes(self):
        assert normalize_phone_digits("+33 6 15 68 78 25") == "33615687825"

    def test_other_chars(self):
        assert normalize_phone_digits("+81-85-3581-4173") == "818535814173"


class TestNormalizeCompanyTokens:
    def test_strip_ltd(self):
        assert normalize_company_tokens("Acme Ltd") == "acme"

    def test_strip_inc(self):
        assert normalize_company_tokens("Delta Inc.") == "delta"

    def test_strip_pte_ltd(self):
        assert normalize_company_tokens("Owusu Freight Pte Ltd") == "owusu freight"

    def test_strip_llc(self):
        assert normalize_company_tokens("Foo Bar LLC") == "foo bar"

    def test_strip_holdings_group(self):
        assert normalize_company_tokens("Big Holdings Group Ltd") == "big"


class TestParseMixedDate:
    def test_iso_with_t(self):
        d = parse_mixed_date("2025-10-27T00:00:00Z")
        assert isinstance(d, datetime)
        assert d.year == 2025
        assert d.month == 10
        assert d.day == 27

    def test_yyyy_mm_dd(self):
        d = parse_mixed_date("2025-09-29")
        assert isinstance(d, datetime)
        assert d.year == 2025
        assert d.month == 9
        assert d.day == 29

    def test_m_d_yyyy(self):
        d = parse_mixed_date("12/21/2025")
        assert isinstance(d, datetime)
        assert d.year == 2025
        assert d.month == 12
        assert d.day == 21


class TestParseFullName:
    def test_two_parts(self):
        first, last = parse_full_name("John Smith")
        assert first == "John"
        assert last == "Smith"

    def test_multi_part_last(self):
        first, last = parse_full_name("Joey Van Der Saar")
        assert first == "Joey"
        assert last == "Van Der Saar"

    def test_single_token(self):
        first, last = parse_full_name("Prince")
        assert first == "Prince"
        assert last == ""


class TestLoadAndCleanCSV:
    def test_row_count(self, cleaned_seed_rows):
        assert len(cleaned_seed_rows) == 2049

    def test_rows_have_required_keys(self, cleaned_seed_rows):
        row = cleaned_seed_rows[0]
        for k in [
            "record_id",
            "company_name",
            "email",
            "phone_number",
            "country",
            "lead_status",
            "contact_owner",
            "create_date",
            "notes",
            "phone_digits",
        ]:
            assert k in row

    def test_status_normalized(self, cleaned_seed_rows):
        valid = {"new", "contacted", "connected", "qualified", "opportunity", "closed_won", "closed_lost"}
        for r in cleaned_seed_rows[:100]:
            assert r["lead_status"] in valid
