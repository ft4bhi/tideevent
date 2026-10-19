"""Booking-domain error codes (base + envelope in config.exceptions)."""

from rest_framework import status

from config.exceptions import CodedError


class BookingNotFoundError(CodedError):
    code = "BOOKING_NOT_FOUND"
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "Booking not found."


class BookingForbiddenError(CodedError):
    code = "BOOKING_FORBIDDEN"
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "You cannot view this booking."


class BookingNotCancellableError(CodedError):
    code = "BOOKING_NOT_CANCELLABLE"
    status_code = status.HTTP_409_CONFLICT
    default_detail = (
        "Only confirmed bookings before the event starts can be cancelled."
    )


class EventSoldOutError(CodedError):
    code = "EVENT_SOLD_OUT"
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This event is sold out."


class EventUnavailableError(CodedError):
    code = "EVENT_UNAVAILABLE"
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "This event is not available for booking."


class SeatUnavailableError(CodedError):
    code = "SEAT_UNAVAILABLE"
    status_code = status.HTTP_409_CONFLICT
    default_detail = "One or more selected seats are no longer available."


class TicketsUnavailableError(CodedError):
    code = "TICKETS_UNAVAILABLE"
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Not enough tickets of the requested type remain."
