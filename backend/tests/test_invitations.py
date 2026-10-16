"""B1 invitation tests: issuance, security properties, acceptance policy."""

import hashlib
import threading
from datetime import timedelta
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import OrganizerInvitation

User = get_user_model()

pytestmark = pytest.mark.django_db


def make_admin():
    admin, created = User.objects.get_or_create(
        email="admin@example.com",
        defaults={"name": "Admin", "role": User.Role.ADMIN,
                  "is_staff": True, "is_superuser": True},
    )
    if created:
        admin.set_password("admin12345")
        admin.save()
    return admin


def admin_client():
    make_admin()
    client = APIClient()
    client.post("/api/v1/auth/login",
                {"email": "admin@example.com", "password": "admin12345"})
    return client


def invite(client, email="org@example.com"):
    return client.post("/api/v1/admin/invitations", {"email": email})


def capture_token(email="org@example.com"):
    """Issue via the API while capturing the raw emailed token."""
    client = admin_client()
    with mock.patch("apps.accounts.views.emails.send_invitation_email") as send:
        send.side_effect = lambda to, raw: True
        res = invite(client, email)
        assert res.status_code == 201, res.content
        raw = send.call_args[0][1]
    return raw


def test_only_admins_can_invite():
    User.objects.create_user(email="a@example.com", name="A",
                             password="password123")
    anon = APIClient()
    # Anonymous -> 403 under session auth (401 coerced, no WWW-Authenticate).
    assert anon.post("/api/v1/admin/invitations",
                     {"email": "x@example.com"}).status_code == 403
    user_client = APIClient()
    user_client.post("/api/v1/auth/login",
                     {"email": "a@example.com", "password": "password123"})
    res = user_client.post("/api/v1/admin/invitations", {"email": "x@example.com"})
    assert res.status_code == 403


def test_invite_stores_hash_only_and_sends_link():
    raw = capture_token()
    inv = OrganizerInvitation.objects.get(email="org@example.com")
    assert inv.token_hash == hashlib.sha256(raw.encode()).hexdigest()
    assert inv.token_hash != raw
    assert len(raw) >= 32  # token_urlsafe(32): unpredictable


def test_invite_email_content_and_honest_failure():
    client = admin_client()
    with override_settings(
            EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"):
        res = invite(client, "mail@example.com")
        assert res.status_code == 201
        assert res.json()["email_sent"] is True
        assert len(mail.outbox) == 1
        body = mail.outbox[0].body
        assert "/invite/accept?token=" in body
        assert "password" not in body.lower()
    # Delivery failure: still 201 PENDING, but honestly reported.
    # (Patch send_mail itself: the wrapper under test must do the catching;
    # raise a realistic smtplib error, not a bare Exception.)
    import smtplib

    with mock.patch("apps.accounts.emails.send_mail",
                    side_effect=smtplib.SMTPException("smtp down")):
        res = invite(client, "fail@example.com")
        assert res.status_code == 201
        data = res.json()
        assert data["email_sent"] is False
        assert "warning" in data
        inv = OrganizerInvitation.objects.get(email="fail@example.com")
        assert inv.status == "PENDING"


def test_replacement_revokes_previous():
    first_raw = capture_token("same@example.com")
    capture_token("same@example.com")
    invs = OrganizerInvitation.objects.filter(email="same@example.com")
    assert invs.filter(status="REVOKED").count() == 1
    assert invs.filter(status="PENDING").count() == 1
    client = APIClient()
    # Revoked links report REVOKED (not silent 404) so holders know why.
    res = client.post("/api/v1/invitations/accept",
                      {"token": first_raw, "name": "N", "password": "password123"})
    assert res.status_code == 410
    assert res.json()["error"]["code"] == "INVITATION_REVOKED"


def test_validate_endpoint_states():
    raw = capture_token()
    anon = APIClient()
    ok = anon.get("/api/v1/invitations/validate", {"token": raw})
    assert ok.json()["valid"] is True
    assert ok.json()["email"] == "org@example.com"
    bad = anon.get("/api/v1/invitations/validate", {"token": "nope"})
    assert bad.status_code == 404
    assert bad.json()["error"]["code"] == "INVITATION_INVALID"
    OrganizerInvitation.objects.filter(email="org@example.com").update(
        expires_at=timezone.now() - timedelta(seconds=1))
    gone = anon.get("/api/v1/invitations/validate", {"token": raw})
    assert gone.json()["valid"] is False
    assert gone.json()["code"] == "INVITATION_EXPIRED"


def test_accept_creates_organizer_and_consumes_once():
    raw = capture_token()
    anon = APIClient()
    res = anon.post("/api/v1/invitations/accept",
                    {"token": raw, "name": "Org", "password": "password123"})
    assert res.status_code == 201, res.content
    assert res.json()["user"]["role"] == "ORGANIZER"
    inv = OrganizerInvitation.objects.get(email="org@example.com")
    assert inv.status == "ACCEPTED"
    assert inv.accepted_by.email == "org@example.com"
    again = anon.post("/api/v1/invitations/accept",
                      {"token": raw, "name": "Org", "password": "password123"})
    assert again.status_code == 410
    assert again.json()["error"]["code"] == "INVITATION_USED"


@pytest.mark.django_db(transaction=True)
def test_concurrent_accept_consumes_only_once():
    """The invitation is consumed exactly once under concurrent accepts.

    Guarantee under test (backend-independent): a single conditional UPDATE
    flips PENDING -> ACCEPTED, so at most one request can ever win; the loser
    observes USED. Locking note: on SQLite the winner's *response* can be
    lost to file-lock contention on the session write even though its
    transaction committed — hence we assert end state (one ACCEPTED, one
    user, never two 201s) rather than the exact response pair. True row-lock
    behavior is verified on PostgreSQL (specs/09 §4, milestone B3).
    """
    import time

    from django.db import OperationalError

    raw = capture_token("race@example.com")
    barrier = threading.Barrier(3)
    results = []

    def attempt(i):
        client = APIClient()
        barrier.wait(timeout=10)
        outcome = None
        for _ in range(40):
            try:
                outcome = client.post("/api/v1/invitations/accept", {
                    "token": raw, "name": f"R{i}", "password": "password123",
                }).status_code
                break
            except OperationalError:
                time.sleep(0.05)  # loser waits, then sees the committed consume
        results.append(outcome)

    threads = [threading.Thread(target=attempt, args=(i,)) for i in range(2)]
    for t in threads:
        t.start()
    barrier.wait(timeout=10)
    for t in threads:
        t.join(timeout=60)
    assert all(code in (201, 410) for code in results)
    assert results.count(201) <= 1
    assert OrganizerInvitation.objects.filter(
        email="race@example.com", status="ACCEPTED").count() == 1
    assert User.objects.filter(email="race@example.com").count() == 1


def test_existing_attendee_policy_login_then_upgrade():
    User.objects.create_user(email="att@example.com", name="Att",
                             password="password123")
    raw = capture_token("att@example.com")
    anon = APIClient()
    # Anonymous acceptance for a registered email is refused, invitation kept.
    res = anon.post("/api/v1/invitations/accept",
                    {"token": raw, "name": "Att", "password": "password123"})
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "INVITATION_LOGIN_REQUIRED"
    assert OrganizerInvitation.objects.get(email="att@example.com").status == "PENDING"
    # Normal login never promotes...
    client = APIClient()
    client.post("/api/v1/auth/login",
                {"email": "att@example.com", "password": "password123"})
    assert client.get("/api/v1/auth/me").json()["user"]["role"] == "ATTENDEE"
    # ...but explicit acceptance as the matching account upgrades.
    res = client.post("/api/v1/invitations/accept", {"token": raw})
    assert res.status_code == 201
    assert res.json()["user"]["role"] == "ORGANIZER"


def test_accept_bound_to_email_and_never_admin():
    User.objects.create_user(email="a@example.com", name="A",
                             password="password123")
    User.objects.create_user(email="b@example.com", name="B",
                             password="password123")
    raw = capture_token("b@example.com")
    client = APIClient()
    client.post("/api/v1/auth/login",
                {"email": "a@example.com", "password": "password123"})
    res = client.post("/api/v1/invitations/accept", {"token": raw})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "INVITATION_EMAIL_MISMATCH"
    assert OrganizerInvitation.objects.get(email="b@example.com").status == "PENDING"
    # No path to ADMIN through invitations: the only ADMIN is the seeded one.
    assert set(User.objects.filter(role="ADMIN").values_list("email", flat=True)) == {
        "admin@example.com"
    }


def test_expired_revoked_rejected():
    raw = capture_token("old@example.com")
    OrganizerInvitation.objects.filter(email="old@example.com").update(
        expires_at=timezone.now() - timedelta(seconds=1))
    anon = APIClient()
    res = anon.post("/api/v1/invitations/accept",
                    {"token": raw, "name": "O", "password": "password123"})
    assert res.status_code == 410
    assert OrganizerInvitation.objects.get(email="old@example.com").status == "EXPIRED"

    raw2 = capture_token("rev@example.com")
    admin = admin_client()
    inv = OrganizerInvitation.objects.get(email="rev@example.com")
    assert admin.post(f"/api/v1/admin/invitations/{inv.pk}/revoke").status_code == 200
    res = anon.post("/api/v1/invitations/accept",
                    {"token": raw2, "name": "O", "password": "password123"})
    assert res.status_code == 410
    assert res.json()["error"]["code"] == "INVITATION_REVOKED"


def test_resend_rotates_token_and_lists_hide_tokens():
    raw = capture_token("re@example.com")
    admin = admin_client()
    inv = OrganizerInvitation.objects.get(email="re@example.com")
    with mock.patch("apps.accounts.views.emails.send_invitation_email") as send:
        send.side_effect = lambda to, tok: True
        res = admin.post(f"/api/v1/admin/invitations/{inv.pk}/resend")
        assert res.status_code == 200
        new_raw = send.call_args[0][1]
    assert new_raw != raw
    anon = APIClient()
    assert anon.post("/api/v1/invitations/accept",
                     {"token": raw, "name": "O",
                      "password": "password123"}).status_code == 404
    listing = admin.get("/api/v1/admin/invitations")
    assert listing.status_code == 200
    item = listing.json()[0]
    assert "token_hash" not in item
    assert not any("token" in key for key in item)
