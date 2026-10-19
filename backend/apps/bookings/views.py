"""Booking endpoints: atomic create, history, detail, cancel (specs/06)."""

from django.db.models import Prefetch
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.accounts.permissions import IsAuthenticatedAndActive, IsOrganizerRole
from apps.events.exceptions import EventNotFoundError, NotEventOwnerError
from apps.events.models import Event

from .exceptions import BookingForbiddenError, BookingNotFoundError
from .models import Booking, BookingItem, BookingSeat
from .serializers import BookingSerializer, cancel_booking, create_booking


def _get_event_or_404(pk) -> Event:
    try:
        return Event.objects.select_related("organizer").get(pk=pk)
    except (Event.DoesNotExist, ValueError, TypeError):
        raise EventNotFoundError() from None


def _serialize_booking(booking: Booking) -> dict:
    full = (
        Booking.objects.select_related("user", "event")
        .prefetch_related(
            Prefetch("seats",
                     queryset=BookingSeat.objects.select_related(
                         "seat__row__section")),
            Prefetch("items",
                     queryset=BookingItem.objects.select_related(
                         "ticket_type")),
        )
        .get(pk=booking.pk)
    )
    return BookingSerializer(full).data


@api_view(["POST"])
@permission_classes([IsAuthenticatedAndActive])
def booking_create(request, pk):
    event = _get_event_or_404(pk)
    booking = create_booking(request.user, event, request.data)
    return Response(_serialize_booking(booking),
                    status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticatedAndActive])
def my_bookings(request):
    from config.pagination import EnvelopePagination

    qs = Booking.objects.filter(user=request.user).select_related("event")
    paginator = EnvelopePagination()
    page = paginator.paginate_queryset(qs, request)
    data = [BookingSerializer(b).data for b in page]
    return paginator.get_paginated_response(data)


def _visible_booking_or_raise(request, pk) -> Booking:
    try:
        booking = Booking.objects.select_related("user", "event").get(pk=pk)
    except (Booking.DoesNotExist, ValueError, TypeError):
        raise BookingNotFoundError() from None
    user = request.user
    if booking.user_id == user.id:
        return booking
    if user.role == user.Role.ADMIN:
        return booking
    if user.role == user.Role.ORGANIZER \
            and booking.event.organizer_id == user.id:
        return booking
    raise BookingForbiddenError()


@api_view(["GET"])
@permission_classes([IsAuthenticatedAndActive])
def booking_detail(request, pk):
    booking = _visible_booking_or_raise(request, pk)
    return Response(_serialize_booking(booking))


@api_view(["POST"])
@permission_classes([IsAuthenticatedAndActive])
def booking_cancel(request, pk):
    try:
        booking = Booking.objects.get(pk=pk)
    except (Booking.DoesNotExist, ValueError, TypeError):
        raise BookingNotFoundError() from None
    booking = cancel_booking(request.user, booking)
    return Response(_serialize_booking(booking))


@api_view(["GET"])
@permission_classes([IsOrganizerRole])
def organizer_event_bookings(request, pk):
    """Real per-event bookings for the owning organizer (B3 live data)."""
    try:
        event = Event.objects.get(pk=pk)
    except (Event.DoesNotExist, ValueError, TypeError):
        raise EventNotFoundError() from None
    user = request.user
    if user.role != user.Role.ADMIN and event.organizer_id != user.id:
        raise NotEventOwnerError()
    from config.pagination import EnvelopePagination

    qs = Booking.objects.filter(event=event).select_related("user", "event")
    # History stays visible regardless of lifecycle state (never deleted).
    paginator = EnvelopePagination()
    page = paginator.paginate_queryset(qs, request)
    data = [BookingSerializer(b).data for b in page]
    return paginator.get_paginated_response(data)
