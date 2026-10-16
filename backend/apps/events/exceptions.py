"""Event-domain error codes (base + envelope in config.exceptions)."""

from rest_framework import status

from config.exceptions import CodedError


class EventNotFoundError(CodedError):
    code = "EVENT_NOT_FOUND"
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Event not found."


class NotEventOwnerError(CodedError):
    code = "NOT_EVENT_OWNER"
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "You can only manage your own events."


class InventoryLockedError(CodedError):
    code = "INVENTORY_LOCKED"
    status_code = status.HTTP_409_CONFLICT
    default_detail = (
        "Inventory is locked because confirmed bookings exist. "
        "Only event details can still be edited."
    )


class ModeImmutableError(CodedError):
    code = "MODE_IMMUTABLE"
    status_code = status.HTTP_409_CONFLICT
    default_detail = (
        "Booking mode cannot change once inventory or bookings exist."
    )


class TemplateNotFoundError(CodedError):
    code = "TEMPLATE_NOT_FOUND"
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Venue template not found."


class EventTerminalError(CodedError):
    code = "EVENT_TERMINAL"
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Cancelled events are terminal and cannot change status."
