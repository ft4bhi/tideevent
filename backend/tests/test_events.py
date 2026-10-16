"""B2 model tests: lifecycle defaults, derived inventory, constraints."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.events.models import (
    BookingMode,
    Event,
    EventStatus,
    TicketType,
    VenueLayoutTemplate,
)

User = get_user_model()

pytestmark = pytest.mark.django_db


def make_organizer(email="org@example.com"):
    return User.objects.create_user(
        email=email, name="Org", password="password123", role="ORGANIZER")


def make_event(**overrides):
    data = {
        "organizer": make_organizer(),
        "title": "Show", "description": "A sufficiently long description.",
        "category": "MUSIC",
        "starts_at": timezone.now() + timedelta(days=3),
        "location": "Hall", "city": "Mumbai",
        "booking_mode": BookingMode.GENERAL_ADMISSION, "capacity": 100,
    }
    data.update(overrides)
    return Event.objects.create(**data)


def test_event_created_active_immediately():
    event = make_event()
    assert event.status == EventStatus.ACTIVE


def test_ga_requires_capacity_rs_derives_it():
    event = make_event()
    assert event.effective_capacity() == 100
    assert event.remaining() == 100
    assert event.sold_out is False
    with pytest.raises(ValidationError):
        bad = make_event()
        bad.booking_mode = BookingMode.RESERVED_SEATING
        bad.full_clean()


def test_has_confirmed_bookings_false_without_bookings_app_models():
    assert make_event().has_confirmed_bookings() is False


def _rs_event_with_row():
    from apps.events.models import EventRow, EventSection

    event = make_event(booking_mode=BookingMode.RESERVED_SEATING, capacity=None)
    section = EventSection.objects.create(event=event, name="Stalls",
                                          price_inr=100)
    row = EventRow.objects.create(section=section, label="A")
    return event, section, row


def test_section_name_unique_per_event():
    from apps.events.models import EventSection

    event, _, _ = _rs_event_with_row()
    with pytest.raises(IntegrityError):
        EventSection.objects.create(event=event, name="Stalls", price_inr=200)


def test_row_label_unique():
    from apps.events.models import EventRow

    _, section, _ = _rs_event_with_row()
    with pytest.raises(IntegrityError):
        EventRow.objects.create(section=section, label="A")


def test_seat_number_unique():
    from apps.events.models import EventSeat

    _, _, row = _rs_event_with_row()
    EventSeat.objects.create(row=row, number=1)
    with pytest.raises(IntegrityError):
        EventSeat.objects.create(row=row, number=1)


def test_seat_number_range_checked():
    from apps.events.models import EventSeat

    _, _, row = _rs_event_with_row()
    bad = EventSeat(row=row, number=501)
    with pytest.raises(ValidationError):
        bad.full_clean()


def test_starting_price_and_derived_capacity():
    from apps.events.models import EventRow, EventSeat, EventSection

    event = make_event(booking_mode=BookingMode.RESERVED_SEATING, capacity=None)
    assert event.starting_price_inr() == 0
    section = EventSection.objects.create(event=event, name="VIP", price_inr=999)
    row = EventRow.objects.create(section=section, label="A")
    EventSeat.objects.bulk_create([EventSeat(row=row, number=n) for n in (1, 2, 3)])
    assert event.effective_capacity() == 3
    assert event.starting_price_inr() == 999
    assert event.remaining() == 3


def test_ticket_type_quantity_range_and_remaining():
    event = make_event()
    TicketType.objects.create(event=event, name="General",
                              price_inr=100, quantity_total=60)
    assert TicketType.objects.get(event=event).remaining() == 60
    with pytest.raises(IntegrityError):
        TicketType.objects.create(event=event, name="General",
                                  price_inr=50, quantity_total=10)


def test_templates_seeded():
    assert VenueLayoutTemplate.objects.filter(is_active=True).count() == 5
    slugs = set(VenueLayoutTemplate.objects.values_list("slug", flat=True))
    assert {"auditorium", "stadium", "cinema", "conference",
            "custom-basic"} <= slugs
