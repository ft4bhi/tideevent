"""Custom user model (email login) and organizer invitations."""

import hashlib
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def _default_invitation_expiry():
    days = getattr(settings, "INVITATION_EXPIRY_DAYS", 7)
    return timezone.now() + timedelta(days=days)


class OrganizerInvitation(models.Model):
    """Single-use organizer invitation. Only the token *hash* is stored; the
    raw token exists solely inside the emailed link."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        EXPIRED = "EXPIRED", "Expired"
        REVOKED = "REVOKED", "Revoked"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=254)  # intended recipient, lowercase
    token_hash = models.CharField(max_length=64, unique=True)  # sha256 hex
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="sent_invitations"
    )
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    expires_at = models.DateTimeField(default=_default_invitation_expiry)
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="accepted_invitations",
    )
    email_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["email"],
                condition=models.Q(status="PENDING"),
                name="uniq_pending_invitation_per_email",
            )
        ]

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return f"invite {self.email} [{self.status}]"

    def save(self, *args, **kwargs):
        self.email = (self.email or "").lower()
        super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @staticmethod
    def hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    @staticmethod
    def generate_token() -> str:
        return secrets.token_urlsafe(32)



class UserManager(BaseUserManager):
    """Manager keyed on normalized-lowercase email (no username field)."""

    def normalize_email_address(self, email: str) -> str:
        return self.normalize_email(email).lower()

    def _create_user(self, email, name, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        if not name:
            raise ValueError("A name is required.")
        email = self.normalize_email_address(email)
        user = self.model(email=email, name=name, **extra_fields)
        user.set_password(password)
        user.full_clean(exclude=("password",))
        user.save(using=self._db)
        return user

    def create_user(self, email, name, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", User.Role.ATTENDEE)
        return self._create_user(email, name, password, **extra_fields)

    def create_superuser(self, email, name, password=None, **extra_fields):
        # The only sanctioned path to an ADMIN account (no public registration).
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Application user. Business role is `role`; Django privilege flags map
    deliberately: is_superuser always implies role ADMIN (enforced in clean)."""

    class Role(models.TextChoices):
        ATTENDEE = "ATTENDEE", "Attendee"
        ORGANIZER = "ORGANIZER", "Organizer"
        ADMIN = "ADMIN", "Admin"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        SUSPENDED = "SUSPENDED", "Suspended"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=254)
    name = models.CharField(max_length=80)
    role = models.CharField(
        max_length=16, choices=Role.choices, default=Role.ATTENDEE
    )
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    objects = UserManager()

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return f"{self.name} <{self.email}> [{self.role}]"

    @property
    def is_active(self) -> bool:
        """Django-compat flag: False for SUSPENDED accounts.

        This makes ModelBackend, session auth, and the Django admin refuse
        suspended users automatically. DRF permission classes additionally
        check ``status`` explicitly so the reason survives in API errors.
        """
        return self.status == self.Status.ACTIVE

    @is_active.setter
    def is_active(self, value: bool) -> None:
        self.status = self.Status.ACTIVE if value else self.Status.SUSPENDED

    def clean(self) -> None:
        super().clean()
        self.email = (self.email or "").lower()
        if self.is_superuser and self.role != self.Role.ADMIN:
            raise ValidationError(
                "A superuser must have the ADMIN role (no split privileges)."
            )

    def save(self, *args, **kwargs):
        self.email = (self.email or "").lower()
        # Business admins get Django-admin access; never silently remove staff.
        if self.role == self.Role.ADMIN or self.is_superuser:
            self.is_staff = True
        super().save(*args, **kwargs)
