"""Auth + organizer-invitation endpoints (specs/06-api-contract.md)."""

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import transaction
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from . import emails
from .exceptions import (
    AccountSuspendedError,
    CodedError,
    InvalidCredentialsError,
    InvitationEmailMismatchError,
    InvitationExpiredError,
    InvitationInvalidError,
    InvitationLoginRequiredError,
    InvitationRevokedError,
    InvitationUsedError,
    RoleNotAllowedError,
)
from .models import OrganizerInvitation, User
from .permissions import IsAdminRole
from .serializers import (
    InvitationAcceptSerializer,
    InvitationCreateSerializer,
    InvitationSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
)


class AuthThrottle(AnonRateThrottle):
    """10/min for auth endpoints (see DEFAULT_THROTTLE_RATES['auth']).

    NOTE: must subclass AnonRateThrottle, not ScopedRateThrottle —
    the latter reads the scope from `view.throttle_scope`, which function
    views don't have, silently disabling throttling.
    """

    scope = "auth"


def _user_payload(user) -> dict:
    return {"user": UserSerializer(user).data}


# ---------------------------------------------------------------- auth ----


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def register(request):
    if "role" in request.data and request.data.get("role") != User.Role.ATTENDEE:
        raise RoleNotAllowedError()
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    login(request, user)  # auto-login preserves current frontend behavior
    return Response(_user_payload(user), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].lower()
    user = authenticate(request, username=email,
                        password=serializer.validated_data["password"])
    if user is None:
        # Distinguish suspension (403) from bad credentials (400) without
        # leaking which emails exist: only named accounts get the 403 branch.
        existing = get_user_model().objects.filter(email=email).first()
        if existing is not None and existing.status != existing.Status.ACTIVE:
            raise AccountSuspendedError()
        raise InvalidCredentialsError()
    login(request, user)  # rotates the session key
    return Response(_user_payload(user))


@api_view(["POST"])
def logout_view(request):
    logout(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def me(request):
    """Session bootstrap: safe to call on every page load; also (re)issues
    the `csrftoken` cookie the SPA sends back as X-CSRFToken on mutations."""
    user = request.user
    if not user.is_authenticated or getattr(user, "status", None) != user.Status.ACTIVE:
        return Response({"user": None})
    return Response(_user_payload(user))


# ------------------------------------------------------- invitations ----


def _lookup_invitation(raw_token: str) -> OrganizerInvitation:
    try:
        return OrganizerInvitation.objects.get(
            token_hash=OrganizerInvitation.hash_token(raw_token)
        )
    except OrganizerInvitation.DoesNotExist:
        raise InvitationInvalidError() from None


def _check_usable(inv: OrganizerInvitation) -> None:
    """Read-only state check (no writes: callers inside transactions must not
    partially persist on the error path)."""
    if inv.status == OrganizerInvitation.Status.ACCEPTED:
        raise InvitationUsedError()
    if inv.status == OrganizerInvitation.Status.REVOKED:
        raise InvitationRevokedError()
    if inv.status == OrganizerInvitation.Status.EXPIRED or inv.is_expired:
        raise InvitationExpiredError()


@api_view(["GET", "POST"])
@permission_classes([IsAdminRole])
def invitations(request):
    """GET = list (optionally ?status=); POST = create + send (specs/06)."""
    if request.method == "GET":
        qs = OrganizerInvitation.objects.all().order_by("-created_at")
        wanted = request.query_params.get("status")
        if wanted:
            qs = qs.filter(status=wanted)
        return Response(InvitationSerializer(qs, many=True).data)

    serializer = InvitationCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].lower()
    with transaction.atomic():
        # Replacement policy: revoke the prior PENDING invitation for this
        # email so exactly one usable link exists at a time.
        OrganizerInvitation.objects.filter(
            email=email, status=OrganizerInvitation.Status.PENDING
        ).update(status=OrganizerInvitation.Status.REVOKED)
        raw_token = OrganizerInvitation.generate_token()
        inv = OrganizerInvitation.objects.create(
            email=email,
            token_hash=OrganizerInvitation.hash_token(raw_token),
            created_by=request.user,
        )
    inv.email_sent = emails.send_invitation_email(email, raw_token)
    inv.save(update_fields=["email_sent"])
    data = InvitationSerializer(inv).data
    data["email_sent"] = inv.email_sent
    if not inv.email_sent:
        data["warning"] = (
            "Email delivery failed; the invitation is still usable. "
            "Resend it or share a replacement link manually."
        )
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAdminRole])
def invitation_resend(request, pk):
    try:
        inv = OrganizerInvitation.objects.get(pk=pk)
    except OrganizerInvitation.DoesNotExist:
        raise InvitationInvalidError() from None
    if inv.status != OrganizerInvitation.Status.PENDING or inv.is_expired:
        raise InvitationExpiredError()
    # NOTE: the raw token cannot be re-sent (only its hash is stored), so a
    # resend rotates to a fresh token; the old link stops working.
    with transaction.atomic():
        inv_locked = OrganizerInvitation.objects.select_for_update().get(pk=pk)
        if inv_locked.status != OrganizerInvitation.Status.PENDING:
            raise InvitationUsedError()
        raw_token = OrganizerInvitation.generate_token()
        inv_locked.token_hash = OrganizerInvitation.hash_token(raw_token)
        inv_locked.save(update_fields=["token_hash"])
    inv_locked.email_sent = emails.send_invitation_email(inv_locked.email, raw_token)
    inv_locked.save(update_fields=["email_sent"])
    data = InvitationSerializer(inv_locked).data
    data["email_sent"] = inv_locked.email_sent
    return Response(data)


@api_view(["POST"])
@permission_classes([IsAdminRole])
def invitation_revoke(request, pk):
    updated = OrganizerInvitation.objects.filter(
        pk=pk, status=OrganizerInvitation.Status.PENDING
    ).update(status=OrganizerInvitation.Status.REVOKED)
    if not updated:
        raise InvitationInvalidError()
    return Response({"revoked": True})


@api_view(["GET"])
@permission_classes([AllowAny])
def invitation_validate(request):
    raw_token = request.query_params.get("token", "")
    if not raw_token:
        raise InvitationInvalidError()
    inv = _lookup_invitation(raw_token)
    try:
        _check_usable(inv)
    except CodedError as exc:
        # Validation endpoint reports state with 200 + valid:false for
        # expired/used/revoked (the accept endpoint uses 4xx/410).
        if isinstance(exc, InvitationInvalidError):
            raise
        return Response(
            {"valid": False, "email": inv.email,
             "code": exc.code, "message": str(exc.detail)}
        )
    return Response({"valid": True, "email": inv.email,
                     "expires_at": inv.expires_at})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def invitation_accept(request):
    serializer = InvitationAcceptSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    raw_token = serializer.validated_data["token"]
    wanted_hash = OrganizerInvitation.hash_token(raw_token)

    # Expiry flip happens in autocommit (outside the consume transaction) so a
    # later rollback cannot resurrect an expired PENDING row.
    try:
        seen = OrganizerInvitation.objects.get(token_hash=wanted_hash)
    except OrganizerInvitation.DoesNotExist:
        raise InvitationInvalidError() from None
    if seen.status == OrganizerInvitation.Status.PENDING and seen.is_expired:
        OrganizerInvitation.objects.filter(
            pk=seen.pk, status=OrganizerInvitation.Status.PENDING
        ).update(status=OrganizerInvitation.Status.EXPIRED)
        raise InvitationExpiredError()

    with transaction.atomic():
        try:
            inv = OrganizerInvitation.objects.select_for_update().get(
                token_hash=wanted_hash
            )
        except OrganizerInvitation.DoesNotExist:
            raise InvitationInvalidError() from None
        _check_usable(inv)  # single-use: concurrent accepts serialize here
        requester = request.user if request.user.is_authenticated else None
        existing = get_user_model().objects.filter(email=inv.email).first()

        if existing is not None:
            # Policy A: no silent promotion. Anonymous holders of a registered
            # email must log in as that email first; a *different* logged-in
            # account gets a distinct 403 (never the invitation).
            if requester is None:
                raise InvitationLoginRequiredError()
            if requester.email != existing.email:
                raise InvitationEmailMismatchError()
            user = existing
            upgrade = user.role == User.Role.ATTENDEE
        else:
            password = serializer.validated_data.get("password")
            if not password:
                from rest_framework.exceptions import ValidationError

                raise ValidationError(
                    {"password": ["Password is required for new accounts."]}
                )
            upgrade = False

        # Atomic consume FIRST (works even where row locks are no-ops):
        # exactly one concurrent winner flips PENDING -> ACCEPTED.
        consumed = (
            OrganizerInvitation.objects.filter(
                pk=inv.pk, status=OrganizerInvitation.Status.PENDING
            ).update(status=OrganizerInvitation.Status.ACCEPTED,
                     accepted_at=timezone.now())
        )
        if not consumed:
            raise InvitationUsedError()

        if existing is not None:
            if upgrade:
                user.role = User.Role.ORGANIZER
                user.save(update_fields=["role", "updated_at"])
            # ORGANIZER/ADMIN recipients: idempotent success, role untouched.
            # Never assigns ADMIN under any path.
        else:
            user = get_user_model().objects.create_user(
                email=inv.email,
                name=serializer.validated_data.get("name") or inv.email.split("@")[0],
                password=password,
                role=User.Role.ORGANIZER,
            )

        inv.refresh_from_db(fields=["status", "accepted_at"])
        inv.accepted_by = user
        inv.save(update_fields=["accepted_by"])

    login(request, user)
    return Response(_user_payload(user), status=status.HTTP_201_CREATED)
