"""Django admin for bookings (read-heavy; history is never edited)."""

from django.contrib import admin

from .models import Booking, BookingItem, BookingSeat


class BookingSeatInline(admin.TabularInline):
    model = BookingSeat
    extra = 0
    readonly_fields = ("seat", "is_active")
    can_delete = False


class BookingItemInline(admin.TabularInline):
    model = BookingItem
    extra = 0
    readonly_fields = ("ticket_type", "quantity")
    can_delete = False


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("reference", "user", "event", "status", "booked_at")
    list_filter = ("status",)
    search_fields = ("reference", "user__email", "event__title")
    readonly_fields = ("user", "event", "reference", "status", "booked_at",
                       "cancelled_at")
    inlines = (BookingSeatInline, BookingItemInline)

    def has_delete_permission(self, request, obj=None):
        return False
