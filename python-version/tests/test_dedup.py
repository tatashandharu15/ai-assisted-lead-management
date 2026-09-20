from __future__ import annotations

import time


class TestDedup:
    def test_blocking_pairs_count(self, seeded_db_session):
        from app.services.dedup import find_dedupe_candidates

        _, pairs = find_dedupe_candidates(session=seeded_db_session, min_confidence=0.0, limit=None)
        assert len(pairs) < 5000, f"Too many pairs: {len(pairs)}"

    def test_known_dup_high_confidence(self, seeded_db_session):
        from app.models import Lead
        from app.services.dedup import find_dedupe_candidates

        lead_a = seeded_db_session.query(Lead).filter(Lead.record_id == "100234834").first()
        lead_b = seeded_db_session.query(Lead).filter(Lead.record_id == "100234835").first()
        assert lead_a is not None
        assert lead_b is not None

        groups, _ = find_dedupe_candidates(session=seeded_db_session, min_confidence=0.5, limit=None)
        found = False
        for g in groups:
            if lead_a.id in g["lead_ids"] and lead_b.id in g["lead_ids"]:
                assert g["confidence"] >= 0.8, f"confidence too low: {g['confidence']}"
                found = True
                break
        assert found, "Known dup pair not grouped together"

    def test_dedup_runtime(self, seeded_db_session):
        from app.services.dedup import find_dedupe_candidates

        t0 = time.perf_counter()
        find_dedupe_candidates(session=seeded_db_session, min_confidence=0.7, limit=None)
        dt = time.perf_counter() - t0
        assert dt < 30, f"Dedup took {dt:.2f}s > 30s"
