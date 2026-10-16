"""Account-domain error codes (base + envelope in config.exceptions)."""

from rest_framework import status

from config.exceptions import CodedError


class EmailExistsError(CodedError):
    code = "EMAIL_EXISTS"
    status_code = status.HTTP_409_CONFLICT
    default_detail = "An account with this email already exists."


class RoleNotAllowedError(CodedError):
    code = "ROLE_NOT_ALLOWED"
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "Public registration creates attendee accounts only."


class InvalidCredentialsError(CodedError):
    code = "INVALID_CREDENTIALS"
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Incorrect email or password."


class AccountSuspendedError(CodedError):
    code = "ACCOUNT_SUSPENDED"
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "This account has been suspended."


class InvitationInvalidError(CodedError):
    code = "INVITATION_INVALID"
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "This invitation link is not valid."


class InvitationExpiredError(CodedError):
    code = "INVITATION_EXPIRED"
    status_code = status.HTTP_410_GONE
    default_detail = "This invitation has expired. Ask for a new one."


class InvitationUsedError(CodedError):
    code = "INVITATION_USED"
    status_code = status.HTTP_410_GONE
    default_detail = "This invitation has already been used."


class InvitationRevokedError(CodedError):
    code = "INVITATION_REVOKED"
    status_code = status.HTTP_410_GONE
    default_detail = "This invitation was revoked. Ask for a new one."


class InvitationLoginRequiredError(CodedError):
    code = "INVITATION_LOGIN_REQUIRED"
    status_code = status.HTTP_409_CONFLICT
    default_detail = (
        "This email already has an account. Log in first, then accept "
        "the invitation to upgrade it."
    )


class InvitationEmailMismatchError(CodedError):
    code = "INVITATION_EMAIL_MISMATCH"
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "This invitation was issued for a different email address."
