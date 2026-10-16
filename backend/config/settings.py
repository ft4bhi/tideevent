"""TideEvent backend settings — single file, environment-driven.

Database:
  - App traffic uses DATABASE_URL, which must be the Neon **pooled**
    connection string (hostname contains ``-pooler``). PgBouncer runs in
    transaction mode, so persistent connections are disabled (CONN_MAX_AGE=0)
    and no client-side pooling is added on top.
  - Migrations (and pg_dump) must use DIRECT_URL, the Neon **direct**
    connection string. Run:  DATABASE_URL="$DIRECT_URL" python manage.py migrate
  - If DATABASE_URL is unset (local work without credentials), SQLite is used
    with a loud stdout warning. Never rely on SQLite for concurrency behavior;
    Postgres-only features are tested against Neon in later phases.
"""

import os
import sys
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-do-not-use-in-production")

DEBUG = os.environ.get("DJANGO_DEBUG", "True") == "True"

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if h.strip()
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "apps.accounts",
    "apps.events",
    "apps.bookings",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

# Contract paths have no trailing slashes (/auth/login, not /auth/login/).
# CommonMiddleware must not 301-redirect POSTs, so slash appending is off and
# every route is declared exactly.
APPEND_SLASH = False

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=0,  # required with Neon's PgBouncer (transaction mode)
            ssl_require=True,
        )
    }
else:
    print(
        "WARNING: DATABASE_URL is not set; using local SQLite. "
        "Set Neon pooled DATABASE_URL for real runs.",
        file=sys.stderr,
    )
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
            # File-backed (not :memory:) so threaded tests share one database.
            "TEST": {"NAME": BASE_DIR / "test_db.sqlite3"},
            "OPTIONS": {"timeout": 30},
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

AUTHENTICATION_BACKENDS = ["django.contrib.auth.backends.ModelBackend"]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "apps.accounts.permissions.IsAuthenticatedAndActive",
    ],
    "DEFAULT_PAGINATION_CLASS": "config.pagination.EnvelopePagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "auth": "10/min",
    },
    "EXCEPTION_HANDLER": "config.exceptions.envelope_exception_handler",
}

# --- Frontend origin (CORS + CSRF + invitation links) -----------------------
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", FRONTEND_URL).split(",")
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = list(CORS_ALLOWED_ORIGINS)

# --- Cookies ----------------------------------------------------------------
# Secure flags flip on automatically outside DEBUG *unless* explicitly set.
# There is no silent downgrade: production refuses to start without a real secret.
COOKIE_SECURE = os.environ.get("DJANGO_COOKIE_SECURE",
                               "False" if DEBUG else "True") == "True"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = COOKIE_SECURE
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7  # 1 week, sliding via SESSION_SAVE_EVERY_REQUEST=False
CSRF_COOKIE_HTTPONLY = False  # JS must read `csrftoken` to send X-CSRFToken
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = COOKIE_SECURE

if not DEBUG and SECRET_KEY == "dev-insecure-do-not-use-in-production":  # noqa: S105
    # S105 is a false positive here: this compares against the sentinel
    # default to REFUSE startup, never to authenticate anything.
    raise RuntimeError(
        "Refusing to start with the dev SECRET_KEY when DJANGO_DEBUG=False. "
        "Set DJANGO_SECRET_KEY in the environment."
    )

# --- Invitations ---------------------------------------------------------------
INVITATION_EXPIRY_DAYS = int(os.environ.get("INVITATION_EXPIRY_DAYS", "7"))

# CSRF/CORS for the Next.js frontend are wired in phase B1 alongside auth.
# Required env then: FRONTEND_URL (e.g. http://localhost:3000), EMAIL_* settings.
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)
