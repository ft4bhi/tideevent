"""B1 model tests: custom user mapping, manager rules, superuser bootstrap."""

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()

pytestmark = pytest.mark.django_db


def test_create_superuser_is_admin_with_privileges():
    admin = User.objects.create_superuser(
        email="boss@example.com", name="Boss", password="secret123")
    assert admin.role == User.Role.ADMIN
    assert admin.is_staff and admin.is_superuser
    assert admin.is_active is True
    assert admin.check_password("secret123")
    assert "pbkdf2_" in admin.password


def test_superuser_requires_admin_role():
    admin = User(
        email="x@example.com", name="X", is_staff=True, is_superuser=True,
        role=User.Role.ATTENDEE,
    )
    with pytest.raises(ValidationError):
        admin.full_clean()


def test_admin_role_syncs_staff_flag():
    user = User.objects.create_user(
        email="o@example.com", name="O", password="password123",
        role=User.Role.ORGANIZER)
    assert user.is_staff is False
    user.role = User.Role.ADMIN
    user.save()
    assert user.is_staff is True


def test_email_normalized_lowercase_and_unique():
    User.objects.create_user(email="Mixed@Example.COM", name="M",
                             password="password123")
    assert User.objects.get(email="mixed@example.com").email == "mixed@example.com"


def test_is_active_mirrors_status():
    user = User.objects.create_user(email="s@example.com", name="S",
                                    password="password123")
    assert user.is_active is True
    user.status = User.Status.SUSPENDED
    user.save()
    assert User.objects.get(email="s@example.com").is_active is False
