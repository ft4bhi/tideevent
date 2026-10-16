"""Admin integration: no public registration; bootstrap via createsuperuser."""

from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField

from .models import OrganizerInvitation, User


class AdminUserCreationForm(forms.ModelForm):
    password1 = forms.CharField(label="Password", widget=forms.PasswordInput)
    password2 = forms.CharField(label="Password confirmation",
                                widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ("email", "name", "role", "status")

    def clean_password2(self):
        p1 = self.cleaned_data.get("password1")
        p2 = self.cleaned_data.get("password2")
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError("Passwords do not match.")
        return p2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
        return user


class AdminUserChangeForm(forms.ModelForm):
    password = ReadOnlyPasswordHashField(
        help_text="Raw passwords are never stored. Use the change form below.")

    class Meta:
        model = User
        fields = ("email", "name", "password", "role", "status",
                  "is_staff", "is_superuser", "groups", "user_permissions")


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = AdminUserChangeForm
    add_form = AdminUserCreationForm
    list_display = ("email", "name", "role", "status", "is_staff", "created_at")
    list_filter = ("role", "status", "is_staff")
    search_fields = ("email", "name")
    ordering = ("-created_at",)
    fieldsets = (
        (None, {"fields": ("email", "name", "password")}),
        ("Business", {"fields": ("role", "status")}),
        # NOTE: no `is_active` checkbox — account access is driven by `status`
        # (the is_active *property* mirrors it for Django internals).
        ("Permissions", {"fields": ("is_staff", "is_superuser",
                                   "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "name", "password1", "password2", "role", "status"),
        }),
    )
    readonly_fields = ("last_login", "created_at", "updated_at")


@admin.register(OrganizerInvitation)
class OrganizerInvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "status", "expires_at", "email_sent",
                    "created_by", "created_at")
    list_filter = ("status", "email_sent")
    search_fields = ("email",)
    readonly_fields = ("token_hash", "accepted_at", "accepted_by", "created_at")
    ordering = ("-created_at",)
