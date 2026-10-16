"""Bookings app: bookings, seats/lines, cancel flow, concurrency (B3)."""

from django.apps import AppConfig


class BookingsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.bookings"
    label = "bookings"
