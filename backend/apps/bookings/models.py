"""Bookings: one booking with seat/item records, unique references (B3)."""

import secrets
import uuid

from django.db import models

MAX_TICKETS_PER_REQUEST = 10


def generate_reference() -> str:
    return f"TD-{secrets.token_hex(3).upper()}"


class Booking(models.Model):
    class Status(models.TextChoices):
        CONFIRMED = "CONFIRMED", "Confirmed"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="bookings"
    )
    event = models.ForeignKey(
        "events.Event", on_delete=models.PROTECT, related_name="bookings"
    )
    reference = models.CharField(max_length=16, unique=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.CONFIRMED
    )
    booked_at = models.DateTimeField(auto_now_add=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-booked_at",)
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["event", "status"]),
        ]

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return f"{self.reference} [{self.status}]"

    def total_inr(self) -> int:
        seats_total = sum(
            s.seat.row.section.price_inr
            for s in self.seats.select_related("seat__row__section").all()
            if s.is_active
        )
        items_total = sum(
            item.ticket_type.price_inr * item.quantity
            for item in self.items.select_related("ticket_type").all()
        )
        return seats_total + items_total


class BookingSeat(models.Model):
    """One reserved seat. Rows are kept after cancellation (audit); only
    active rows consume inventory via the partial unique constraint."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(
        Booking, on_delete=models.CASCADE, related_name="seats"
    )
    seat = models.ForeignKey(
        "events.EventSeat", on_delete=models.PROTECT, related_name="assignments"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["seat"],
                condition=models.Q(is_active=True),
                name="uniq_active_assignment_per_seat",
            )
        ]

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return f"{self.booking.reference} -> seat {self.seat_id}"


class BookingItem(models.Model):
    """One general-admission line: ticket type × quantity (1–10)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(
        Booking, on_delete=models.CASCADE, related_name="items"
    )
    ticket_type = models.ForeignKey(
        "events.TicketType", on_delete=models.PROTECT, related_name="lines"
    )
    quantity = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gte=1)
                & models.Q(quantity__lte=MAX_TICKETS_PER_REQUEST),
                name="booking_item_quantity_range",
            )
        ]

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return f"{self.booking.reference} x{self.quantity} {self.ticket_type_id}"
