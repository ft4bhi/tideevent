"""Event routes (no trailing slashes — matches the contract)."""

from django.urls import path

from apps.bookings import views as booking_views

from . import views

urlpatterns = [
    path("events", views.event_list, name="event-list"),
    path("events/<uuid:pk>", views.event_detail, name="event-detail"),
    path("venue-templates", views.template_list, name="template-list"),
    path("organizer/events", views.organizer_events,
         name="organizer-events"),
    path("organizer/events/<uuid:pk>", views.organizer_event_detail,
         name="organizer-event-detail"),
    path("organizer/events/<uuid:pk>/bookings",
         booking_views.organizer_event_bookings,
         name="organizer-event-bookings"),
    path("organizer/events/<uuid:pk>/sections", views.organizer_event_sections,
         name="organizer-event-sections"),
    path("organizer/events/<uuid:pk>/layout", views.organizer_event_layout,
         name="organizer-event-layout"),
    path("organizer/events/<uuid:pk>/ticket-types",
         views.event_ticket_types_replace, name="organizer-event-ticket-types"),
    path("organizer/sections/<uuid:pk>/rows", views.section_rows_replace,
         name="section-rows-replace"),
    path("admin/events", views.admin_event_list, name="admin-event-list"),
    path("admin/events/<uuid:pk>/suspend", views.admin_event_suspend,
         name="admin-event-suspend"),
    path("admin/events/<uuid:pk>/reactivate", views.admin_event_reactivate,
         name="admin-event-reactivate"),
    path("admin/events/<uuid:pk>/cancel", views.admin_event_cancel,
         name="admin-event-cancel"),
]
