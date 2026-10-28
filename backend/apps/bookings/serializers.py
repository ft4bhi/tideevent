"""Booking serializers: read shapes + strict write validation (specs/06)."""

import secrets
import uuid

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from apps.events.models import BookingMode, EventSeat, EventStatus, TicketType

from .exceptions import (
    BookingNotCancellableError,
    BookingNotFoundError,
    EventSoldOutError,
    EventUnavailableError,
    SeatUnavailableError,
    TicketsUnavailableError,
)
from .models import (
    MAX_TICKETS_PER_REQUEST,
    Booking,
    BookingItem,
    BookingSeat,
    generate_reference,
)

# ------------------------------------------------------------------ read ----


class BookingSeatSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()
    section = serializers.CharField(source="seat.row.section.name", read_only=True)
    row = serializers.CharField(source="seat.row.label", read_only=True)
    number = serializers.IntegerField(source="seat.number", read_only=True)

    class Meta:
        model = BookingSeat
        fields = ("label", "section", "row", "number")

    def get_label(self, assignment) -> str:
        return f"{assignment.seat.row.label}-{assignment.seat.number}"


class BookingItemSerializer(serializers.ModelSerializer):
    ticket_type_id = serializers.UUIDField(source="ticket_type.id", read_only=True)
    ticket_type_name = serializers.CharField(source="ticket_type.name",
                                             read_only=True)
    price_inr = serializers.IntegerField(source="ticket_type.price_inr",
                                         read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = BookingItem
        fields = ("ticket_type_id", "ticket_type_name", "quantity", "price_inr",
                  "line_total")

    def get_line_total(self, item) -> int:
        return item.ticket_type.price_inr * item.quantity


class BookingSerializer(serializers.ModelSerializer):
    event = serializers.SerializerMethodField()
    attendee = serializers.SerializerMethodField()
    seats = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    total_inr = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = ("id", "ticket_token", "reference", "status", "event",
                  "attendee", "seats", "items", "total_inr", "booked_at",
                  "cancelled_at")

    def get_event(self, booking) -> dict:
        event = booking.event
        return {"id": str(event.id), "title": event.title,
                "starts_at": event.starts_at,
                "location": event.location}

    def get_attendee(self, booking) -> dict:
        return {"name": booking.user.name, "email": booking.user.email}

    def get_seats(self, booking) -> list:
        qs = booking.seats.filter(is_active=True).select_related(
            "seat__row__section")
        return BookingSeatSerializer(qs, many=True).data

    def get_items(self, booking) -> list:
        qs = booking.items.select_related("ticket_type")
        return BookingItemSerializer(qs, many=True).data

    def get_total_inr(self, booking) -> int:
        return booking.total_inr()


class TicketSerializer(serializers.Serializer):
    """Public read-only serializer for QR-scan ticket lookup.
    Exposes only ticket-facing fields; no personal attendee data."""
    reference = serializers.CharField(source="reference")
    status = serializers.CharField(source="status")
    booked_at = serializers.DateTimeField(source="booked_at")
    event = serializers.SerializerMethodField()
    seats = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    total_inr = serializers.SerializerMethodField()

    def get_event(self, booking) -> dict:
        event = booking.event
        return {
            "id": str(event.id),
            "title": event.title,
            "starts_at": event.starts_at,
            "location": event.location,
        }

    def get_seats(self, booking) -> list:
        qs = booking.seats.filter(is_active=True).select_related(
            "seat__row__section")
        return BookingSeatSerializer(qs, many=True).data

    def get_items(self, booking) -> list:
        qs = booking.items.select_related("ticket_type")
        return BookingItemSerializer(qs, many=True).data

    def get_total_inr(self, booking) -> int:
        return booking.total_inr()


# ----------------------------------------------------------------- write ----


class ReserveSeatsInput(serializers.Serializer):
    seats = serializers.ListField(child=serializers.UUIDField(), min_length=1)

    def validate_seats(self, value):
        if len(set(value)) != len(value):
            raise serializers.ValidationError(
                "Duplicate seat IDs in one request.")
        return value


class GeneralAdmissionInput(serializers.Serializer):
    items = serializers.ListField(child=serializers.DictField(), min_length=1)

    def validate_items(self, value):
        cleaned = []
        for entry in value:
            try:
                ticket_type_id = uuid.UUID(str(entry.get("ticket_type_id")))
            except (ValueError, TypeError, AttributeError):
                raise serializers.ValidationError(
                    "Each item needs a ticket_type_id UUID."
                ) from None
            quantity = entry.get("quantity")
            if not isinstance(quantity, int) or isinstance(quantity, bool):
                raise serializers.ValidationError(
                    "Each quantity must be a whole number.")
            if not 1 <= quantity <= MAX_TICKETS_PER_REQUEST:
                raise serializers.ValidationError(
                    f"Quantity must be 1–{MAX_TICKETS_PER_REQUEST} per line.")
            cleaned.append({"ticket_type_id": ticket_type_id,
                            "quantity": quantity})
        return cleaned


def _ensure_bookable(event) -> None:
    if event.status != EventStatus.ACTIVE or event.starts_at <= timezone.now():
        raise EventUnavailableError()
    if event.remaining() <= 0:
        raise EventSoldOutError()


@transaction.atomic
def _create_reserved_booking(user, event, seat_ids) -> Booking:
    locked_event = (
        event.__class__.objects.select_for_update().get(pk=event.pk))
    _ensure_bookable(locked_event)
    seats = list(
        EventSeat.objects.select_for_update()
        .filter(id__in=seat_ids, row__section__event=locked_event,
                is_sellable=True)
        .select_related("row__section"))
    if len(seats) != len(seat_ids):
        raise SeatUnavailableError(
            "Some seats do not exist, are not sellable, or belong elsewhere.")
    taken = set(
        BookingSeat.objects.filter(
            seat_id__in=seat_ids, is_active=True,
            booking__status=Booking.Status.CONFIRMED,
        ).values_list("seat_id", flat=True))
    if taken:
        raise SeatUnavailableError()
    booking = Booking.objects.create(
        user=user, event=locked_event, reference=generate_reference(),
        ticket_token=secrets.token_urlsafe(32),
    )
    BookingSeat.objects.bulk_create(
        [BookingSeat(booking=booking, seat=seat) for seat in seats])
    return booking


@transaction.atomic
def _create_ga_booking(user, event, items) -> Booking:
    locked_event = (
        event.__class__.objects.select_for_update().get(pk=event.pk))
    _ensure_bookable(locked_event)
    wanted = {item["ticket_type_id"]: item["quantity"] for item in items}
    if len(wanted) != len(items):
        raise TicketsUnavailableError("Duplicate ticket type in one request.")
    types = list(
        TicketType.objects.select_for_update()
        .filter(id__in=list(wanted), event=locked_event))
    if len(types) != len(wanted):
        raise TicketsUnavailableError(
            "Some ticket types do not exist for this event.")
    for ticket_type in types:
        if ticket_type.remaining() < wanted[ticket_type.id]:
            raise TicketsUnavailableError()
    booking = Booking.objects.create(
        user=user, event=locked_event, reference=generate_reference(),
        ticket_token=secrets.token_urlsafe(32),
    )
    BookingItem.objects.bulk_create([
        BookingItem(booking=booking, ticket_type=ticket_type,
                    quantity=wanted[ticket_type.id])
        for ticket_type in types
    ])
    return booking


def create_booking(user, event, payload: dict) -> Booking:
    """Mode-routed atomic booking with reference-collision retry.

    IntegrityError retries are safe: seat races re-validate to 409 on the
    next attempt, reference collisions succeed. After 3 attempts something is
    genuinely wrong and the error propagates (500 path, logged by Django).
    """

    if event.booking_mode == BookingMode.RESERVED_SEATING:
        serializer = ReserveSeatsInput(data=payload)
    else:
        serializer = GeneralAdmissionInput(data=payload)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    last_error = None
    for _ in range(3):
        try:
            if event.booking_mode == BookingMode.RESERVED_SEATING:
                return _create_reserved_booking(user, event, data["seats"])
            return _create_ga_booking(user, event, data["items"])
        except IntegrityError as err:
            last_error = err
    raise last_error


@transaction.atomic
def cancel_booking(user, booking: Booking) -> Booking:
    locked = Booking.objects.select_for_update().get(pk=booking.pk)
    if locked.user_id != user.id:
        # 404, not 403: booking existence is private to its owner.
        raise BookingNotFoundError()
    if locked.status != Booking.Status.CONFIRMED:
        raise BookingNotCancellableError()
    if locked.event.starts_at <= timezone.now():
        raise BookingNotCancellableError()
    locked.status = Booking.Status.CANCELLED
    locked.cancelled_at = timezone.now()
    locked.save(update_fields=["status", "cancelled_at"])
    locked.seats.update(is_active=False)
    return locked
