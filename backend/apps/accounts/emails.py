"""Invitation email. Console backend in local dev prints this (honest,
visible delivery); production uses SMTP settings from the environment."""

import smtplib

from django.conf import settings
from django.core.mail import send_mail


def invitation_link(raw_token: str) -> str:
    return f"{settings.FRONTEND_URL}/invite/accept?token={raw_token}"


def send_invitation_email(to_email: str, raw_token: str) -> bool:
    """Returns True only if Django accepted the message for delivery."""
    try:
        send_mail(
            subject="Your TideEvent organizer invitation",
            message=(
                f"You have been invited to organize events on TideEvent.\n\n"
                f"Accept within 7 days (link is single-use):\n"
                f"{invitation_link(raw_token)}\n\n"
                f"If you did not expect this, ignore this email."
            ),
            from_email=None,  # DEFAULT_FROM_EMAIL / SMTP login
            recipient_list=[to_email],
            fail_silently=False,
        )
        return True
    except (smtplib.SMTPException, OSError, TimeoutError):
        # Delivery failed: the caller reports email_sent=False and the
        # invitation stays usable for retry/replacement.
        return False
