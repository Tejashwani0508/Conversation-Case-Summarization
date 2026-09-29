import time
from typing import Optional
from uuid import UUID

from fastapi import HTTPException

from app.config.settings import settings
from app.repositories.ai_analysis_repository import AIAnalysisRepository
from app.repositories.case_repository import CaseRepository
from app.services.conversation_service import ConversationService
from app.services.ai_provider import AIProvider, OpenRouterProvider, get_provider
from app.models.ai_analysis import AIAnalysis
from app.models.ai_run import AIAnalysisRun
from app.models.enums import AIAnalysisRunStatus
from app.schemas.ai_analysis import AISummaryOutput


class SummarizationService:
    """Orchestrates case summarization: conversation history → AI provider → DB records."""

    def __init__(self, db, provider: Optional[AIProvider] = None) -> None:
        self.db = db
        self.case_repo = CaseRepository(db)
        self.conv_service = ConversationService(db)
        self.ai_repo = AIAnalysisRepository(db)
        try:
            self.provider = provider or get_provider()
        except ValueError:
            self.provider = OpenRouterProvider(
                api_key="",
                model=settings.openrouter_model or "openrouter/free",
            )

    def summarize_case(self, case_id: UUID) -> AIAnalysis:
        """Summarize a case by fetching conversation history, calling the AI provider,
        and persisting AIAnalysis + AIAnalysisRun in a single transaction."""

        # 1. Validate that the case exists
        case = self.case_repo.get_by_id(case_id)
        if case is None:
            raise HTTPException(
                status_code=404,
                detail="Case not found.",
            )

        # 2. Retrieve the complete conversation history
        conversations = self.conv_service.get_case_conversation_history(case_id)

        # 3. Handle EMPTY conversation history deterministically
        if not conversations:
            raise HTTPException(
                status_code=422,
                detail="Cannot summarize a case with no conversations.",
            )

        # 4. Format the conversation for the AI provider
        conversation_lines: list[str] = []
        for conv in conversations:
            # conv.timestamp is timezone-aware datetime
            ts = conv.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            sender_label = conv.sender_type.value  # "CUSTOMER" or "AGENT"
            sender_name = conv.sender_name or ""
            message = conv.message
            conversation_lines.append(
                f"[{ts}] {sender_label} ({sender_name}): {message}"
            )

        # 5. Measure processing time
        start_time = time.perf_counter()

        # 6. Call the AI provider
        try:
            if self.provider.requires_key:
                raise ValueError("OpenRouter API key is not configured.")
            if not self.provider.model:
                raise ValueError("OpenRouter model is not configured.")
            output: AISummaryOutput = self.provider.summarize_conversation(conversation_lines)
        except Exception as exc:
            # AI failure handling
            processing_time_ms = int((time.perf_counter() - start_time) * 1000)
            processing_time_ms = max(0, processing_time_ms)

            # Roll back any pending database changes
            self.db.rollback()

            # Create a FAILED AIAnalysisRun
            error_message = str(exc) if str(exc) else "OpenRouter provider failed"
            if self.provider.api_key:
                error_message = error_message.replace(self.provider.api_key, "[REDACTED]")

            run = AIAnalysisRun(
                case_id=case_id,
                model_name=settings.openrouter_model or None,
                prompt_version=getattr(self.provider, "model", None) or "v1",
                input_message_count=len(conversations),
                processing_time_ms=processing_time_ms,
                status=AIAnalysisRunStatus.FAILED,
                error_message=error_message,
            )
            try:
                self.ai_repo.create_run(run)
                self.db.commit()
            except Exception:
                self.db.rollback()
                raise

            # Do NOT create AIAnalysis — only the failed run
            raise HTTPException(
                status_code=502,
                detail="AI provider failed. The case has not been summarized.",
            )

        processing_time_ms = int((time.perf_counter() - start_time) * 1000)
        processing_time_ms = max(0, processing_time_ms)

        # 7. Create AIAnalysis
        model_name = settings.openrouter_model or getattr(self.provider, "model", None) or "unknown"

        analysis = AIAnalysis(
            case_id=case_id,
            summary=output.summary,
            issue=output.issue,
            category=output.category,
            sentiment=output.sentiment,
            sentiment_score=output.sentiment_score,
            ai_priority=output.ai_priority,
            key_details=output.key_details,
            actions_taken=output.actions_taken,
            pending_actions=output.pending_actions,
            recommended_action=output.recommended_action,
            model_name=model_name,
            prompt_version=getattr(self.provider, "model", None) or "v1",
        )

        # 8. Create AIAnalysisRun
        run = AIAnalysisRun(
            case_id=case_id,
            model_name=model_name,
            prompt_version=getattr(self.provider, "model", None) or "v1",
            input_message_count=len(conversations),
            processing_time_ms=processing_time_ms,
            status=AIAnalysisRunStatus.SUCCESS,
            error_message=None,
        )

        # 9. Persist BOTH records in ONE transaction
        try:
            self.ai_repo.create(analysis)
            self.ai_repo.create_run(run)
            self.db.commit()

            self.db.refresh(analysis)
            self.db.refresh(run)
        except Exception:
            self.db.rollback()
            raise

        return analysis