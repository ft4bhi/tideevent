"""PostgreSQL integration tests: true row-lock concurrency (milestone B3).

Opt-in only: these run iff TEST_POSTGRES_URL is set, otherwise they skip and
the SQLite suite remains the gate. The URL must point at a DEDICATED scratch
database whose name ends in `_test` — anything else fails loudly so a
production database can never be touched by construction.

Owner runbook:
  1. In Neon, create a separate database (own branch recommended), e.g.
     `neondb_test`. NEVER use the production database.
  2. TEST_POSTGRES_URL='postgresql://USER:PASSWORD@HOST/dbname_test?sslmode=require' \
     .venv/bin/pytest -q tests/test_postgres_concurrency.py
The harness prints the target (host/database/user, never the password),
migrates it, flushes between tests, and leaves tables in place.
"""

import os
import threading
import urllib.parse

import pytest
from django.core.cache import cache
from django.core.management import call_command
from django.db import connections
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.bookings.models import Booking, BookingItem, BookingSeat

PG_URL = os.environ.get("TEST_POSTGRES_URL", "").strip()

requires_pg = pytest.mark.skipif(
    not PG_URL, reason="TEST_POSTGRES_URL not set (PostgreSQL tests unverified)")


def _target_parts(url):
    parts = urllib.parse.urlparse(url)
    return {
        "scheme": parts.scheme,
        "host": parts.hostname,
        "database": (parts.path or "").lstrip("/"),
        "user": urllib.parse.unquote(parts.username or ""),
    }


@pytest.fixture(scope="module")
def pg_database():
    """Swap the default connection to the scratch PostgreSQL and migrate it."""
    import dj_database_url

    target = _target_parts(PG_URL)
    print(f"\n[pg] target host={target['host']} db={target['database']} "
          f"user={target['user']}")
    if not target["database"].endswith("_test"):
        pytest.fail(
            f"Refusing: database {target['database']!r} does not end with "
            f"'_test'. Point TEST_POSTGRES_URL at a scratch test database.")
    assert connections["default"].vendor  # sqlite default exists pre-swap
    override = override_settings(
        DATABASES={"default": dj_database_url.parse(
            PG_URL, conn_max_age=0, ssl_require=True)})
    override.enable()
    connections.close_all()
    try:
        assert connections["default"].vendor == "postgresql"
        call_command("migrate", run_syncdb=True, verbosity=0,
                     interactive=False)
        yield
    finally:
        connections.close_all()
        override.disable()
        connections.close_all()


@pytest.fixture(autouse=True)
def _pg_flush(pg_database):
    cache.clear()
    yield
    call_command("flush", verbosity=0, interactive=False)


def _make_users(n, role="ATTENDEE"):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return [User.objects.create_user(
        email=f"race{i}@example.com", name=f"R{i}", password="password123",
        **({"role": role} if role != "ATTENDEE" else {})) for i in range(n)]


def _login_clients(users):
    clients = []
    for user in users:
        client = APIClient()
        res = client.post("/api/v1/auth/login",
                          {"email": user.email, "password": "password123"})
        assert res.status_code == 200, res.content
        clients.append(client)
    return clients


def _race(fn, count):
    """Run `count` copies of fn(i)->status concurrently; return outcomes."""
    barrier = threading.Barrier(count + 1)
    results = []

    def attempt(i):
        try:
            barrier.wait(timeout=30)
            results.append(fn(i))
        except Exception as exc:  # noqa: BLE001 - surfaced below, never hidden
            results.append(f"EXC:{type(exc).__name__}:{str(exc)[:200]}")

    threads = [threading.Thread(target=attempt, args=(i,)) for i in range(count)]
    for thread in threads:
        thread.start()
    barrier.wait(timeout=30)
    for thread in threads:
        thread.join(timeout=120)
    return results


def _make_rs_event_orm(organizer, title, sections):
    from datetime import timedelta

    from apps.events.models import Event

    return Event.objects.create(
        organizer=organizer, title=title,
        description="PG race event, sufficiently described.",
        category="MUSIC", starts_at=timezone.now() + timedelta(days=5),
        location="Hall", city="Mumbai", booking_mode="RESERVED_SEATING")


def _add_section(event, name, price, rows):
    from apps.events.models import EventRow, EventSeat, EventSection

    section = EventSection.objects.create(event=event, name=name,
                                          price_inr=price)
    for order, (label, numbers) in enumerate(rows):
        row = EventRow.objects.create(section=section, label=label,
                                      sort_order=order)
        EventSeat.objects.bulk_create(
            EventSeat(row=row, number=n) for n in numbers)
    return section


@requires_pg
@pytest.mark.django_db(transaction=True)
def test_pg_final_seat_race_single_winner(pg_database, _pg_flush):
    """4 threads, 1 seat: exactly one 201, rest 409, one active assignment."""
    users = _make_users(4)
    clients = _login_clients(users)
    org = _make_users(1, role="ORGANIZER")[0]
    event = _make_rs_event_orm(org, "Last Seat", None)
    _add_section(event, "Stalls", 100, [("A", [1])])
    seat_id = str(event.sections.get().rows.get().seats.get().id)

    results = _race(
        lambda i: clients[i].post(
            f"/api/v1/events/{event.pk}/bookings", {"seats": [seat_id]},
            format="json").status_code, 4)
    assert sorted(results) == [201, 409, 409, 409], results
    assert Booking.objects.filter(status="CONFIRMED").count() == 1
    assert BookingSeat.objects.filter(is_active=True).count() == 1


@requires_pg
@pytest.mark.django_db(transaction=True)
def test_pg_final_ga_ticket_race_exact_capacity(pg_database, _pg_flush):
    """6 threads × 1 ticket, capacity 3: exactly three 201s, rest 409."""
    from datetime import timedelta

    from apps.events.models import Event, TicketType

    users = _make_users(6)
    clients = _login_clients(users)
    org = _make_users(1, role="ORGANIZER")[0]
    event = Event.objects.create(
        organizer=org, title="Last Tickets",
        description="PG race event, sufficiently described.",
        category="FOOD", starts_at=timezone.now() + timedelta(days=5),
        location="Grounds", city="Delhi",
        booking_mode="GENERAL_ADMISSION", capacity=3)
    ticket_type = TicketType.objects.create(
        event=event, name="General", price_inr=50, quantity_total=3)

    results = _race(
        lambda i: clients[i].post(
            f"/api/v1/events/{event.pk}/bookings",
            {"items": [{"ticket_type_id": str(ticket_type.pk),
                        "quantity": 1}]},
            format="json").status_code, 6)
    assert sorted(results) == [201, 201, 201, 409, 409, 409], results
    assert Booking.objects.filter(status="CONFIRMED").count() == 3
    from django.db.models import Sum

    used = BookingItem.objects.aggregate(total=Sum("quantity"))["total"]
    assert used == 3


@requires_pg
@pytest.mark.django_db(transaction=True)
def test_pg_mixed_race_no_deadlock(pg_database, _pg_flush):
    """RS + GA bookings concurrently on different events: all confirm."""
    from datetime import timedelta

    from apps.events.models import Event, TicketType

    users = _make_users(4)
    clients = _login_clients(users)
    org = _make_users(1, role="ORGANIZER")[0]
    rs_event = _make_rs_event_orm(org, "RS Race", None)
    _add_section(rs_event, "Floor", 50, [("A", [1, 2, 3, 4])])
    seat_ids = [str(s.id) for s in
                rs_event.sections.get().rows.get().seats.all()]
    ga_event = Event.objects.create(
        organizer=org, title="GA Race",
        description="PG race event, sufficiently described.",
        category="FOOD", starts_at=timezone.now() + timedelta(days=5),
        location="Grounds", city="Delhi",
        booking_mode="GENERAL_ADMISSION", capacity=40)
    ticket_type = TicketType.objects.create(
        event=ga_event, name="General", price_inr=10, quantity_total=40)

    def attempt(i):
        if i % 2 == 0:
            return clients[i].post(
                f"/api/v1/events/{rs_event.pk}/bookings",
                {"seats": [seat_ids[i]]}, format="json").status_code
        return clients[i].post(
            f"/api/v1/events/{ga_event.pk}/bookings",
            {"items": [{"ticket_type_id": str(ticket_type.pk),
                        "quantity": 10}]}, format="json").status_code

    assert _race(attempt, 4) == [201, 201, 201, 201]
