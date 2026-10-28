"""B3 booking tests on SQLite: validation, permissions, lifecycle, rollback.

Row-lock serialization is PostgreSQL-specific (see test_postgres_concurrency.py,
gated on TEST_POSTGRES_URL). SQLite validates everything else, including the
single-statement atomic consume paths.
"""

import re
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.bookings.models import Booking, BookingItem, BookingSeat

User = get_user_model()

pytestmark = pytest.mark.django_db

RS_SECTIONS = [
    {"name": "Stalls", "price_inr": 500,
     "rows": [{"label": "A", "seats": [1, 2, 3], "accessible": [1]}]},
    {"name": "Balcony", "price_inr": 900,
     "rows": [{"label": "B", "seats": [1, 2]}]},
]


def make_user(email, role=User.Role.ATTENDEE):
    return User.objects.create_user(email=email, name=email.split("@")[0],
                                    password="password123", role=role)


def login(email):
    client = APIClient()
    res = client.post("/api/v1/auth/login",
                      {"email": email, "password": "password123"})
    assert res.status_code == 200, res.content
    return client


def make_rs_event(org_client, title="RS Show", sections=RS_SECTIONS):
    payload = {
        "title": title, "description": "Reserved seating test event.",
        "category": "MUSIC",
        "starts_at": (timezone.now() + timedelta(days=5)).isoformat(),
        "location": "Hall", "city": "Mumbai",
        "booking_mode": "RESERVED_SEATING", "sections": sections,
    }
    res = org_client.post("/api/v1/organizer/events", payload, format="json")
    assert res.status_code == 201, res.content
    return res.json()


def make_ga_event(org_client, title="GA Show", capacity=10, types=None):
    payload = {
        "title": title, "description": "General admission test event.",
        "category": "FOOD",
        "starts_at": (timezone.now() + timedelta(days=5)).isoformat(),
        "location": "Grounds", "city": "Delhi",
        "booking_mode": "GENERAL_ADMISSION", "capacity": capacity,
        "ticket_types": types or [
            {"name": "General", "price_inr": 199, "quantity_total": capacity}],
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


def seat_ids(event_detail, section="Stalls", row="A"):
    section_data = next(s for s in event_detail["sections"]
                        if s["name"] == section)
    row_data = next(r for r in section_data["rows"] if r["label"] == row)
    return [s["id"] for s in row_data["seats"]]


# ------------------------------------------------------------------ RS ----


def test_rs_booking_success_shape(org_client, attendee_client):
    event = make_rs_event(org_client)
    ids = seat_ids(event)[:2]
    res = attendee_client.post(f"/api/v1/events/{event['id']}/bookings",
                               {"seats": ids}, format="json")
    assert res.status_code == 201, res.content
    body = res.json()
    assert re.fullmatch(r"TD-[0-9A-F]{6}", body["reference"])
    assert body["status"] == "CONFIRMED"
    assert body["attendee"] == {"name": "att", "email": "att@example.com"}
    assert [s["label"] for s in body["seats"]] == ["A-1", "A-2"]
    assert body["seats"][0]["section"] == "Stalls"
    assert body["total_inr"] == 1000
    assert body["items"] == []


def test_rs_rejects_invalid_and_foreign_seats(org_client, attendee_client):
    event = make_rs_event(org_client)
    other = make_rs_event(org_client, title="Other RS")
    foreign = seat_ids(other)[:1]
    bad_uuid = "00000000-0000-4000-8000-000000000000"

    for payload in ({"seats": [bad_uuid]}, {"seats": foreign}, {"seats": []}):
        res = attendee_client.post(
            f"/api/v1/events/{event['id']}/bookings", payload, format="json")
        assert res.status_code in (409, 422), payload
    assert Booking.objects.count() == 0


def test_rs_rejects_duplicate_ids_in_payload(org_client, attendee_client):
    event = make_rs_event(org_client)
    dup = seat_ids(event)[:1] * 2
    res = attendee_client.post(f"/api/v1/events/{event['id']}/bookings",
                               {"seats": dup}, format="json")
    assert res.status_code == 422


def test_rs_rejects_unsellable_seats(org_client, attendee_client):
    sections = [{"name": "S", "price_inr": 10,
                 "rows": [{"label": "A", "seats": [1, 2], "sellable": [1]}]}]
    event = make_rs_event(org_client, sections=sections)
    hidden = seat_ids(event, section="S")
    assert len(hidden) == 2
    unsellable = [s["id"] for s in
                  event["sections"][0]["rows"][0]["seats"]][1:]
    res = attendee_client.post(f"/api/v1/events/{event['id']}/bookings",
                               {"seats": unsellable}, format="json")
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "SEAT_UNAVAILABLE"


def test_rs_second_booking_same_seat_fails_without_partial_rows(
        org_client, attendee_client):
    event = make_rs_event(org_client)
    ids = seat_ids(event)
    first = attendee_client.post(f"/api/v1/events/{event['id']}/bookings",
                                 {"seats": ids[:1]}, format="json")
    assert first.status_code == 201
    before_bookings = Booking.objects.count()
    before_links = BookingSeat.objects.count()
    res = attendee_client.post(f"/api/v1/events/{event['id']}/bookings",
                               {"seats": [ids[0], ids[1]]}, format="json")
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "SEAT_UNAVAILABLE"
    assert Booking.objects.count() == before_bookings
    assert BookingSeat.objects.count() == before_links


# ------------------------------------------------------------------ GA ----


def _type_id(event, name="General"):
    return next(t for t in event["ticket_types"]
                if t["name"] == name)["id"]


def test_ga_quantities_repeat_and_capacity(org_client, attendee_client):
    event = make_ga_event(org_client, capacity=5)
    tid = _type_id(event)
    url = f"/api/v1/events/{event['id']}/bookings"

    first = attendee_client.post(url, {"items": [
        {"ticket_type_id": tid, "quantity": 3}]}, format="json")
    assert first.status_code == 201, first.content
    assert first.json()["items"][0]["line_total"] == 3 * 199
    # Repeat purchases allowed...
    second = attendee_client.post(url, {"items": [
        {"ticket_type_id": tid, "quantity": 2}]}, format="json")
    assert second.status_code == 201
    # ...until capacity is exhausted.
    third = attendee_client.post(url, {"items": [
        {"ticket_type_id": tid, "quantity": 1}]}, format="json")
    assert third.status_code == 409
    assert third.json()["error"]["code"] in ("EVENT_SOLD_OUT",
                                             "TICKETS_UNAVAILABLE")


def test_ga_rejects_bad_quantities_and_types(org_client, attendee_client):
    event = make_ga_event(org_client)
    tid = _type_id(event)
    url = f"/api/v1/events/{event['id']}/bookings"
    bad_payloads = [
        {"items": [{"ticket_type_id": tid, "quantity": 0}]},
        {"items": [{"ticket_type_id": tid, "quantity": 11}]},
        {"items": [{"ticket_type_id": tid, "quantity": "2"}]},
        {"items": [{"ticket_type_id": tid, "quantity": 1},
                   {"ticket_type_id": tid, "quantity": 1}]},
        {"items": [{"ticket_type_id": "00000000-0000-4000-8000-000000000000",
                    "quantity": 1}]},
        {"items": []},
        {"seats": []},
    ]
    for payload in bad_payloads:
        res = attendee_client.post(url, payload, format="json")
        assert res.status_code in (409, 422), payload
    assert Booking.objects.count() == 0
    assert BookingItem.objects.count() == 0


def test_ga_free_type_consumes_capacity(org_client, attendee_client):
    event = make_ga_event(org_client, capacity=2, types=[
        {"name": "Free", "price_inr": 0, "quantity_total": 2}])
    tid = _type_id(event, "Free")
    url = f"/api/v1/events/{event['id']}/bookings"
    res = attendee_client.post(url, {"items": [
        {"ticket_type_id": tid, "quantity": 2}]}, format="json")
    assert res.status_code == 201
    assert res.json()["total_inr"] == 0
    res = attendee_client.post(url, {"items": [
        {"ticket_type_id": tid, "quantity": 1}]}, format="json")
    assert res.status_code == 409


def test_references_unique():
    make_user("o2@example.com", User.Role.ORGANIZER)
    org = login("o2@example.com")
    event = make_ga_event(org, title="Ref Show", capacity=12)
    tid = _type_id(event)
    refs = set()
    for _ in range(10):
        res = org.post(f"/api/v1/events/{event['id']}/bookings",
                       {"items": [{"ticket_type_id": tid, "quantity": 1}]},
                       format="json")
        assert res.status_code == 201, res.content
        refs.add(res.json()["reference"])
    assert len(refs) == 10
    assert all(re.fullmatch(r"TD-[0-9A-F]{6}", r) for r in refs)


# -------------------------------------------------------- guards ----


def test_booking_guards_suspended_cancelled_started(org_client,
                                                   attendee_client):
    from apps.events.models import Event

    event = make_ga_event(org_client)
    eid, url = event["id"], f"/api/v1/events/{event['id']}/bookings"
    tid = _type_id(event)
    if not User.objects.filter(email="admin@example.com").exists():
        User.objects.create_superuser(email="admin@example.com", name="Admin",
                                      password="admin12345")
    admin = APIClient()
    res = admin.post("/api/v1/auth/login",
                     {"email": "admin@example.com",
                      "password": "admin12345"})
    assert res.status_code == 200, res.content

    res = admin.patch(f"/api/v1/admin/events/{eid}/suspend",
                      {"reason": "Safety inspection this weekend."},
                      format="json")
    assert res.status_code == 200
    res = attendee_client.post(url, {"items": [
        {"ticket_type_id": tid, "quantity": 1}]}, format="json")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "EVENT_UNAVAILABLE"

    admin.patch(f"/api/v1/admin/events/{eid}/reactivate", {}, format="json")
    Event.objects.filter(pk=eid).update(
        starts_at=timezone.now() - timedelta(hours=1))
    res = attendee_client.post(url, {"items": [
        {"ticket_type_id": tid, "quantity": 1}]}, format="json")
    assert res.status_code == 403
    assert Booking.objects.count() == 0


def test_visibility_my_bookings_detail(org_client, attendee_client):
    make_user("other@example.com")
    other = login("other@example.com")
    event = make_rs_event(org_client)
    res = attendee_client.post(f"/api/v1/events/{event['id']}/bookings",
                               {"seats": seat_ids(event)[:1]}, format="json")
    bid = res.json()["id"]

    assert other.get(f"/api/v1/bookings/{bid}").status_code == 403
    assert other.get(f"/api/v1/bookings/{bid}").json()["error"]["code"] \
        == "BOOKING_FORBIDDEN"
    anon = APIClient()
    assert anon.get(f"/api/v1/bookings/{bid}").status_code == 403

    mine = attendee_client.get("/api/v1/bookings/me").json()
    assert mine["meta"]["total"] == 1
    assert other.get("/api/v1/bookings/me").json()["meta"]["total"] == 0

    # Owning organizer sees full detail; unrelated organizer is refused.
    assert org_client.get(f"/api/v1/bookings/{bid}").status_code == 200
    make_user("org2@example.com", User.Role.ORGANIZER)
    org2 = login("org2@example.com")
    assert org2.get(f"/api/v1/bookings/{bid}").status_code == 403


def test_organizer_event_bookings_lists_data(org_client, attendee_client):
    event = make_rs_event(org_client)
    attendee_client.post(f"/api/v1/events/{event['id']}/bookings",
                         {"seats": seat_ids(event)[:2]}, format="json")
    res = org_client.get(f"/api/v1/organizer/events/{event['id']}/bookings")
    assert res.status_code == 200
    body = res.json()
    assert body["meta"]["total"] == 1
    assert body["data"][0]["attendee"]["email"] == "att@example.com"
    assert len(body["data"][0]["seats"]) == 2


# -------------------------------------------------------- cancel ----


def test_cancel_releases_and_rebooks(org_client, attendee_client):
    event = make_rs_event(org_client)
    ids = seat_ids(event)[:2]
    booking_id = attendee_client.post(
        f"/api/v1/events/{event['id']}/bookings", {"seats": ids},
        format="json").json()["id"]

    res = attendee_client.post(f"/api/v1/bookings/{booking_id}/cancel")
    assert res.status_code == 200
    assert res.json()["status"] == "CANCELLED"
    assert BookingSeat.objects.filter(
        booking_id=booking_id, is_active=True).count() == 0

    again = attendee_client.post(f"/api/v1/events/{event['id']}/bookings",
                                 {"seats": ids}, format="json")
    assert again.status_code == 201  # seats freed

    res = attendee_client.post(f"/api/v1/bookings/{booking_id}/cancel")
    assert res.status_code == 409  # already cancelled
    assert res.json()["error"]["code"] == "BOOKING_NOT_CANCELLABLE"


def test_cancel_rules_others_and_past(org_client, attendee_client):
    from apps.events.models import Event

    event = make_ga_event(org_client)
    tid = _type_id(event)
    booking_id = attendee_client.post(
        f"/api/v1/events/{event['id']}/bookings",
        {"items": [{"ticket_type_id": tid, "quantity": 1}]},
        format="json").json()["id"]

    make_user("other@example.com")
    other = login("other@example.com")
    assert other.post(f"/api/v1/bookings/{booking_id}/cancel").status_code \
        == 404  # no existence oracle

    Event.objects.filter(pk=event["id"]).update(
        starts_at=timezone.now() - timedelta(hours=1))
    res = attendee_client.post(f"/api/v1/bookings/{booking_id}/cancel")
    assert res.status_code == 409


def test_ga_cancel_restores_capacity(org_client, attendee_client):
    event = make_ga_event(org_client, capacity=1)
    tid = _type_id(event)
    url = f"/api/v1/events/{event['id']}/bookings"
    booking_id = attendee_client.post(
        url, {"items": [{"ticket_type_id": tid, "quantity": 1}]},
        format="json").json()["id"]
    assert attendee_client.post(
        url, {"items": [{"ticket_type_id": tid, "quantity": 1}]},
        format="json").status_code == 409
    attendee_client.post(f"/api/v1/bookings/{booking_id}/cancel")
    again = attendee_client.post(url, {"items": [
        {"ticket_type_id": tid, "quantity": 1}]}, format="json")
    assert again.status_code == 201


# -------------------------------------------------- inventory locks ----


def test_inventory_locked_once_booked(org_client, attendee_client):
    event = make_rs_event(org_client)
    eid = event["id"]
    attendee_client.post(f"/api/v1/events/{eid}/bookings",
                         {"seats": seat_ids(event)[:1]}, format="json")

    res = org_client.post(f"/api/v1/organizer/events/{eid}/sections",
                          {"sections": []}, format="json")
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "INVENTORY_LOCKED"

    res = org_client.patch(f"/api/v1/organizer/events/{eid}",
                           {"booking_mode": "GENERAL_ADMISSION"},
                           format="json")
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "MODE_IMMUTABLE"

    res = org_client.patch(f"/api/v1/organizer/events/{eid}",
                           {"title": "Still editable"}, format="json")
    assert res.status_code == 200
    assert res.json()["title"] == "Still editable"


# -------------------------------------------------------- ticket token ----

def test_ticket_token_public_lookup(org_client, attendee_client):
    """Public QR-scan token lookup returns ticket-facing fields without auth."""
    event = make_ga_event(org_client)
    tid = _type_id(event)
    res = attendee_client.post(f"/api/v1/events/{event['id']}/bookings",
                               {"items": [{"ticket_type_id": tid, "quantity": 1}]},
                               format="json")
    assert res.status_code == 201
    body = res.json()
    assert "ticket_token" in body
    token = body["ticket_token"]
    assert len(token) > 0

    # Public lookup (no auth)
    anon = APIClient()
    res = anon.get(f"/api/v1/tickets/{token}")
    assert res.status_code == 200, res.content
    ticket_body = res.json()
    assert ticket_body["reference"] == body["reference"]
    assert ticket_body["status"] == "CONFIRMED"
    assert ticket_body["event"]["title"] == event["title"]
    assert ticket_body["event"]["location"] == event["location"]
    assert ticket_body["event"]["starts_at"] == event["starts_at"]


def test_ticket_token_unknown_404():
    """Unknown token returns 404."""
    anon = APIClient()
    res = anon.get("/api/v1/tickets/nonexistent-token")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "BOOKING_NOT_FOUND"


def test_ticket_token_cancelled_404(org_client, attendee_client):
    """Cancelled booking token returns 404 (no reactivation via QR)."""
    event = make_ga_event(org_client)
    tid = _type_id(event)
    res = attendee_client.post(f"/api/v1/events/{event['id']}/bookings",
                               {"items": [{"ticket_type_id": tid, "quantity": 1}]},
                               format="json")
    assert res.status_code == 201
    token = res.json()["ticket_token"]

    # Cancel the booking via admin
    if not User.objects.filter(email="admin@example.com").exists():
        User.objects.create_superuser(email="admin@example.com", name="Admin",
                                      password="admin12345")
    admin = APIClient()
    admin.post("/api/v1/auth/login",
               {"email": "admin@example.com", "password": "admin12345"})
    booking_id = res.json()["id"]
    res = admin.post(f"/api/v1/bookings/{booking_id}/cancel")
    assert res.status_code == 200
    assert res.json()["status"] == "CANCELLED"

    # Token lookup should now return 404
    anon = APIClient()
    res = anon.get(f"/api/v1/tickets/{token}")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "BOOKING_NOT_FOUND"
