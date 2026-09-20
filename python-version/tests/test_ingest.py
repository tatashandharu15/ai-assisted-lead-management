from __future__ import annotations

import uuid


class TestIngestCreate:
    def test_ingest_new_unique(self, client, seeded_db_session):
        from app.models import Lead

        before = seeded_db_session.query(Lead).count()
        unique_email = f"test-{uuid.uuid4().hex}@unique.example"
        unique_phone = f"+1{uuid.uuid4().hex[:10]}"
        r = client.post(
            "/leads/ingest",
            json=[
                {
                    "name": "Unique Person",
                    "email": unique_email,
                    "phone": unique_phone,
                    "company": "Unique Co",
                    "country": "Wonderland",
                    "message": "hello",
                    "submitted_at": "2026-01-01T00:00:00Z",
                    "form_id": "form_1",
                    "form_name": "demo",
                    "page_url": "/demo",
                }
            ],
        )
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 1
        assert items[0]["action"] == "created"
        assert items[0]["matched_on"] is None
        after = seeded_db_session.query(Lead).count()
        assert after == before + 1


class TestIngestUpdate:
    def test_ingest_existing_email(self, client, seeded_db_session):
        from app.models import Lead

        known_email = "joond@huanganalytics.co"
        existing = seeded_db_session.query(Lead).filter(Lead.email == known_email).first()
        assert existing is not None, "Expected known email to exist"
        before = seeded_db_session.query(Lead).count()
        r = client.post(
            "/leads/ingest",
            json=[
                {
                    "name": "Updated Name",
                    "email": known_email,
                    "phone": "+99 000 0000 000",
                    "company": "Huang Analytics",
                    "country": "Singapore",
                    "message": "ingested message",
                    "submitted_at": "2026-02-01T00:00:00Z",
                    "form_id": "f_1",
                    "form_name": "Contact",
                    "page_url": "/contact",
                }
            ],
        )
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 1
        assert items[0]["action"] == "updated"
        assert items[0]["matched_on"] in {"email", "both"}
        after = seeded_db_session.query(Lead).count()
        assert after == before
