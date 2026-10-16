"""Serializers: validation mirrors frontend Zod rules (specs/06)."""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import OrganizerInvitation

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Public user shape. Password hashes are never serialized."""

    class Meta:
        model = User
        fields = ("id", "name", "email", "role", "status", "created_at")
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=1, max_length=80, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(min_length=8, max_length=128, write_only=True)

    def validate_email(self, value: str) -> str:
        email = value.lower()
        if User.objects.filter(email=email).exists():
            from .exceptions import EmailExistsError

            raise EmailExistsError()
        return email

    def create(self, validated_data):
        # ATTENDEE always. Any client-supplied role is rejected in the view.
        return User.objects.create_user(
            email=validated_data["email"],
            name=validated_data["name"],
            password=validated_data["password"],
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class InvitationAcceptSerializer(serializers.Serializer):
    token = serializers.CharField()
    name = serializers.CharField(
        min_length=1, max_length=80, required=False, trim_whitespace=True
    )
    password = serializers.CharField(
        min_length=8, max_length=128, required=False, write_only=True
    )


class InvitationSerializer(serializers.ModelSerializer):
    """Status shape. The raw token is NEVER included."""

    class Meta:
        model = OrganizerInvitation
        fields = ("id", "email", "status", "expires_at", "accepted_at",
                  "email_sent", "created_at")
        read_only_fields = fields
