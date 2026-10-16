"""Accounts + invitation routes (no trailing slashes — matches the contract)."""

from django.urls import path

from . import views

urlpatterns = [
    path("auth/register", views.register, name="auth-register"),
    path("auth/login", views.login_view, name="auth-login"),
    path("auth/logout", views.logout_view, name="auth-logout"),
    path("auth/me", views.me, name="auth-me"),
    path("admin/invitations", views.invitations, name="invitations"),
    path("admin/invitations/<uuid:pk>/resend", views.invitation_resend,
         name="invitation-resend"),
    path("admin/invitations/<uuid:pk>/revoke", views.invitation_revoke,
         name="invitation-revoke"),
    path("invitations/validate", views.invitation_validate, name="invitation-validate"),
    path("invitations/accept", views.invitation_accept, name="invitation-accept"),
]
