"""Seed the five reusable venue templates (editable starting points)."""

from django.db import migrations


def _rows(labels, seats, accessible=()):
    return [{"label": label, "seats": seats, "accessible": list(accessible)}
            for label in labels]


TEMPLATES = [
    {
        "slug": "auditorium",
        "name": "Auditorium / Theatre",
        "description": "Stalls plus a raised balcony, priced per section.",
        "layout_json": {"sections": [
            {"name": "Stalls", "price_inr": 499, "rows": _rows("ABCDE", 30)},
            {"name": "Balcony", "price_inr": 799,
             "rows": _rows("FG", 20, accessible=[1, 2])},
        ]},
    },
    {
        "slug": "stadium",
        "name": "Stadium / Arena",
        "description": "Four stands around the field, uniform pricing per stand.",
        "layout_json": {"sections": [
            {"name": "North Stand", "price_inr": 299, "rows": _rows("ABC", 40)},
            {"name": "South Stand", "price_inr": 299, "rows": _rows("ABC", 40)},
            {"name": "East Stand", "price_inr": 199, "rows": _rows("AB", 40)},
            {"name": "West Stand", "price_inr": 199, "rows": _rows("AB", 40,
                                                                   accessible=[1])},
        ]},
    },
    {
        "slug": "cinema",
        "name": "Cinema-style seating",
        "description": "Single screen with a premium back row.",
        "layout_json": {"sections": [
            {"name": "Classic", "price_inr": 249, "rows": _rows("ABCDEFGH", 12)},
            {"name": "Premium", "price_inr": 399,
             "rows": _rows("JK", 12, accessible=[1, 12])},
        ]},
    },
    {
        "slug": "conference",
        "name": "Conference hall",
        "description": "Main hall plus a small workshop room.",
        "layout_json": {"sections": [
            {"name": "Main Hall", "price_inr": 999,
             "rows": _rows("ABCDEF", 25, accessible=[1, 25])},
            {"name": "Workshop Room", "price_inr": 499, "rows": _rows("AB", 15)},
        ]},
    },
    {
        "slug": "custom-basic",
        "name": "Basic custom layout",
        "description": "One section, three rows of ten — reshape freely.",
        "layout_json": {"sections": [
            {"name": "General", "price_inr": 0, "rows": _rows("ABC", 10)},
        ]},
    },
]


def seed_templates(apps, schema_editor):
    VenueLayoutTemplate = apps.get_model("events", "VenueLayoutTemplate")
    for item in TEMPLATES:
        VenueLayoutTemplate.objects.update_or_create(
            slug=item["slug"], defaults={
                "name": item["name"], "description": item["description"],
                "layout_json": item["layout_json"], "is_active": True})


def unseed_templates(apps, schema_editor):
    VenueLayoutTemplate = apps.get_model("events", "VenueLayoutTemplate")
    VenueLayoutTemplate.objects.filter(
        slug__in=[t["slug"] for t in TEMPLATES]).delete()


class Migration(migrations.Migration):

    dependencies = [("events", "0001_initial")]

    operations = [migrations.RunPython(seed_templates, unseed_templates)]
