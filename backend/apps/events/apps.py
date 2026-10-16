"""Events app: events, venue templates, sections/rows/seats, ticket types (B2)."""

from django.apps import AppConfig


class EventsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.events"
    label = "events"
