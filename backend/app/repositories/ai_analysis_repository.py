import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.ai_analysis import AIAnalysis
from app.models.ai_run import AIAnalysisRun


class AIAnalysisRepository:
    """Data access layer for AIAnalysis and AIAnalysisRun records."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, analysis_id: uuid.UUID) -> AIAnalysis | None:
        return self.db.get(AIAnalysis, analysis_id)

    def create(self, analysis: AIAnalysis) -> AIAnalysis:
        """Stage a new AIAnalysis for creation.

        Commit/refresh is handled by the service layer, matching the
        existing repository transaction convention.
        """
        self.db.add(analysis)
        return analysis

    def get_run_by_id(self, run_id: uuid.UUID) -> AIAnalysisRun | None:
        return self.db.get(AIAnalysisRun, run_id)

    def create_run(self, run: AIAnalysisRun) -> AIAnalysisRun:
        """Stage a new AIAnalysisRun for creation.

        Commit/refresh is handled by the service layer, matching the
        existing repository transaction convention.
        """
        self.db.add(run)
        return run

    def list_by_case(
        self,
        *,
        case_id: uuid.UUID,
        page: int,
        page_size: int,
    ) -> tuple[list[AIAnalysis], int]:
        """Return a page of AI analyses for a case and the total count.

        Ordered by created_at DESC with a secondary deterministic
        ordering by id DESC.
        """
        base_stmt = select(AIAnalysis).where(AIAnalysis.case_id == case_id)

        total = self.db.scalar(
            select(func.count()).select_from(base_stmt.subquery())
        ) or 0

        stmt = (
            base_stmt.order_by(
                AIAnalysis.created_at.desc(),
                AIAnalysis.id.desc(),
            )
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.scalars(stmt).all())

        return items, total

    def count_by_case(self, case_id: uuid.UUID) -> int:
        """Return the total count of AI analyses belonging to the case."""
        stmt = (
            select(func.count())
            .select_from(AIAnalysis)
            .where(AIAnalysis.case_id == case_id)
        )
        return self.db.scalar(stmt) or 0

    def list_all(
        self,
        *,
        page: int,
        page_size: int,
    ) -> tuple[list[AIAnalysis], int]:
        """Return a globally ordered page of analyses and the full count."""
        base_stmt = select(AIAnalysis)
        total = self.db.scalar(
            select(func.count()).select_from(AIAnalysis)
        ) or 0
        stmt = (
            base_stmt.order_by(AIAnalysis.created_at.desc(), AIAnalysis.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(self.db.scalars(stmt).all()), total

    def list_runs_by_case(
        self,
        *,
        case_id: uuid.UUID,
        page: int,
        page_size: int,
    ) -> tuple[list[AIAnalysisRun], int]:
        """Return a page of AI analysis runs for a case and the total count.

        Ordered by created_at DESC with a secondary deterministic
        ordering by id DESC.
        """
        base_stmt = select(AIAnalysisRun).where(AIAnalysisRun.case_id == case_id)

        total = self.db.scalar(
            select(func.count()).select_from(base_stmt.subquery())
        ) or 0

        stmt = (
            base_stmt.order_by(
                AIAnalysisRun.created_at.desc(),
                AIAnalysisRun.id.desc(),
            )
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = list(self.db.scalars(stmt).all())

        return items, total