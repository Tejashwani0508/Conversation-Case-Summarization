import os
from typing import Optional

from openai import OpenAI

from app.config.settings import settings
from app.schemas.ai_analysis import AISummaryOutput


class AIProvider:
    """Abstract base class for AI providers.

    Responsibility: Receive chronological conversation data and return a
    validated AISummaryOutput. The provider itself does not persist
    records, query the database, or contain business logic.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None) -> None:
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self.model = model or os.environ.get("OPENAI_MODEL", "")

    @property
    def requires_key(self) -> bool:
        return not bool(self.api_key)


class OpenAIProvider(AIProvider):
    """OpenAI-specific implementation of the AIProvider abstraction."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None) -> None:
        super().__init__(api_key=api_key, model=model)
        if not self.requires_key and not self.api_key:
            # If no key was passed and env var is missing, we still allow
            # construction so callers can check requires_key() before calling.
            pass
        self.client = OpenAI(api_key=self.api_key) if self.api_key else OpenAI()

    def summarize_conversation(
        self, conversation_history: list[str],
    ) -> AISummaryOutput:
        """Receive chronological conversation data and return a validated AISummaryOutput.

        Args:
            conversation_history: List of pre-formatted conversation lines
                (e.g. "[2026-08-13 10:00] CUSTOMER (John): My electricity bill is unusually high.")

        Returns:
            AISummaryOutput: Validated summary output.

        Raises:
            ValueError: If the OpenAI API key is not configured.
        """
        if self.requires_key:
            raise ValueError("OpenAI API key is not configured.")

        # Build the system prompt and user prompt from the conversation history
        system_prompt = (
            "You are an AI case summarization assistant. "
            "Produce exactly the JSON fields requested below. "
            "Use only the supplied conversation — do not invent facts. "
            "Preserve the distinction between customer and agent. "
            "Produce a concise case summary. Identify the issue. "
            "Identify actions already taken. Identify unresolved/pending actions. "
            "Recommend a next action based only on the conversation. "
            "Determine category, sentiment and priority from the conversation. "
            "Return the required structured fields. "
            "If information is unavailable, say so rather than fabricate it."
        )

        user_prompt = (
            "Conversation:\n" + "\n".join(conversation_history) + "\n"
        )

        response = self.client.beta.chat.completions.parse(
            model=self.model or settings.openai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format=AISummaryOutput,
        )

        # The parsed content is already validated by the AISummaryOutput schema
        return response.choices[0].message.parsed


# Convenience factory
def get_provider() -> OpenAIProvider:
    """Factory that reads settings and returns a configured OpenAIProvider."""
    key = settings.openai_api_key or os.environ.get("OPENAI_API_KEY", "")
    model = settings.openai_model or os.environ.get("OPENAI_MODEL", "")
    if not key:
        raise ValueError("OpenAI API key is not configured.")
    return OpenAIProvider(api_key=key, model=model)