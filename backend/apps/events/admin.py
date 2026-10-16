"""Django admin for events/inventory (organizer workflows live in the API)."""

from django.contrib import admin

from .models import (
    Event,
    EventRow,
    EventSeat,
    EventSection,
    TicketType,
    VenueLayoutTemplate,
)


class EventSectionInline(admin.TabularInline):
    model = EventSection
    extra = 0
    fields = ("name", "price_inr", "sort_order")


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("title", "organizer", "booking_mode", "status",
                    "starts_at", "city")
    list_filter = ("booking_mode", "status", "category", "city")
    search_fields = ("title", "description", "location", "organizer__email")
    ordering = ("starts_at",)
    readonly_fields = ("created_at", "updated_at")
    inlines = (EventSectionInline,)


@admin.register(VenueLayoutTemplate)
class VenueLayoutTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    list_filter = ("is_active",)
    readonly_fields = ("created_at",)


@admin.register(EventSection)
class EventSectionAdmin(admin.ModelAdmin):
    list_display = ("name", "event", "price_inr", "sort_order")
    search_fields = ("name", "event__title")


@admin.register(EventRow)
class EventRowAdmin(admin.ModelAdmin):
    list_display = ("label", "section")
    search_fields = ("label", "section__name")


@admin.register(EventSeat)
class EventSeatAdmin(admin.ModelAdmin):
    list_display = ("number", "row", "is_accessible", "is_sellable")
    list_filter = ("is_accessible", "is_sellable")


@admin.register(TicketType)
class TicketTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "event", "price_inr", "quantity_total")
    search_fields = ("name", "event__title")
