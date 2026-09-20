from __future__ import annotations

import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from app.services.source_extract import extract_source


class TestSourceExtract:
    def test_singapore_fintech_event(self):
        r = extract_source("Met at the Singapore FinTech booth, said they'd follow up.")
        assert r["channel"] == "Event"

    def test_referral_michael_zhang(self):
        r = extract_source("Referred by Michael Zhang, warm intro")
        assert r["channel"] == "Referral"

    def test_linkedin_dm(self):
        r = extract_source("Linkedin dm inbound asking about pricing")
        assert r["channel"] == "LinkedIn"

    def test_organic_google(self):
        r = extract_source("Googled us and landed on product tour page")
        assert r["channel"] == "Organic Search"

    def test_manual_added(self):
        r = extract_source("Manual - added after inbound phone call")
        assert r["channel"] == "Manual/Sales"

    def test_website_form_pricing(self):
        r = extract_source("Filled out the form on the pricing page")
        assert r["channel"] == "Website"

    def test_other_gibberish(self):
        r = extract_source("xyt123 abc", use_llm=False)
        assert r["channel"] == "Other"

    def test_qr_saastr_event(self):
        r = extract_source("He scanned our QR code at the SaaStr Annual booth")
        assert r["channel"] == "Event"

    def test_linkedin_comment(self):
        r = extract_source("Connected on LinkedIn after commenting on our post")
        assert r["channel"] == "LinkedIn"

    def test_booked_demo_google_ad(self):
        r = extract_source("Booked a demo via the book-a-demo page after clicking a google ad")
        assert r["channel"] == "Website"
