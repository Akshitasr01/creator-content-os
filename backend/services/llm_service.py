"""The single entry point for every AI call (PDF step 10).

Generators never import the OpenAI SDK directly. They call
`LLMService.generate_structured(...)`, which:

* picks the provider from AI_PROVIDER ("openai" or "mock") - one switch
  turns all AI features to free demo mode,
* keeps the API key on the backend only,
* centralises timeouts, retries and output validation,
* reports token usage for limits and cost tracking.

Mock mode returns clearly labelled demo output (provider = "mock"); it is
never presented as real AI generation.
"""

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Callable, Generic, TypeVar

from pydantic import BaseModel, ValidationError

from core.config import Settings, get_settings
from core.errors import AIServiceError, ConfigurationError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

MOCK_MODEL_NAME = "demo-mock"
# Retries for *invalid output*. Network retries are handled by the SDK.
MAX_VALIDATION_ATTEMPTS = 2


@dataclass
class LLMResult(Generic[T]):
    data: T
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0.0


UsageCallback = Callable[[LLMResult, str, str | None], None]


@lru_cache
def _openai_client(api_key: str, timeout: float):
    from openai import OpenAI  # imported lazily so mock mode needs no key

    return OpenAI(api_key=api_key, timeout=timeout, max_retries=2)


class LLMService:
    def __init__(self, settings: Settings | None = None, on_usage: UsageCallback | None = None):
        self.settings = settings or get_settings()
        self.on_usage = on_usage

        if self.settings.ai_provider not in ("openai", "mock"):
            raise ConfigurationError(
                f"Unknown AI_PROVIDER '{self.settings.ai_provider}'. Use 'openai' or 'mock'."
            )

    @property
    def provider(self) -> str:
        return self.settings.ai_provider

    @property
    def model(self) -> str:
        return self.settings.openai_model if self.provider == "openai" else MOCK_MODEL_NAME

    def generate_structured(
        self,
        *,
        operation: str,
        system: str,
        user: str,
        schema: type[T],
        mock_factory: Callable[[], T],
        project_id: str | None = None,
    ) -> LLMResult[T]:
        """Return a validated instance of `schema`.

        `mock_factory` builds the labelled demo output used when AI_PROVIDER=mock.
        """
        if self.provider == "mock":
            result = LLMResult(data=mock_factory(), provider="mock", model=MOCK_MODEL_NAME)
        else:
            result = self._openai_structured(system, user, schema)

        if self.on_usage:
            self.on_usage(result, operation, project_id)
        return result

    # -- OpenAI -------------------------------------------------------------

    def _openai_structured(self, system: str, user: str, schema: type[T]) -> LLMResult[T]:
        if not self.settings.openai_api_key or not self.settings.openai_model:
            raise ConfigurationError(
                "AI_PROVIDER is 'openai' but OPENAI_API_KEY or OPENAI_MODEL is missing in backend/.env."
            )

        import openai

        client = _openai_client(self.settings.openai_api_key, self.settings.openai_timeout_seconds)
        input_tokens = output_tokens = 0
        last_error = "The AI returned an invalid response."

        for attempt in range(1, MAX_VALIDATION_ATTEMPTS + 1):
            try:
                response = client.responses.parse(
                    model=self.settings.openai_model,
                    input=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    text_format=schema,
                )
            except openai.AuthenticationError as error:
                raise ConfigurationError("The OpenAI API key was rejected. Check OPENAI_API_KEY.") from error
            except openai.NotFoundError as error:
                raise ConfigurationError(
                    f"OpenAI model '{self.settings.openai_model}' was not found. Check OPENAI_MODEL."
                ) from error
            except openai.RateLimitError as error:
                raise AIServiceError(
                    "The AI provider is rate-limiting requests or the account is out of credit. Try again shortly."
                ) from error
            except openai.APITimeoutError as error:
                raise AIServiceError("The AI provider timed out. Please try again.") from error
            except ValidationError:
                logger.warning("AI output failed validation (attempt %s)", attempt)
                continue
            except openai.APIError as error:
                logger.warning("OpenAI API error: %s", type(error).__name__)
                raise AIServiceError("The AI provider returned an error. Please try again.") from error

            usage = getattr(response, "usage", None)
            if usage is not None:
                input_tokens += getattr(usage, "input_tokens", 0) or 0
                output_tokens += getattr(usage, "output_tokens", 0) or 0

            parsed = response.output_parsed
            if parsed is not None:
                return LLMResult(
                    data=parsed,
                    provider="openai",
                    model=self.settings.openai_model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    estimated_cost_usd=self._estimate_cost(input_tokens, output_tokens),
                )
            last_error = "The AI response was empty or refused."
            logger.warning("AI returned no parsed output (attempt %s)", attempt)

        raise AIServiceError(f"{last_error} Please try again.")

    def _estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        return round(
            input_tokens / 1_000_000 * self.settings.openai_input_cost_per_1m
            + output_tokens / 1_000_000 * self.settings.openai_output_cost_per_1m,
            6,
        )
