"""Shared API error base + envelope handler.

Every raised error carries a stable SNAKE_CODE so the frontend can key messages
off it (see specs/06-api-contract.md). DRF built-ins are mapped to codes too.
Domain codes live in each app (accounts/exceptions.py, events/exceptions.py).
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.views import exception_handler


class CodedError(APIException):
    code = "REQUEST_FAILED"
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Request failed."

    def __init__(self, message=None, fields=None):
        super().__init__(detail=message or self.default_detail)
        self.fields = fields


def envelope_exception_handler(exc, context):
    """Convert every DRF error into the { error: { code, message } } envelope."""
    response = exception_handler(exc, context)
    if response is None:  # non-DRF exception: let Django/DRF default handling apply
        return None

    if isinstance(exc, CodedError):
        body = {"code": exc.code, "message": str(exc.detail)}
        if getattr(exc, "fields", None):
            body["fields"] = exc.fields
    elif isinstance(exc, (DRFValidationError, DjangoValidationError)):
        # Serializer / model validation -> 422 + field map (matches frontend).
        response.status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
        body = {
            "code": "VALIDATION_ERROR",
            "message": "Some fields are invalid.",
            "fields": response.data,
        }
    else:
        mapping = {
            status.HTTP_400_BAD_REQUEST: "BAD_REQUEST",
            status.HTTP_401_UNAUTHORIZED: "UNAUTHENTICATED",
            status.HTTP_403_FORBIDDEN: "FORBIDDEN",
            status.HTTP_404_NOT_FOUND: "NOT_FOUND",
            status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
            status.HTTP_429_TOO_MANY_REQUESTS: "RATE_LIMITED",
        }
        detail = response.data.get("detail", "Request failed.")
        body = {
            "code": mapping.get(response.status_code, "REQUEST_FAILED"),
            "message": str(detail),
        }
    response.data = {"error": body}
    return response
