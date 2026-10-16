"""B1 production-safety tests: no silent security downgrades.

Secret handling is validated against real process startup (subprocess) because
settings are evaluated at import time.
"""

import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def run_check(extra_env):
    env = {**os.environ, **extra_env}
    return subprocess.run(
        [sys.executable, "manage.py", "check"],
        cwd=BACKEND_DIR,
        check=False,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )


def test_dev_defaults_are_documented_and_safe():
    from django.conf import settings

    assert settings.SESSION_COOKIE_HTTPONLY is True
    # JS must read csrftoken to send X-CSRFToken; HttpOnly would break login.
    assert settings.CSRF_COOKIE_HTTPONLY is False
    assert settings.CSRF_COOKIE_SAMESITE == "Lax"
    assert settings.APPEND_SLASH is False


def test_production_refuses_dev_secret():
    # Pass the dev sentinel explicitly: hermetic regardless of any local
    # .env (load_dotenv never overrides real environment variables).
    proc = run_check({
        "DJANGO_DEBUG": "False",
        "DJANGO_SECRET_KEY": "dev-insecure-do-not-use-in-production",
    })
    assert proc.returncode != 0
    assert "DJANGO_SECRET_KEY" in proc.stderr


def test_production_starts_with_real_secret():
    proc = run_check({
        "DJANGO_DEBUG": "False",
        "DJANGO_SECRET_KEY": "test-only-long-random-secret-value-123",
    })
    assert proc.returncode == 0, proc.stderr
