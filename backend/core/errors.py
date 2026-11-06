"""Application errors that map cleanly to HTTP responses.

Services raise these; main.py turns them into JSON like
{"detail": "...", "code": "..."} with the right status code.
"""


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class AuthError(AppError):
    status_code = 401
    code = "unauthorized"


class ValidationFailed(AppError):
    status_code = 422
    code = "validation_failed"


class LimitExceeded(AppError):
    status_code = 429
    code = "limit_exceeded"


class AIServiceError(AppError):
    """The AI provider failed or returned unusable output."""

    status_code = 502
    code = "ai_error"


class ConfigurationError(AppError):
    status_code = 503
    code = "not_configured"


class DatabaseError(AppError):
    status_code = 502
    code = "database_error"
