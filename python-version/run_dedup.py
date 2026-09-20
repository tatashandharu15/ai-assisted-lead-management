from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.services.dedup import find_dedupe_candidates


def main():
    db = SessionLocal()
    try:
        groups, pairs = find_dedupe_candidates(session=db, min_confidence=0.7, limit=30)
        print(f"Blocking candidate pairs: {len(pairs)}")
        print(f"Groups found: {len(groups)}")
        for g in groups[:30]:
            print(
                f"Group #{g['group_id']} conf={g['confidence']:.3f} "
                f"ids={g['lead_ids']} exp={g['explanation']}"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
