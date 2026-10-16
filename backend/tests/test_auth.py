"""B1 account tests: registration, login, sessions, roles, suspension."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()

pytestmark = pytest.mark.django_db


def make_user(email="att@example.com", password="password123",
              role=User.Role.ATTENDEE, name="Att"):
    return User.objects.create_user(email=email, name=name,
                                    password=password, role=role)


def csrf_client():
    """Client with CSRF checks on, pre-bootstrapped with a csrftoken cookie
    (mirrors the SPA, which GETs /auth/me on load)."""
    client = APIClient(enforce_csrf_checks=True)
    client.get("/api/v1/auth/me")
    return client


def csrf_post(client, path, payload):
    return client.post(path, payload,
                       HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value)


def test_register_creates_attendee_and_logs_in():
    client = APIClient(enforce_csrf_checks=True)
    res = client.post("/api/v1/auth/register", {
        "name": "New User", "email": "New@Example.com", "password": "password123",
    })
    assert res.status_code == 201, res.content
    body = res.json()["user"]
    assert body["email"] == "new@example.com"  # normalized
    assert body["role"] == "ATTENDEE"
    assert "password" not in body
    user = User.objects.get(email="new@example.com")
    assert user.password.startswith("pbkdf2_")  # hashed, never plain
    assert user.check_password("password123")
    # Auto-login: session cookie set, me resolves.
    assert "sessionid" in res.cookies
    me = client.get("/api/v1/auth/me")
    assert me.json()["user"]["email"] == "new@example.com"


def test_register_duplicate_email_case_insensitive():
    make_user(email="dup@example.com")
    client = APIClient()
    res = client.post("/api/v1/auth/register", {
        "name": "X", "email": "DUP@example.com", "password": "password123"})
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "EMAIL_EXISTS"


def test_register_rejects_role_escalation():
    client = APIClient()
    for role in ("ORGANIZER", "ADMIN"):
        res = client.post("/api/v1/auth/register", {
            "name": "X", "email": f"{role.lower()}@example.com",
            "password": "password123", "role": role})
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "ROLE_NOT_ALLOWED"
    assert User.objects.count() == 0


def test_register_validation_errors_are_field_mapped():
    client = APIClient()
    res = client.post("/api/v1/auth/register",
                      {"name": "", "email": "bad", "password": "short"})
    assert res.status_code == 422
    body = res.json()["error"]
    assert body["code"] == "VALIDATION_ERROR"
    assert {"name", "email", "password"} <= set(body["fields"])


def test_login_logout_session_lifecycle():
    make_user()
    client = csrf_client()
    res = csrf_post(client, "/api/v1/auth/login",
                    {"email": "att@example.com", "password": "password123"})
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "ATTENDEE"
    out = csrf_post(client, "/api/v1/auth/logout", {})
    assert out.status_code == 204
    me = client.get("/api/v1/auth/me")
    assert me.json() == {"user": None}


def test_login_wrong_credentials_no_leak():
    make_user()
    client = APIClient()
    for payload in ({"email": "att@example.com", "password": "nope-nope"},
                    {"email": "nobody@example.com", "password": "password123"}):
        res = client.post("/api/v1/auth/login", payload)
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_suspended_account_cannot_use_app():
    make_user()
    client = csrf_client()
    csrf_post(client, "/api/v1/auth/login",
              {"email": "att@example.com", "password": "password123"})
    User.objects.filter(email="att@example.com").update(status="SUSPENDED")
    # Existing session is now useless on protected endpoints...
    res = csrf_post(client, "/api/v1/auth/logout", {})
    assert res.status_code == 403
    # ...and re-login is refused with the explicit code.
    res = csrf_post(client, "/api/v1/auth/login",
                    {"email": "att@example.com", "password": "password123"})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "ACCOUNT_SUSPENDED"


def test_anonymous_protected_endpoint_is_forbidden():
    # NOTE: with session auth DRF coerces anonymous 401 -> 403 (no
    # WWW-Authenticate header). Clients treat both as "log in".
    client = APIClient()
    res = client.post("/api/v1/auth/logout", {})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


def test_me_anonymous_returns_null_user():
    res = APIClient().get("/api/v1/auth/me")
    assert res.status_code == 200
    assert res.json() == {"user": None}


def test_csrf_enforced_for_unsafe_requests():
    # NOTE: DRF marks API views csrf_exempt and enforces CSRF itself only for
    # session-authenticated requests (anonymous unsafe requests carry no
    # session to forge). The meaningful check: an authenticated session
    # without X-CSRFToken is rejected.
    make_user(email="x@example.com")
    client = csrf_client()
    csrf_post(client, "/api/v1/auth/login",
              {"email": "x@example.com", "password": "password123"})
    # Session now exists; same client, fresh token read after login rotation.
    token = client.cookies["csrftoken"].value
    res = client.post("/api/v1/auth/logout", {})
    assert res.status_code == 403
    res = client.post("/api/v1/auth/logout", {}, HTTP_X_CSRFTOKEN=token)
    assert res.status_code == 204


def test_auth_throttle_returns_envelope_429():
    # NOTE: throttle rates bind at import, so override_settings cannot change
    # them; patch the throttle class directly (documented DRF testing gotcha).
    from unittest import mock as mock_module

    from django.core.cache import cache

    from apps.accounts.views import AuthThrottle

    cache.clear()
    with mock_module.patch.object(AuthThrottle, "THROTTLE_RATES", {"auth": "1/min"}):
        # Fresh client per request: register auto-logs-in, and authenticated
        # requests rightly bypass the *anonymous* throttle. The throttle is
        # per-IP, so two anonymous clients share one bucket.
        first = APIClient().post("/api/v1/auth/register", {
            "name": "A", "email": "t1@example.com", "password": "password123"})
        assert first.status_code == 201
        second = APIClient().post("/api/v1/auth/register", {
            "name": "B", "email": "t2@example.com", "password": "password123"})
        assert second.status_code == 429
        assert second.json()["error"]["code"] == "RATE_LIMITED"
    cache.clear()
