from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config.settings import settings

engine = create_engine(
    settings.database_url,
    future=True,
    echo=False,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    future=True,
)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session and ensure it is closed safely."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()