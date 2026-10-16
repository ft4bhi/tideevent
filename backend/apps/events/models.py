"""Events, venue templates, seating inventory, ticket types (B2).

No bookings yet: availability derives from inventory alone; B3 subtracts
confirmed bookings via the same helpers. Lock/consume helpers are written
bookings-aware now so B3 activates them without model changes.
"""

import uuid

from django.apps import apps
from django.core.exceptions import ValidationError
from django.db import models

MAX_CAPACITY = 100_000
MAX_TICKETS_PER_LINE = 10


class BookingMode(models.TextChoices):
    RESERVED_SEATING = "RESERVED_SEATING", "Reserved seating"
    GENERAL_ADMISSION = "GENERAL_ADMISSION", "General admission"


class EventStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"
    CANCELLED = "CANCELLED", "Cancelled"


class Category(models.TextChoices):
    MUSIC = "MUSIC", "Music"
    COMEDY = "COMEDY", "Comedy"
    THEATRE = "Theatre", "Theatre"
    WORKSHOP = "WORKSHOP", "Workshops"
    SPORTS = "Sports", "Sports"
    FOOD = "FOOD", "Food"
    TECH = "Tech", "Tech"
    ART = "Art", "Art"


class Event(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organizer = models.ForeignKey(
        "accounts.User", on_delete=models.PROTECT, related_name="events"
    )
    title = models.CharField(max_length=120)
    description = models.TextField(max_length=5000)
    category = models.CharField(max_length=16, choices=Category.choices)
    starts_at = models.DateTimeField()
    location = models.CharField(max_length=255)
    city = models.CharField(max_length=80)
    poster_url = models.URLField(blank=True, default="")
    booking_mode = models.CharField(max_length=32, choices=BookingMode.choices)
    # GA only: total capacity. RS capacity is derived (sellable seats).
    capacity = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=EventStatus.choices, default=EventStatus.ACTIVE
    )
    status_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("starts_at",)
        indexes = [
            models.Index(fields=["status", "starts_at"]),
            models.Index(fields=["organizer", "status"]),
        ]

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return f"{self.title} [{self.status}/{self.booking_mode}]"

    # -- inventory helpers (bookings-aware; B3 fills the confirmed math) --

    @property
    def is_reserved(self) -> bool:
        return self.booking_mode == BookingMode.RESERVED_SEATING

    def has_confirmed_bookings(self) -> bool:
        try:
            Booking = apps.get_model("bookings", "Booking")
        except LookupError:
            return False
        return Booking.objects.filter(
            event=self, status=Booking.Status.CONFIRMED
        ).exists()

    def confirmed_quantity(self) -> int:
        """GA tickets consumed by CONFIRMED bookings (0 until B3)."""
        try:
            BookingItem = apps.get_model("bookings", "BookingItem")
            Booking = apps.get_model("bookings", "Booking")
        except LookupError:
            return 0
        from django.db.models import Sum

        return (
            BookingItem.objects.filter(
                booking__event=self, booking__status=Booking.Status.CONFIRMED
            ).aggregate(total=Sum("quantity"))["total"]
            or 0
        )

    def seat_count(self) -> int:
        return EventSeat.objects.filter(row__section__event=self,
                                        is_sellable=True).count()

    def effective_capacity(self) -> int:
        return self.seat_count() if self.is_reserved else (self.capacity or 0)

    def remaining(self) -> int:
        if self.is_reserved:
            return max(0, self.seat_count() - self.confirmed_seat_count())
        return max(0, (self.capacity or 0) - self.confirmed_quantity())

    def confirmed_seat_count(self) -> int:
        try:
            BookingSeat = apps.get_model("bookings", "BookingSeat")
            Booking = apps.get_model("bookings", "Booking")
        except LookupError:
            return 0
        return BookingSeat.objects.filter(
            seat__row__section__event=self,
            is_active=True,
            booking__status=Booking.Status.CONFIRMED,
        ).count()

    def starting_price_inr(self) -> int:
        if self.is_reserved:
            from django.db.models import Min

            return (
                EventSection.objects.filter(event=self).aggregate(
                    low=Min("price_inr"))["low"]
                or 0
            )
        from django.db.models import Min

        return (
            TicketType.objects.filter(event=self).aggregate(low=Min("price_inr"))[
                "low"
            ]
            or 0
        )

    @property
    def sold_out(self) -> bool:
        return self.remaining() <= 0

    def clean(self) -> None:
        if self.booking_mode == BookingMode.GENERAL_ADMISSION:
            if not self.capacity or self.capacity < 1:
                raise ValidationError(
                    {"capacity": "General-admission events require capacity ≥ 1."})
            if self.capacity > MAX_CAPACITY:
                raise ValidationError(
                    {"capacity": f"Capacity must be ≤ {MAX_CAPACITY}."})
        else:
            if self.capacity is not None:
                raise ValidationError(
                    {"capacity": "Reserved-seating capacity is derived from seats."})


class VenueLayoutTemplate(models.Model):
    """Reusable starting layout (auditorium, stadium, cinema, conference,
    custom). Organizers instantiate editable copies; templates stay pristine."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=80)
    description = models.TextField(blank=True, default="")
    layout_json = models.JSONField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return self.name


class EventSection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="sections"
    )
    name = models.CharField(max_length=80)
    price_inr = models.PositiveIntegerField(default=0)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("sort_order", "name")
        constraints = [
            models.UniqueConstraint(fields=["event", "name"],
                                    name="uniq_section_name_per_event")
        ]

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return f"{self.event.title} / {self.name}"


class EventRow(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    section = models.ForeignKey(
        EventSection, on_delete=models.CASCADE, related_name="rows"
    )
    label = models.CharField(max_length=4)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("sort_order", "label")
        constraints = [
            models.UniqueConstraint(fields=["section", "label"],
                                    name="uniq_row_label_per_section")
        ]

    def clean(self) -> None:
        if not self.label or not self.label.strip():
            raise ValidationError({"label": "Row label is required."})

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return f"{self.section} row {self.label}"


class EventSeat(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    row = models.ForeignKey(
        EventRow, on_delete=models.CASCADE, related_name="seats"
    )
    number = models.PositiveIntegerField()
    is_accessible = models.BooleanField(default=False)
    is_sellable = models.BooleanField(default=True)

    class Meta:
        ordering = ("number",)
        indexes = [models.Index(fields=["row", "number"])]
        constraints = [
            models.UniqueConstraint(fields=["row", "number"],
                                    name="uniq_seat_number_per_row"),
            models.CheckConstraint(
                condition=models.Q(number__gte=1) & models.Q(number__lte=500),
                name="seat_number_range",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return f"{self.row} seat {self.number}"


class TicketType(models.Model):
    """General-admission ticket category (free types consume capacity too)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="ticket_types"
    )
    name = models.CharField(max_length=80)
    price_inr = models.PositiveIntegerField(default=0)
    quantity_total = models.PositiveIntegerField()
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("sort_order", "name")
        constraints = [
            models.UniqueConstraint(fields=["event", "name"],
                                    name="uniq_ticket_name_per_event"),
            models.CheckConstraint(
                condition=models.Q(quantity_total__gte=1)
                & models.Q(quantity_total__lte=MAX_CAPACITY),
                name="ticket_quantity_range",
            ),
        ]

    def remaining(self) -> int:
        try:
            BookingItem = apps.get_model("bookings", "BookingItem")
            Booking = apps.get_model("bookings", "Booking")
        except LookupError:
            return self.quantity_total
        from django.db.models import Sum

        used = (
            BookingItem.objects.filter(
                ticket_type=self, booking__status=Booking.Status.CONFIRMED
            ).aggregate(total=Sum("quantity"))["total"]
            or 0
        )
        return max(0, self.quantity_total - used)

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return f"{self.event.title} / {self.name}"
