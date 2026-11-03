from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("events", "0002_templates")]

    operations = [
        migrations.AlterField(
            model_name="event",
            name="poster_url",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
    ]
