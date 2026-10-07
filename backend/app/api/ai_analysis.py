import uuid

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.repositories.ai_analysis_repository import AIAnalysisRepository
from app.services.summarization_service import SummarizationService
from app.models.enums import AIAnalysisRunStatus
from app.schemas.ai_analysis import (
    AIAnalysisResponse,
    AIAnalysisRunResponse,
    AIAnalysisListResponse,
    AIRunListResponse,
)

router = APIRouter(tags=["AI Analysis"])

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 20


# Dependency to get service per request
def get_summarization_service(db: Session = Depends(get_db)) -> SummarizationService:
    return SummarizationService(db)


@router.get(
    "/api/ai-analysis",
    response_model=AIAnalysisListResponse,
    summary="List AI analyses",
    description="Return all generated AI analyses with pagination and the total count.",
)
def list_ai_analyses(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(
        DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        description="Number of items per page (max 100)",
    ),
    db: Session = Depends(get_db),
) -> AIAnalysisListResponse:
    repo = AIAnalysisRepository(db)
    items, total = repo.list_all(page=page, page_size=page_size)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return AIAnalysisListResponse(
        items=[AIAnalysisResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "/api/cases/{case_id}/summarize",
    response_model=AIAnalysisResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate case summary",
    description="Generate an AI-powered structured analysis for the specified case.",
    responses={
        201: {"description": "Case summary generated successfully"},
        404: {"description": "Case not found"},
        422: {"description": "Cannot summarize a case with no conversations"},
        502: {"description": "AI provider failed"},
    },
)
def generate_case_summary(
    case_id: uuid.UUID,
    service: SummarizationService = Depends(get_summarization_service),
) -> AIAnalysisResponse:
    analysis = service.summarize_case(case_id)
    return AIAnalysisResponse.model_validate(analysis)


@router.get(
    "/api/cases/{case_id}/analysis",
    response_model=AIAnalysisListResponse,
    summary="Get AI analyses for a case",
    description="Return AI analyses generated for the case with pagination.",
    responses={
        200: {"description": "List of AI analyses"},
        404: {"description": "Case not found"},
    },
)
def get_case_analyses(
    case_id: uuid.UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(
        DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        description="Number of items per page (max 100)",
    ),
    db: Session = Depends(get_db),
) -> AIAnalysisListResponse:
    repo = AIAnalysisRepository(db)
    items, total = repo.list_by_case(case_id=case_id, page=page, page_size=page_size)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return AIAnalysisListResponse(
        items=[AIAnalysisResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/api/ai-analysis/{analysis_id}",
    response_model=AIAnalysisResponse,
    summary="Get a specific AI analysis",
    description="Retrieve a single AI analysis by UUID.",
    responses={
        200: {"description": "AI analysis found"},
        404: {"description": "AI analysis not found"},
    },
)
def get_ai_analysis(
    analysis_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> AIAnalysisResponse:
    repo = AIAnalysisRepository(db)
    analysis = repo.get_by_id(analysis_id)
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI analysis not found.",
        )
    return AIAnalysisResponse.model_validate(analysis)


@router.get(
    "/api/cases/{case_id}/analysis/runs",
    response_model=AIRunListResponse,
    summary="Get AI analysis runs for a case",
    description="Expose AI execution history for a case with pagination.",
    responses={
        200: {"description": "List of AI analysis runs"},
        404: {"description": "Case not found"},
    },
)
def get_case_analysis_runs(
    case_id: uuid.UUID,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(
        DEFAULT_PAGE_SIZE,
        ge=1,
        le=MAX_PAGE_SIZE,
        description="Number of items per page (max 100)",
    ),
    db: Session = Depends(get_db),
) -> AIRunListResponse:
    repo = AIAnalysisRepository(db)
    items, total = repo.list_runs_by_case(case_id=case_id, page=page, page_size=page_size)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    return AIRunListResponse(
        items=[AIAnalysisRunResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )