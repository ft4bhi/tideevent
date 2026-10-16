"""B2 API tests: public discovery, organizer CRUD + inventory, admin lifecycle."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

User = get_user_model()

pytestmark = pytest.mark.django_db

RS_PAYLOAD = {
    "title": "Jazz Night", "description": "An evening of jazz standards.",
    "category": "MUSIC",
    "starts_at": (timezone.now() + timedelta(days=5)).isoformat(),
    "location": "NCPA", "city": "Mumbai", "booking_mode": "RESERVED_SEATING",
    "sections": [
        {"name": "Stalls", "price_inr": 500,
         "rows": [{"label": "A", "seats": [1, 2, 3], "accessible": [1]}]},
        {"name": "Balcony", "price_inr": 900,
         "rows": [{"label": "B", "seats": [1, 2]}]},
    ],
}

GA_PAYLOAD = {
    "title": "Food Fest", "description": "Street food from across India.",
    "category": "FOOD",
    "starts_at": (timezone.now() + timedelta(days=6)).isoformat(),
    "location": "Grounds", "city": "Delhi", "booking_mode": "GENERAL_ADMISSION",
    "capacity": 500,
    "ticket_types": [
        {"name": "General", "price_inr": 199, "quantity_total": 400},
        {"name": "Student", "price_inr": 0, "quantity_total": 50},
    ],
}


def make_user(email, role=User.Role.ATTENDEE):
    return User.objects.create_user(email=email, name=email.split("@")[0],
                                    password="password123", role=role)


def authed(email, role=User.Role.ATTENDEE):
    make_user(email, role)
    client = APIClient()
    client.post("/api/v1/auth/login",
                {"email": email, "password": "password123"})
    return client


def create_event(client, payload):
    res = client.post("/api/v1/organizer/events", payload, format="json")
    assert res.status_code == 201, res.content
    return res.json()


# ------------------------------------------------------------- public ----


def test_create_publishes_active_immediately_and_lists_publicly():
    org = authed("org@example.com", User.Role.ORGANIZER)
    created = create_event(org, dict(RS_PAYLOAD))
    assert created["status"] == "ACTIVE"
    assert created["remaining"] == 5
    assert created["starting_price_inr"] == 500
    assert created["sections"][0]["rows"][0]["seats"][0]["booked"] is False

    anon = APIClient()
    listing = anon.get("/api/v1/events")
    assert listing.status_code == 200
    body = listing.json()
    assert body["meta"]["total"] == 1
    assert set(body.keys()) == {"data", "meta"}
    assert body["data"][0]["id"] == created["id"]

    detail = anon.get(f"/api/v1/events/{created['id']}")
    assert detail.status_code == 200
    assert detail.json()["organizer_name"] == "org"


def test_public_filters_and_pagination_envelope():
    org = authed("org@example.com", User.Role.ORGANIZER)
    create_event(org, dict(RS_PAYLOAD))
    create_event(org, dict(GA_PAYLOAD))
    anon = APIClient()
    assert anon.get("/api/v1/events",
                    {"category": "FOOD"}).json()["meta"]["total"] == 1
    assert anon.get("/api/v1/events",
                    {"city": "Mumbai"}).json()["meta"]["total"] == 1
    assert anon.get("/api/v1/events",
                    {"q": "jazz"}).json()["meta"]["total"] == 1
    assert anon.get("/api/v1/events",
                    {"q": "nothing"}).json()["meta"]["total"] == 0
    page = anon.get("/api/v1/events", {"per_page": 1})
    assert page.json()["meta"] == {"total": 2, "page": 1, "per_page": 1}


def test_missing_event_is_404_envelope():
    anon = APIClient()
    res = anon.get("/api/v1/events/00000000-0000-4000-8000-000000000000")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "EVENT_NOT_FOUND"


# ---------------------------------------------------------- organizer ----


def test_attendee_cannot_create_events():
    att = authed("att@example.com")
    res = att.post("/api/v1/organizer/events", GA_PAYLOAD, format="json")
    assert res.status_code == 403


def test_ownership_enforced_on_edit_and_inventory():
    org_a = authed("a@example.com", User.Role.ORGANIZER)
    org_b = authed("b@example.com", User.Role.ORGANIZER)
    created = create_event(org_a, dict(GA_PAYLOAD))
    eid = created["id"]

    res = org_b.patch(f"/api/v1/organizer/events/{eid}",
                      {"title": "Hijacked"}, format="json")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "NOT_EVENT_OWNER"

    res = org_b.post(f"/api/v1/organizer/events/{eid}/ticket-types",
                     {"ticket_types": []}, format="json")
    assert res.status_code == 403

    res = org_b.get(f"/api/v1/organizer/events/{eid}/bookings")
    assert res.status_code == 403

    mine = org_b.get("/api/v1/organizer/events").json()
    assert mine["meta"]["total"] == 0


def test_organizer_cannot_set_status():
    org = authed("org@example.com", User.Role.ORGANIZER)
    created = create_event(org, dict(GA_PAYLOAD))
    res = org.patch(f"/api/v1/organizer/events/{created['id']}",
                    {"status": "SUSPENDED"}, format="json")
    assert res.status_code == 422


def test_inventory_replace_and_template_instantiation():
    org = authed("org@example.com", User.Role.ORGANIZER)
    created = create_event(org, dict(RS_PAYLOAD))
    eid = created["id"]

    res = org.post(f"/api/v1/organizer/events/{eid}/sections", {
        "sections": [{"name": "Floor", "price_inr": 100,
                      "rows": [{"label": "A", "seats": [1, 2]}]}],
    }, format="json")
    assert res.status_code == 200
    assert res.json()["remaining"] == 2

    # RS create requires sections; GA events reject template instantiation.
    bare = dict(RS_PAYLOAD, title="Template Hall")
    bare.pop("sections")
    res = org.post("/api/v1/organizer/events", bare, format="json")
    assert res.status_code == 422  # RS requires sections on create
    templates = org.get("/api/v1/venue-templates").json()
    assert len(templates) == 5
    cinema = next(t for t in templates if t["slug"] == "cinema")

    fresh = create_event(org, dict(GA_PAYLOAD, title="GA Only"))
    res = org.post(f"/api/v1/organizer/events/{fresh['id']}/layout",
                   {"template_id": cinema["id"]}, format="json")
    assert res.status_code == 422  # templates are RS-only


def test_from_template_builds_seats():
    org = authed("org@example.com", User.Role.ORGANIZER)
    templates = org.get("/api/v1/venue-templates").json()
    assert len(templates) == 5
    cinema = next(t for t in templates if t["slug"] == "cinema")

    # Create directly from a template (alternative to hand-built sections).
    payload = dict(GA_PAYLOAD, title="Cinema Night",
                   booking_mode="RESERVED_SEATING", template_id=cinema["id"])
    payload.pop("capacity")
    payload.pop("ticket_types")
    created = create_event(org, payload)
    assert created["remaining"] == 120
    assert created["sections"][0]["name"] == "Classic"

    # Or clear a hand-built layout, then instantiate a template.
    payload2 = dict(RS_PAYLOAD, title="Rebuilt Hall")
    created2 = create_event(org, payload2)
    res = org.post(f"/api/v1/organizer/events/{created2['id']}/sections",
                   {"sections": []}, format="json")
    assert res.status_code == 200
    assert res.json()["remaining"] == 0
    custom = next(t for t in templates if t["slug"] == "custom-basic")
    res = org.post(f"/api/v1/organizer/events/{created2['id']}/layout",
                   {"template_id": custom["id"]}, format="json")
    assert res.status_code == 201
    assert res.json()["remaining"] == 30


def test_ticket_types_replace_validates_totals():
    org = authed("org@example.com", User.Role.ORGANIZER)
    created = create_event(org, dict(GA_PAYLOAD))
    eid = created["id"]
    res = org.post(f"/api/v1/organizer/events/{eid}/ticket-types", {
        "ticket_types": [{"name": "Overflow", "price_inr": 10,
                          "quantity_total": 99999}]}, format="json")
    assert res.status_code == 422
    res = org.post(f"/api/v1/organizer/events/{eid}/ticket-types", {
        "ticket_types": [{"name": "Early", "price_inr": 99,
                          "quantity_total": 100}]}, format="json")
    assert res.status_code == 200
    assert res.json()["ticket_types"][0]["remaining"] == 100


# -------------------------------------------------------------- admin ----


def admin_client():
    User.objects.create_superuser(email="admin@example.com", name="Admin",
                                  password="admin12345")
    client = APIClient()
    client.post("/api/v1/auth/login",
                {"email": "admin@example.com", "password": "admin12345"})
    return client


def test_admin_suspend_reactivate_cancel_lifecycle():
    org = authed("org@example.com", User.Role.ORGANIZER)
    created = create_event(org, dict(GA_PAYLOAD))
    eid = created["id"]
    admin = admin_client()

    res = admin.patch(f"/api/v1/admin/events/{eid}/suspend", {}, format="json")
    assert res.status_code == 422  # reason required
    res = admin.patch(f"/api/v1/admin/events/{eid}/suspend",
                      {"reason": "Safety inspection this weekend."},
                      format="json")
    assert res.status_code == 200
    assert res.json()["status"] == "SUSPENDED"

    anon = APIClient()
    assert anon.get("/api/v1/events").json()["meta"]["total"] == 0
    assert anon.get(f"/api/v1/events/{eid}").status_code == 404
    # Owner still sees it with the banner state.
    assert org.get(f"/api/v1/events/{eid}").json()["status"] == "SUSPENDED"

    res = admin.patch(f"/api/v1/admin/events/{eid}/reactivate", {}, format="json")
    assert res.json()["status"] == "ACTIVE"
    assert anon.get("/api/v1/events").json()["meta"]["total"] == 1

    res = admin.patch(f"/api/v1/admin/events/{eid}/cancel",
                      {"reason": "Artist withdrew permanently."}, format="json")
    assert res.json()["status"] == "CANCELLED"
    assert anon.get("/api/v1/events").json()["meta"]["total"] == 0
    # Cancelled is terminal.
    res = admin.patch(f"/api/v1/admin/events/{eid}/reactivate", {}, format="json")
    assert res.status_code == 409


def test_non_admin_cannot_touch_lifecycle():
    org = authed("org@example.com", User.Role.ORGANIZER)
    created = create_event(org, dict(GA_PAYLOAD))
    eid = created["id"]
    res = org.patch(f"/api/v1/admin/events/{eid}/suspend",
                    {"reason": "I want this to work but it must not."},
                    format="json")
    assert res.status_code == 403


def test_admin_event_list_filters_and_bookings_shape():
    org = authed("org@example.com", User.Role.ORGANIZER)
    created = create_event(org, dict(GA_PAYLOAD))
    admin = admin_client()
    all_events = admin.get("/api/v1/admin/events").json()
    assert all_events["meta"]["total"] == 1
    assert admin.get("/api/v1/admin/events",
                     {"status": "SUSPENDED"}).json()["meta"]["total"] == 0
    bookings = org.get(f"/api/v1/organizer/events/{created['id']}/bookings")
    assert bookings.json()["meta"]["total"] == 0


# -------------------------------------------------------------- invalid ----

def test_invalid_configurations_rejected():
    org = authed("org@example.com", User.Role.ORGANIZER)
    base = dict(GA_PAYLOAD)

    past = dict(base, starts_at="2020-01-01T10:00:00+00:00")
    assert org.post("/api/v1/organizer/events", past,
                    format="json").status_code == 422

    no_capacity = dict(base)
    no_capacity.pop("capacity")
    assert org.post("/api/v1/organizer/events", no_capacity,
                    format="json").status_code == 422

    overbooked = dict(base, capacity=10)
    assert org.post("/api/v1/organizer/events", overbooked,
                    format="json").status_code == 422

    rs_no_sections = dict(RS_PAYLOAD, sections=[])
    assert org.post("/api/v1/organizer/events", rs_no_sections,
                    format="json").status_code == 422

    dup_rows = dict(RS_PAYLOAD)
    dup_rows["sections"] = [{"name": "S", "price_inr": 10, "rows": [
        {"label": "A", "seats": [1, 1]}]}]
    assert org.post("/api/v1/organizer/events", dup_rows,
                    format="json").status_code == 422

    dup_sections = dict(RS_PAYLOAD)
    dup_sections["sections"] = [
        {"name": "Same", "price_inr": 10,
         "rows": [{"label": "A", "seats": [1]}]},
        {"name": "same", "price_inr": 20,
         "rows": [{"label": "B", "seats": [1]}]}]
    assert org.post("/api/v1/organizer/events", dup_sections,
                    format="json").status_code == 422


# ------------------------------------------- invitation -> organizer ----


def test_invited_organizer_can_publish_immediately():
    """B1 flow hands off to B2: accepted invitation, then ACTIVE event."""
    from unittest import mock

    from apps.accounts.models import OrganizerInvitation

    User.objects.create_superuser(email="admin@example.com", name="Admin",
                                  password="admin12345")
    admin = APIClient()
    admin.post("/api/v1/auth/login",
               {"email": "admin@example.com", "password": "admin12345"})
    with mock.patch("apps.accounts.views.emails.send_invitation_email",
                     return_value=True) as send:
        assert admin.post("/api/v1/admin/invitations",
                          {"email": "neworg@example.com"}).status_code == 201
        raw = send.call_args[0][1]

    assert OrganizerInvitation.objects.get(
        email="neworg@example.com").status == "PENDING"
    guest = APIClient()
    res = guest.post("/api/v1/invitations/accept",
                     {"token": raw, "name": "New Org",
                      "password": "password123"})
    assert res.status_code == 201
    assert res.json()["user"]["role"] == "ORGANIZER"

    created = create_event(guest, dict(GA_PAYLOAD, title="Invited Show"))
    assert created["status"] == "ACTIVE"
    assert APIClient().get("/api/v1/events").json()["meta"]["total"] == 1
