from rest_framework import permissions

from .models import Profile


def is_designer(user):
    return (
        user.is_authenticated
        and hasattr(user, "profile")
        and user.profile.role == Profile.ROLE_DESIGNER
    )


class IsDesignerOwnerOrReadOnly(permissions.BasePermission):
    """Lecture pour tous ; création réservée aux designers ; modification au designer propriétaire."""

    message = "Seul un designer peut créer un t-shirt, et seul son auteur peut le modifier."

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_designer(request.user) or request.user.is_staff

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.designer_id == request.user.id or request.user.is_staff
