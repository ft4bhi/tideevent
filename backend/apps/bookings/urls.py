"""Booking routes (no trailing slashes — matches the contract)."""

from django.urls import path

from . import views

urlpatterns = [
    path("events/<uuid:pk>/bookings", views.booking_create,
         name="booking-create"),
    path("bookings/me", views.my_bookings, name="my-bookings"),
    path("bookings/<uuid:pk>", views.booking_detail, name="booking-detail"),
    path("bookings/<uuid:pk>/cancel", views.booking_cancel,
         name="booking-cancel"),
    path("tickets/<str:token>", views.ticket_by_token, name="ticket-by-token"),
]
