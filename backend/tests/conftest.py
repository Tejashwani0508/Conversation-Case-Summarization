import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.connection import get_db
from app.main import app

# Use a dedicated test database, never the development database.
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg2://postgres:teju123@localhost:5432/conversation_case_summarization_test",
)

test_engine = create_engine(TEST_DATABASE_URL, future=True)
TestSessionLocal = sessionmaker(
    bind=test_engine, autoflush=False, autocommit=False, future=True
)


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all tables in the test database once per test session."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture()
def db_session():
    """Provide a clean database session for each test."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    """Provide a TestClient with the get_db dependency overridden."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def clean_tables(db_session):
    """Delete all rows from tables before each test to ensure isolation."""
    from app.models import AIAnalysis, AIAnalysisRun, Conversation, Customer, CustomerCase

    for model in (AIAnalysisRun, AIAnalysis, Conversation, CustomerCase, Customer):
        db_session.query(model).delete()
    db_session.commit()
    yield