"""Event APIs: public discovery, organizer management, admin lifecycle (06)."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminRole, IsOrganizerRole

from .exceptions import (
    EventNotFoundError,
    EventTerminalError,
    InventoryLockedError,
    NotEventOwnerError,
    TemplateNotFoundError,
)
from .models import (
    MAX_CAPACITY,
    BookingMode,
    Event,
    EventRow,
    EventSection,
    EventStatus,
    VenueLayoutTemplate,
)
from .serializers import (
    EventCreateSerializer,
    EventDetailSerializer,
    EventListSerializer,
    EventUpdateSerializer,
    StatusReasonSerializer,
    VenueLayoutTemplateSerializer,
    _build_sections,
    _build_ticket_types,
)

IST = ZoneInfo("Asia/Kolkata")
PRESETS = ("today", "tomorrow", "weekend", "week")


def _owned_event(pk, user) -> Event:
    try:
        event = Event.objects.get(pk=pk)
    except (Event.DoesNotExist, ValueError, TypeError):
        raise EventNotFoundError() from None
    if user.role != user.Role.ADMIN and event.organizer_id != user.id:
        raise NotEventOwnerError()
    return event


def _ist_day_bounds(day):
    start = datetime.combine(day, time.min).replace(tzinfo=IST)
    return start.astimezone(timezone.utc), (start + timedelta(days=1)).astimezone(
        timezone.utc)


def _apply_public_filters(qs, params):
    q = (params.get("q") or "").strip()
    if q:
        qs = qs.filter(title__icontains=q) | qs.filter(description__icontains=q)
    for key in ("category", "city"):
        value = (params.get(key) or "").strip()
        if value:
            qs = qs.filter(**{f"{key}__iexact": value})
    day = (params.get("date") or "").strip()
    if day:
        try:
            parsed = datetime.strptime(day, "%Y-%m-%d").date()
        except ValueError:
            raise ValidationError({"date": "Use YYYY-MM-DD."}) from None
        start, end = _ist_day_bounds(parsed)
        qs = qs.filter(starts_at__gte=start, starts_at__lt=end)
    preset = (params.get("preset") or "").strip()
    if preset and preset in PRESETS:
        now_ist = timezone.now().astimezone(IST)
        today = now_ist.date()
        if preset == "today":
            start, end = _ist_day_bounds(today)
            qs = qs.filter(starts_at__gte=start, starts_at__lt=end)
        elif preset == "tomorrow":
            start, end = _ist_day_bounds(today + timedelta(days=1))
            qs = qs.filter(starts_at__gte=start, starts_at__lt=end)
        elif preset == "week":
            qs = qs.filter(starts_at__lt=timezone.now() + timedelta(days=7))
        else:  # weekend: upcoming Sat/Sun
            days_ahead_sat = (5 - today.weekday()) % 7
            sat = today + timedelta(days=days_ahead_sat)
            start, _ = _ist_day_bounds(sat)
            _, end = _ist_day_bounds(sat + timedelta(days=1))
            qs = qs.filter(starts_at__gte=start, starts_at__lt=end)
    return qs


# ---------------------------------------------------------------- public ----


@api_view(["GET"])
@permission_classes([AllowAny])
def event_list(request):
    from config.pagination import EnvelopePagination

    qs = Event.objects.filter(
        status=EventStatus.ACTIVE,
        starts_at__gte=timezone.now() - timedelta(hours=2),
    ).select_related("organizer").order_by("starts_at")
    qs = _apply_public_filters(qs, request.query_params)
    paginator = EnvelopePagination()
    page = paginator.paginate_queryset(qs, request)
    serializer = EventListSerializer(page, many=True)
    return paginator.get_paginated_response(serializer.data)


@api_view(["GET"])
@permission_classes([AllowAny])
def event_detail(request, pk):
    try:
        event = Event.objects.select_related("organizer").get(pk=pk)
    except (Event.DoesNotExist, ValueError, TypeError):
        raise EventNotFoundError() from None
    user = request.user
    if event.status != EventStatus.ACTIVE:
        is_owner = user.is_authenticated and (
            user.role == user.Role.ADMIN or event.organizer_id == user.id)
        if not is_owner:
            raise EventNotFoundError() from None
    serializer = EventDetailSerializer(event, context={"request": request})
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([AllowAny])
def template_list(request):
    qs = VenueLayoutTemplate.objects.filter(is_active=True)
    return Response(VenueLayoutTemplateSerializer(qs, many=True).data)


# -------------------------------------------------------------- organizer ----


@api_view(["GET", "POST"])
@permission_classes([IsOrganizerRole])
def organizer_events(request):
    """GET own events; POST create (ACTIVE immediately). Specs/06."""
    if request.method == "GET":
        from config.pagination import EnvelopePagination

        qs = Event.objects.filter(organizer=request.user).order_by("starts_at")
        paginator = EnvelopePagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            EventListSerializer(page, many=True).data)
    serializer = EventCreateSerializer(
        data=request.data, context={"organizer": request.user})
    serializer.is_valid(raise_exception=True)
    event = serializer.save()
    return Response(EventDetailSerializer(event).data,
                    status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH"])
@permission_classes([IsOrganizerRole])
def organizer_event_detail(request, pk):
    event = _owned_event(pk, request.user)
    if request.method == "GET":
        return Response(EventDetailSerializer(event).data)
    serializer = EventUpdateSerializer(event, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    event = serializer.save()
    return Response(EventDetailSerializer(event).data)


def _replace_sections(event, sections_data):
    from .serializers import SectionInputSerializer

    serializer = SectionInputSerializer(data=sections_data, many=True)
    serializer.is_valid(raise_exception=True)
    if event.booking_mode != BookingMode.RESERVED_SEATING:
        raise ValidationError(
            {"sections": "Sections apply to reserved-seating events."})
    if event.has_confirmed_bookings():
        raise InventoryLockedError()
    with transaction.atomic():
        event.sections.all().delete()
        total = _build_sections(event, serializer.validated_data)
        # Empty list clears the layout (then from-template can refill it);
        # otherwise the 1–100000 seat invariant holds.
        if total > MAX_CAPACITY:
            raise ValidationError({"sections": "Event must have ≤100000 seats."})


@api_view(["POST"])
@permission_classes([IsOrganizerRole])
def organizer_event_sections(request, pk):
    """Replace all sections (+rows/seats) of an RS event (ownership-checked)."""
    event = _owned_event(pk, request.user)
    _replace_sections(event, request.data.get("sections", []))
    return Response(EventDetailSerializer(
        Event.objects.get(pk=event.pk)).data)


@api_view(["GET", "POST"])
@permission_classes([IsOrganizerRole])
def organizer_event_layout(request, pk):
    """GET full inventory tree; POST instantiate from a template (RS only)."""
    event = _owned_event(pk, request.user)
    if request.method == "GET":
        return Response(EventDetailSerializer(event).data)
    try:
        template = VenueLayoutTemplate.objects.get(
            pk=request.data.get("template_id"), is_active=True)
    except (VenueLayoutTemplate.DoesNotExist, ValueError, TypeError):
        raise TemplateNotFoundError() from None
    if event.booking_mode != BookingMode.RESERVED_SEATING:
        raise ValidationError(
            {"template_id": "Templates apply to reserved-seating events."})
    if event.has_confirmed_bookings():
        raise InventoryLockedError()
    if event.sections.exists():
        raise ValidationError(
            {"template_id": "Event already has a layout; edit sections instead."})
    with transaction.atomic():
        from .serializers import _build_sections_from_template

        _build_sections_from_template(event, template)
    return Response(EventDetailSerializer(
        Event.objects.get(pk=event.pk)).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsOrganizerRole])
def section_rows_replace(request, pk):
    """Replace all rows (+seats) of one section (ownership-checked)."""
    from .serializers import RowInputSerializer

    try:
        section = EventSection.objects.select_related("event").get(pk=pk)
    except (EventSection.DoesNotExist, ValueError, TypeError):
        raise EventNotFoundError() from None
    event = section.event
    if request.user.role != request.user.Role.ADMIN \
            and event.organizer_id != request.user.id:
        raise NotEventOwnerError()
    if event.has_confirmed_bookings():
        raise InventoryLockedError()
    serializer = RowInputSerializer(data=request.data.get("rows", []), many=True)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        section.rows.all().delete()
        for row_order, row_data in enumerate(serializer.validated_data):
            row = EventRow.objects.create(
                section=section, label=row_data["label"].strip().upper(),
                sort_order=row_order)
            accessible = set(row_data.get("accessible") or [])
            sellable = row_data.get("sellable")
            sellable_set = set(sellable) if sellable is not None else None
            from .models import EventSeat as Seat

            Seat.objects.bulk_create([
                Seat(row=row, number=n, is_accessible=n in accessible,
                     is_sellable=(n in sellable_set
                                  if sellable_set is not None else True))
                for n in row_data["seats"]
            ])
    return Response(EventDetailSerializer(
        Event.objects.get(pk=event.pk)).data)


@api_view(["POST"])
@permission_classes([IsOrganizerRole])
def event_ticket_types_replace(request, pk):
    """Replace all ticket types of a GA event (ownership-checked)."""
    from .serializers import TicketTypeInputSerializer

    event = _owned_event(pk, request.user)
    if event.booking_mode != BookingMode.GENERAL_ADMISSION:
        raise ValidationError(
            {"ticket_types": "Ticket types apply to general-admission events."})
    if event.has_confirmed_bookings():
        raise InventoryLockedError()
    serializer = TicketTypeInputSerializer(
        data=request.data.get("ticket_types", []), many=True)
    serializer.is_valid(raise_exception=True)
    names = [t["name"].strip().lower() for t in serializer.validated_data]
    if len(set(names)) != len(names):
        raise ValidationError(
            {"ticket_types": "Ticket-type names must be unique per event."})
    total = sum(t["quantity_total"] for t in serializer.validated_data)
    if event.capacity and total > event.capacity:
        raise ValidationError(
            {"ticket_types": "Ticket quantities exceed capacity."})
    with transaction.atomic():
        event.ticket_types.all().delete()
        _build_ticket_types(event, serializer.validated_data)
    return Response(EventDetailSerializer(
        Event.objects.get(pk=event.pk)).data)


# ------------------------------------------------------------------ admin ----


@api_view(["GET"])
@permission_classes([IsAdminRole])
def admin_event_list(request):
    from config.pagination import EnvelopePagination

    qs = Event.objects.all().select_related("organizer").order_by("starts_at")
    wanted = (request.query_params.get("status") or "").strip()
    if wanted:
        qs = qs.filter(status=wanted)
    paginator = EnvelopePagination()
    page = paginator.paginate_queryset(qs, request)
    return paginator.get_paginated_response(
        EventListSerializer(page, many=True).data)


def _set_event_status(request, pk, to_status) -> Response:

    try:
        event = Event.objects.get(pk=pk)
    except (Event.DoesNotExist, ValueError, TypeError):
        raise EventNotFoundError() from None
    serializer = StatusReasonSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if event.status == EventStatus.CANCELLED:
        raise EventTerminalError()
    event.status = to_status
    event.status_reason = serializer.validated_data["reason"]
    event.save(update_fields=["status", "status_reason", "updated_at"])
    return Response(EventDetailSerializer(event).data)


@api_view(["PATCH"])
@permission_classes([IsAdminRole])
def admin_event_suspend(request, pk):
    return _set_event_status(request, pk, EventStatus.SUSPENDED)


@api_view(["PATCH"])
@permission_classes([IsAdminRole])
def admin_event_reactivate(request, pk):
    try:
        event = Event.objects.get(pk=pk)
    except (Event.DoesNotExist, ValueError, TypeError):
        raise EventNotFoundError() from None
    if event.status == EventStatus.CANCELLED:
        raise EventTerminalError()
    if event.status != EventStatus.SUSPENDED:
        raise ValidationError("Only suspended events can be reactivated.")
    event.status = EventStatus.ACTIVE
    event.status_reason = ""
    event.save(update_fields=["status", "status_reason", "updated_at"])
    return Response(EventDetailSerializer(event).data)


@api_view(["PATCH"])
@permission_classes([IsAdminRole])
def admin_event_cancel(request, pk):
    return _set_event_status(request, pk, EventStatus.CANCELLED)
