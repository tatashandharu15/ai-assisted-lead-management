from __future__ import annotations

import os
import sys
from collections import Counter

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from app.db import Base, get_db
from app.main import app
from app.models import Lead
from app.services.cleaner import load_and_clean_csv

TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="session")
def cleaned_seed_rows():
    csv_path = os.path.join(ROOT, "..", "data", "leads_seed.csv")
    csv_path = os.path.normpath(csv_path)
    return load_and_clean_csv(csv_path)


@pytest.fixture(scope="function")
def db_session():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def seeded_db_session(db_session, cleaned_seed_rows):
    from sqlalchemy import insert

    db_session.execute(insert(Lead), cleaned_seed_rows)
    db_session.commit()
    return db_session


@pytest.fixture(scope="function")
def client(seeded_db_session):
    def override_get_db():
        try:
            yield seeded_db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
