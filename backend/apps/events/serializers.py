"""Event serializers: read shapes with derived availability; write paths with
nested inventory validation (mirrors frontend Zod rules, specs/06)."""

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import (
    MAX_CAPACITY,
    BookingMode,
    Category,
    Event,
    EventRow,
    EventSeat,
    EventSection,
    TicketType,
    VenueLayoutTemplate,
)

# ------------------------------------------------------------------ read ----


class SeatSerializer(serializers.ModelSerializer):
    booked = serializers.SerializerMethodField()

    class Meta:
        model = EventSeat
        fields = ("id", "number", "is_accessible", "is_sellable", "booked")

    def get_booked(self, seat) -> bool:
        booked_ids = self.context.get("booked_seat_ids", set())
        return seat.id in booked_ids


class RowSerializer(serializers.ModelSerializer):
    seats = SeatSerializer(many=True, read_only=True)

    class Meta:
        model = EventRow
        fields = ("id", "label", "seats")


class SectionSerializer(serializers.ModelSerializer):
    rows = RowSerializer(many=True, read_only=True)

    class Meta:
        model = EventSection
        fields = ("id", "name", "price_inr", "rows")


class TicketTypeSerializer(serializers.ModelSerializer):
    remaining = serializers.SerializerMethodField()

    class Meta:
        model = TicketType
        fields = ("id", "name", "price_inr", "quantity_total", "remaining")

    def get_remaining(self, ticket_type) -> int:
        return ticket_type.remaining()


class EventListSerializer(serializers.ModelSerializer):
    organizer_name = serializers.CharField(source="organizer.name", read_only=True)
    starting_price_inr = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()
    sold_out = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = ("id", "title", "category", "starts_at", "location", "city",
                  "poster_url", "booking_mode", "status", "organizer_name",
                  "starting_price_inr", "remaining", "sold_out")

    def get_starting_price_inr(self, event) -> int:
        return event.starting_price_inr()

    def get_remaining(self, event) -> int:
        return event.remaining()

    def get_sold_out(self, event) -> bool:
        return event.sold_out


class EventDetailSerializer(EventListSerializer):
    description = serializers.CharField(read_only=True)
    capacity = serializers.IntegerField(read_only=True)
    sections = SectionSerializer(many=True, read_only=True)
    ticket_types = TicketTypeSerializer(many=True, read_only=True)

    class Meta(EventListSerializer.Meta):
        fields = EventListSerializer.Meta.fields + (
            "description", "capacity", "sections", "ticket_types",
            "created_at", "updated_at",
        )

    def to_representation(self, event):
        # booked flags need no extra queries until B3 (all False for now).
        self.context.setdefault("booked_seat_ids", set())
        return super().to_representation(event)


class VenueLayoutTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = VenueLayoutTemplate
        fields = ("id", "slug", "name", "description", "layout_json")


# ----------------------------------------------------------------- write ----


class SeatInputSerializer(serializers.Serializer):
    number = serializers.IntegerField(min_value=1, max_value=500)
    is_accessible = serializers.BooleanField(default=False)
    is_sellable = serializers.BooleanField(default=True)


class RowInputSerializer(serializers.Serializer):
    label = serializers.CharField(min_length=1, max_length=4)
    seats = serializers.ListField(child=serializers.IntegerField(
        min_value=1, max_value=500), min_length=1, max_length=500)
    accessible = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=500),
        required=False, default=list)
    sellable = serializers.ListField(
        child=serializers.IntegerField(min_value=1, max_value=500),
        required=False, default=None)

    def validate(self, attrs):
        numbers = attrs["seats"]
        if len(set(numbers)) != len(numbers):
            raise serializers.ValidationError("Duplicate seat numbers in row.")
        reachable = set(numbers)
        for key in ("accessible", "sellable"):
            unknown = set(attrs.get(key) or []) - reachable
            if unknown:
                raise serializers.ValidationError(
                    f"{key} references seats not in this row: {sorted(unknown)}.")
        return attrs


class SectionInputSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=1, max_length=80)
    price_inr = serializers.IntegerField(min_value=0)
    rows = RowInputSerializer(many=True, min_length=1)


class TicketTypeInputSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=1, max_length=80)
    price_inr = serializers.IntegerField(min_value=0)
    quantity_total = serializers.IntegerField(min_value=1,
                                              max_value=MAX_CAPACITY)


def _build_sections(event, sections_data):
    total_seats = 0
    for order, section_data in enumerate(sections_data):
        section = EventSection.objects.create(
            event=event, name=section_data["name"].strip(),
            price_inr=section_data["price_inr"], sort_order=order)
        for row_order, row_data in enumerate(section_data["rows"]):
            row = EventRow.objects.create(
                section=section, label=row_data["label"].strip().upper(),
                sort_order=row_order)
            accessible = set(row_data.get("accessible") or [])
            sellable = row_data.get("sellable")
            sellable_set = set(sellable) if sellable is not None else None
            EventSeat.objects.bulk_create([
                EventSeat(row=row, number=n,
                          is_accessible=n in accessible,
                          is_sellable=(n in sellable_set
                                       if sellable_set is not None else True))
                for n in row_data["seats"]
            ])
            total_seats += len(row_data["seats"])
    return total_seats


def _build_ticket_types(event, types_data):
    for order, item in enumerate(types_data):
        TicketType.objects.create(
            event=event, name=item["name"].strip(),
            price_inr=item["price_inr"],
            quantity_total=item["quantity_total"], sort_order=order)


def _build_sections_from_template(event, template) -> None:
    order = 0
    for section_data in template.layout_json.get("sections", []):
        section = EventSection.objects.create(
            event=event, name=section_data["name"],
            price_inr=section_data.get("price_inr", 0), sort_order=order)
        order += 1
        for row_order, row_data in enumerate(section_data.get("rows", [])):
            row = EventRow.objects.create(
                section=section, label=row_data["label"], sort_order=row_order)
            accessible = set(row_data.get("accessible", []))
            EventSeat.objects.bulk_create([
                EventSeat(row=row, number=n, is_accessible=n in accessible)
                for n in range(1, int(row_data.get("seats", 0)) + 1)
            ])


class EventCreateSerializer(serializers.Serializer):
    title = serializers.CharField(min_length=3, max_length=120)
    description = serializers.CharField(min_length=10, max_length=5000)
    category = serializers.ChoiceField(choices=Category.choices)
    starts_at = serializers.DateTimeField()
    location = serializers.CharField(min_length=1, max_length=255)
    city = serializers.CharField(min_length=1, max_length=80)
    poster_url = serializers.URLField(required=False, allow_blank=True, default="")
    booking_mode = serializers.ChoiceField(choices=BookingMode.choices)
    capacity = serializers.IntegerField(min_value=1, max_value=MAX_CAPACITY,
                                        required=False, default=None)
    sections = SectionInputSerializer(many=True, required=False, default=list)
    ticket_types = TicketTypeInputSerializer(many=True, required=False,
                                             default=list)
    # Alternative to hand-built sections: instantiate a venue template.
    template_id = serializers.UUIDField(required=False, default=None)

    def validate_starts_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Start must be in the future.")
        return value

    def validate(self, attrs):
        mode = attrs["booking_mode"]
        if mode == BookingMode.RESERVED_SEATING:
            if attrs.get("capacity") is not None:
                raise serializers.ValidationError(
                    {"capacity": "Reserved-seating capacity is derived from seats."})
            if attrs.get("ticket_types"):
                raise serializers.ValidationError(
                    "Reserved-seating events take sections, not ticket types.")
            template_id = attrs.get("template_id")
            if template_id is not None:
                if attrs.get("sections"):
                    raise serializers.ValidationError(
                        "Give either sections or template_id, not both.")
                try:
                    attrs["template"] = VenueLayoutTemplate.objects.get(
                        pk=template_id, is_active=True)
                except (VenueLayoutTemplate.DoesNotExist, ValueError):
                    raise serializers.ValidationError(
                        {"template_id": "Venue template not found."}
                    ) from None
            elif not attrs.get("sections"):
                raise serializers.ValidationError(
                    {"sections":
                     "Reserved seating needs sections or a template_id."})
            names = [s["name"].strip().lower() for s in attrs["sections"]]
            if len(set(names)) != len(names):
                raise serializers.ValidationError(
                    {"sections": "Section names must be unique per event."})
        else:
            if not attrs.get("capacity"):
                raise serializers.ValidationError(
                    {"capacity": "General-admission events require capacity."})
            if attrs.get("sections"):
                raise serializers.ValidationError(
                    "General-admission events take ticket types, not sections.")
            if not attrs.get("ticket_types"):
                raise serializers.ValidationError(
                    {"ticket_types": "At least one ticket type is required."})
            names = [t["name"].strip().lower() for t in attrs["ticket_types"]]
            if len(set(names)) != len(names):
                raise serializers.ValidationError(
                    {"ticket_types": "Ticket-type names must be unique per event."})
            total = sum(t["quantity_total"] for t in attrs["ticket_types"])
            if total > attrs["capacity"]:
                raise serializers.ValidationError(
                    {"ticket_types":
                     f"Ticket quantities ({total}) exceed capacity "
                     f"({attrs['capacity']})."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        organizer = self.context["organizer"]
        sections = validated_data.pop("sections", [])
        ticket_types = validated_data.pop("ticket_types", [])
        template = validated_data.pop("template", None)
        validated_data.pop("template_id", None)
        if validated_data.get("booking_mode") == BookingMode.RESERVED_SEATING:
            validated_data.pop("capacity", None)  # derived from seats
        event = Event.objects.create(
            organizer=organizer, status="ACTIVE", **validated_data)
        if event.is_reserved:
            if template is not None:
                _build_sections_from_template(event, template)
                total = event.seat_count()
            else:
                total = _build_sections(event, sections)
            if total < 1 or total > MAX_CAPACITY:
                raise serializers.ValidationError(
                    {"sections": "Event must have 1–100000 seats."})
        else:
            _build_ticket_types(event, ticket_types)
        return event


class EventUpdateSerializer(serializers.Serializer):
    """Metadata edits + full inventory replacement (when unlocked)."""

    title = serializers.CharField(min_length=3, max_length=120, required=False)
    description = serializers.CharField(min_length=10, max_length=5000,
                                        required=False)
    category = serializers.ChoiceField(choices=Category.choices, required=False)
    starts_at = serializers.DateTimeField(required=False)
    location = serializers.CharField(min_length=1, max_length=255, required=False)
    city = serializers.CharField(min_length=1, max_length=80, required=False)
    poster_url = serializers.URLField(required=False, allow_blank=True)
    booking_mode = serializers.ChoiceField(choices=BookingMode.choices,
                                           required=False)
    capacity = serializers.IntegerField(min_value=1, max_value=MAX_CAPACITY,
                                        required=False)
    sections = SectionInputSerializer(many=True, required=False)
    ticket_types = TicketTypeInputSerializer(many=True, required=False)

    def validate(self, attrs):
        if "status" in self.initial_data:
            raise serializers.ValidationError(
                {"status": "Status is managed by admins (suspend/reactivate)."})
        event = self.instance
        if "starts_at" in attrs and attrs["starts_at"] <= timezone.now():
            raise serializers.ValidationError(
                {"starts_at": "Start must be in the future."})
        if "booking_mode" in attrs and attrs["booking_mode"] != event.booking_mode:
            if event.has_confirmed_bookings():
                from .exceptions import ModeImmutableError

                raise ModeImmutableError()
            if event.sections.exists() or event.ticket_types.exists():
                raise serializers.ValidationError(
                    {"booking_mode":
                     "Clear existing inventory before changing booking mode."})
        for key in ("sections", "ticket_types", "capacity"):
            if key in attrs and event.has_confirmed_bookings():
                from .exceptions import InventoryLockedError

                raise InventoryLockedError()
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        sections = validated_data.pop("sections", None)
        ticket_types = validated_data.pop("ticket_types", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.full_clean(exclude=("organizer",))
        instance.save()
        if sections is not None:
            if instance.booking_mode != BookingMode.RESERVED_SEATING:
                raise serializers.ValidationError(
                    {"sections": "Sections apply to reserved-seating events."})
            instance.sections.all().delete()
            total = _build_sections(instance, sections)
            if total > MAX_CAPACITY:
                raise serializers.ValidationError(
                    {"sections": "Event must have ≤100000 seats."})
        if ticket_types is not None:
            if instance.booking_mode != BookingMode.GENERAL_ADMISSION:
                raise serializers.ValidationError(
                    {"ticket_types":
                     "Ticket types apply to general-admission events."})
            instance.ticket_types.all().delete()
            _build_ticket_types(instance, ticket_types)
            total = sum(t["quantity_total"] for t in ticket_types)
            if instance.capacity and total > instance.capacity:
                raise serializers.ValidationError(
                    {"ticket_types": "Ticket quantities exceed capacity."})
        return instance


class StatusReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=10, max_length=2000)
