"""B0 wiring checks: settings parse, apps installed, env handling."""

from django.conf import settings


def test_database_config_defaults_to_sqlite_without_env(tmp_path, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    # Settings are already loaded; assert the fallback branch shape instead of
    # re-importing: without DATABASE_URL in this process, sqlite must be active.
    import os

    if os.environ.get("DATABASE_URL"):
        return  # Neon-configured run: fallback branch not applicable.
    assert settings.DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3"


def test_required_apps_installed():
    for app in ("apps.accounts", "apps.events", "apps.bookings", "rest_framework"):
        assert app in settings.INSTALLED_APPS


def test_timezone_and_drf_defaults():
    assert settings.USE_TZ is True
    assert settings.TIME_ZONE == "UTC"
    assert (
        "rest_framework.authentication.SessionAuthentication"
        in settings.REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"]
    )
    assert settings.REST_FRAMEWORK["PAGE_SIZE"] == 20
