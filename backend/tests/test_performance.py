"""P1 query-count regression tests.

Verifies that event-list and my-bookings endpoints do not issue N+1 queries
as the number of events/bookings grows. Query counts are asserted to be
constant (independent of record count) for the annotated/prefetched paths.
"""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

User = get_user_model()

pytestmark = pytest.mark.django_db


def make_user(email, role=User.Role.ATTENDEE):
    return User.objects.create_user(
        email=email, name=email.split("@")[0], password="password123", role=role
    )


def login(email):
    client = APIClient()
    res = client.post(
        "/api/v1/auth/login", {"email": email, "password": "password123"}
    )
    assert res.status_code == 200, res.content
    return client


def make_ga_event(org_client, title="GA Show", capacity=10, types=None):
    payload = {
        "title": title,
        "description": "General admission test event.",
        "category": "FOOD",
        "starts_at": (timezone.now() + timedelta(days=5)).isoformat(),
        "location": "Grounds",
        "city": "Delhi",
        "booking_mode": "GENERAL_ADMISSION",
        "capacity": capacity,
        "ticket_types": types or [
            {"name": "General", "price_inr": 199, "quantity_total": capacity},
        ],
    }
    res = org_client.post("/api/v1/organizer/events", payload, format="json")
    assert res.status_code == 201, res.content
    return res.json()


def make_rs_event(org_client, title="RS Show"):
    sections = [
        {"name": "Stalls", "price_inr": 500,
         "rows": [{"label": "A", "seats": [1, 2, 3]}]},
        {"name": "Balcony", "price_inr": 900,
         "rows": [{"label": "B", "seats": [1, 2]}]},
    ]
    payload = {
        "title": title,
        "description": "Reserved seating test event.",
        "category": "MUSIC",
        "starts_at": (timezone.now() + timedelta(days=5)).isoformat(),
        "location": "Hall",
        "city": "Mumbai",
        "booking_mode": "RESERVED_SEATING",
        "sections": sections,
    }
    res = org_client.post("/api/v1/organizer/events", payload, format="json")
    assert res.status_code == 201, res.content
    return res.json()


@pytest.fixture
def org_client():
    make_user("org@example.com", User.Role.ORGANIZER)
    return login("org@example.com")


@pytest.fixture
def attendee_client():
    make_user("att@example.com")
    return login("att@example.com")


def count_queries(callable_fn):
    """Run a callable and return (result, query_count)."""
    with CaptureQueriesContext(connection) as ctx:
        result = callable_fn()
    queries = getattr(ctx, 'queries', [])
    return result, len(queries)


# ------------------------------------------------------------------ public list ----

def test_public_event_list_query_count_is_constant(org_client):
    """Public event list should use a fixed number of queries regardless of
    how many events exist (no per-event N+1 for derived fields)."""
    # Create 5 GA events with ticket types
    for i in range(5):
        make_ga_event(org_client, title=f"GA Event {i}", capacity=100)
    # Create 3 RS events with sections
    for i in range(3):
        make_rs_event(org_client, title=f"RS Event {i}")

    anon = APIClient()

    def fetch():
        return anon.get("/api/v1/events")

    _, query_count = count_queries(fetch)
    # With 8 events, pre-fix this would be 1 + 8*3 = 25+ queries.
    # Post-fix it should be a small constant (2-4 queries: main + subqueries).
    assert query_count <= 8, (
        f"Public event list issued {query_count} queries for 8 events; "
        "expected constant count (no per-event N+1)"
    )

    # Verify response correctness
    resp = anon.get("/api/v1/events")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 8
    # Every event must have starting_price_inr, remaining, sold_out
    for e in data:
        assert "starting_price_inr" in e
        assert "remaining" in e
        assert "sold_out" in e


# ------------------------------------------------------------------ my bookings ----

def test_my_bookings_query_count_is_constant(attendee_client):
    """My bookings list should use a fixed number of queries regardless of
    how many bookings exist (no per-booking N+1 for seats/items/total_inr)."""
    att = attendee_client
    make_user("org@example.com", User.Role.ORGANIZER)
    org_client = login("org@example.com")

    # Create 5 GA events and book 1 ticket on each
    for i in range(5):
        event = make_ga_event(org_client, title=f"GA Event {i}", capacity=10)
        tid = next(t for t in event["ticket_types"] if t["name"] == "General")["id"]
        res = att.post(
            f"/api/v1/events/{event['id']}/bookings",
            {"items": [{"ticket_type_id": tid, "quantity": 1}]},
            format="json",
        )
        assert res.status_code == 201, res.content

    def fetch():
        return att.get("/api/v1/bookings/me")

    _, query_count = count_queries(fetch)
    # Pre-fix: 1 + 5*3 = 16+ queries. Post-fix: constant (~3-4 queries).
    assert query_count <= 6, (
        f"My bookings issued {query_count} queries for 5 bookings; "
        "expected constant count (no per-booking N+1)"
    )

    # Verify response correctness
    resp = att.get("/api/v1/bookings/me")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 5
    for b in data:
        assert "seats" in b
        assert "items" in b
        assert "total_inr" in b


# ------------------------------------------------------------------ event detail ----

def test_event_detail_prefetches_inventory(org_client):
    """Event detail should prefetch sections/rows/seats/ticket_types without
    per-item queries."""
    org = org_client
    event = make_rs_event(org, title="Detail RS Event")

    anon = APIClient()

    def fetch():
        return anon.get(f"/api/v1/events/{event['id']}")

    _, query_count = count_queries(fetch)
    # One query for the event + prefetches (sections, rows, seats, ticket_types)
    # should be a small constant, not per-seat queries.
    assert query_count <= 6, (
        f"Event detail issued {query_count} queries; "
        "expected constant count with prefetch_related"
    )

    resp = anon.get(f"/api/v1/events/{event['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["sections"]) == 2
    assert len(data["sections"][0]["rows"]) == 1
    assert len(data["sections"][0]["rows"][0]["seats"]) == 3


# ------------------------------------------------------------------ organizer list ----

def test_organizer_event_list_query_count_is_constant(org_client):
    """Organizer event list should match public list query efficiency."""
    for i in range(5):
        make_ga_event(org_client, title=f"Org GA {i}", capacity=100)
    for i in range(3):
        make_rs_event(org_client, title=f"Org RS {i}")

    def fetch():
        return org_client.get("/api/v1/organizer/events")

    _, query_count = count_queries(fetch)
    assert query_count <= 8, (
        f"Organizer event list issued {query_count} queries for 8 events; "
        "expected constant count (no per-event N+1)"
    )

    resp = org_client.get("/api/v1/organizer/events")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 8


# ------------------------------------------------------------------ admin list ----

def test_admin_event_list_query_count_is_constant(org_client):
    """Admin event list should match public list query efficiency."""
    make_user("admin@example.com", User.Role.ADMIN)
    admin_client = login("admin@example.com")

    for i in range(5):
        make_ga_event(org_client, title=f"Admin GA {i}", capacity=100)
    for i in range(3):
        make_rs_event(org_client, title=f"Admin RS {i}")

    def fetch():
        return admin_client.get("/api/v1/admin/events")

    _, query_count = count_queries(fetch)
    assert query_count <= 8, (
        f"Admin event list issued {query_count} queries for 8 events; "
        "expected constant count (no per-event N+1)"
    )

    resp = admin_client.get("/api/v1/admin/events")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 8


# ------------------------------------------------------------------ sold out / cancelled ----

def test_sold_out_event_list_query_count(org_client):
    """A sold-out GA event should still report remaining=0, sold_out=True
    with constant query count."""
    org = org_client
    event = make_ga_event(org, title="Sold Out GA", capacity=1)
    tid = next(t for t in event["ticket_types"] if t["name"] == "General")["id"]

    # Book all capacity
    att = make_user("att@example.com")
    att_client = login("att@example.com")
    att_client.post(
        f"/api/v1/events/{event['id']}/bookings",
        {"items": [{"ticket_type_id": tid, "quantity": 1}]},
        format="json",
    )

    anon = APIClient()

    def fetch():
        return anon.get("/api/v1/events")

    _, query_count = count_queries(fetch)
    assert query_count <= 8, (
        f"Public list with sold-out event issued {query_count} queries; "
        "expected constant count"
    )

    resp = anon.get("/api/v1/events")
    assert resp.status_code == 200
    data = resp.json()["data"]
    sold_out_event = next(e for e in data if e["id"] == event["id"])
    assert sold_out_event["remaining"] == 0
    assert sold_out_event["sold_out"] is True


def test_cancelled_booking_not_in_my_bookings(attendee_client):
    """Cancelled bookings should still appear in my_bookings with status
    CANCELLED, using constant query count."""
    att = attendee_client
    org_client = login("org@example.com")

    event = make_ga_event(org_client, title="Cancelled GA", capacity=10)
    tid = next(t for t in event["ticket_types"] if t["name"] == "General")["id"]
    res = att.post(
        f"/api/v1/events/{event['id']}/bookings",
        {"items": [{"ticket_type_id": tid, "quantity": 1}]},
        format="json",
    )
    assert res.status_code == 201
    booking_id = res.json()["id"]

    # Cancel via attendee
    res = att.post(f"/api/v1/bookings/{booking_id}/cancel")
    assert res.status_code == 200
    assert res.json()["status"] == "CANCELLED"

    def fetch():
        return att.get("/api/v1/bookings/me")

    _, query_count = count_queries(fetch)
    assert query_count <= 6, (
        f"My bookings with cancelled booking issued {query_count} queries; "
        "expected constant count"
    )

    resp = att.get("/api/v1/bookings/me")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) == 1
    assert data[0]["status"] == "CANCELLED"
