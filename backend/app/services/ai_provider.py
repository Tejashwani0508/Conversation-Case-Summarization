import json
import os
from typing import Optional

from openai import OpenAI

from app.config.settings import settings
from app.schemas.ai_analysis import AISummaryOutput

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class AIProvider:
    """Abstract base class for AI providers.

    Responsibility: Receive chronological conversation data and return a
    validated AISummaryOutput. The provider itself does not persist
    records, query the database, or contain business logic.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None) -> None:
        self.api_key = (
            api_key
            or settings.openrouter_api_key
            or os.environ.get("OPENROUTER_API_KEY")
            or ""
        ).strip()
        self.model = (
            model
            or settings.openrouter_model
            or os.environ.get("OPENROUTER_MODEL")
            or "openrouter/free"
        ).strip()

    @property
    def requires_key(self) -> bool:
        return not bool(self.api_key)


class OpenRouterProvider(AIProvider):
    """OpenRouter implementation using its OpenAI-compatible API."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None) -> None:
        super().__init__(api_key=api_key, model=model)
        if not self.api_key:
            self.client = None
        else:
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=OPENROUTER_BASE_URL,
            )

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
            ValueError: If the OpenRouter API key is not configured.
        """
        if self.requires_key:
            raise ValueError("OpenRouter API key is not configured.")
        if not self.model:
            raise ValueError("OpenRouter model is not configured.")
        if self.client is None:
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=OPENROUTER_BASE_URL,
            )

        system_prompt = (
            "You are an AI case summarization assistant. "
            "Return only one valid JSON object conforming to this JSON schema: "
            f"{json.dumps(AISummaryOutput.model_json_schema())}. "
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

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        if not response.choices:
            raise ValueError("OpenRouter returned no completion choices.")
        content = response.choices[0].message.content
        if not content:
            raise ValueError("OpenRouter returned empty message content.")
        content = content.strip()
        if content.startswith("```") and content.endswith("```"):
            content = "\n".join(content.splitlines()[1:-1]).strip()
        return AISummaryOutput.model_validate_json(content)


# Convenience factory
def get_provider() -> OpenRouterProvider:
    """Factory that reads settings and returns a configured OpenRouter provider."""
    key = settings.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY", "")
    model = settings.openrouter_model or os.environ.get("OPENROUTER_MODEL", "openrouter/free")
    if not key:
        raise ValueError("OpenRouter API key is not configured.")
    return OpenRouterProvider(api_key=key, model=model)