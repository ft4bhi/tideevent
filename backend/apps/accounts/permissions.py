"""Role/status permission classes. Backend authorization is authoritative;
frontend guards are usability only."""

from rest_framework.permissions import BasePermission


def _active(user) -> bool:
    return bool(
        user
        and user.is_authenticated
        and getattr(user, "status", None) == user.Status.ACTIVE
    )


class IsAuthenticatedAndActive(BasePermission):
    """Default: logged in AND not suspended. Suspended sessions get 403
    (ACCOUNT_SUSPENDED via the view, generic FORBIDDEN otherwise)."""

    message = "Authentication credentials were not provided."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return _active(user)


class IsAdminRole(BasePermission):
    """Business ADMIN with an active account (not merely is_staff)."""

    message = "Admin access required."

    def has_permission(self, request, view):
        user = request.user
        return _active(user) and getattr(user, "role", None) == user.Role.ADMIN


class IsOrganizerRole(BasePermission):
    """ORGANIZER (or ADMIN acting with organizer scope)."""

    message = "Organizer access required."

    def has_permission(self, request, view):
        user = request.user
        return _active(user) and getattr(user, "role", None) in (
            user.Role.ORGANIZER,
            user.Role.ADMIN,
        )
