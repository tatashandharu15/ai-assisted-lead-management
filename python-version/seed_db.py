from __future__ import annotations

import os
import sys
from collections import Counter
from pathlib import Path

try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent / ".env"
    if _env_path.exists():
        load_dotenv(_env_path, override=False)
except ImportError:
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import Base, SessionLocal, engine
from app.models import Lead
from app.services.cleaner import load_and_clean_csv


def main():
    csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "leads_seed.csv")
    csv_path = os.path.normpath(csv_path)
    rows = load_and_clean_csv(csv_path)
    print(f"Rows loaded: {len(rows)}")

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        from sqlalchemy import insert

        db.execute(insert(Lead), rows)
        db.commit()

        total = db.query(Lead).count()
        print(f"Rows inserted: {total}")

        status_counter: Counter = Counter()
        owner_counter: Counter = Counter()
        for lead in db.query(Lead).all():
            status_counter[lead.lead_status] += 1
            owner_counter[lead.contact_owner] += 1

        print(f"Status counts: {dict(sorted(status_counter.items()))}")
        print(f"Owner counts: {dict(sorted(owner_counter.items()))}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
