"""
Messagerie client ↔ designer (API REST ; le navigateur interroge régulièrement les nouveaux messages).

  GET  /api/conversations/                         mes conversations (dernier message, non lus)
  POST /api/conversations/                         {designer, body?, shirt?} : ouvre (ou reprend) la conversation
  GET  /api/conversations/contact/?designer=<id>   designer à contacter + conversation existante éventuelle
  GET  /api/conversations/unread/                  {count} : messages non lus (badge)
  GET  /api/conversations/<id>/                    une conversation
  GET  /api/conversations/<id>/messages/?after=<id> messages (seulement les nouveaux avec « after »)
  POST /api/conversations/<id>/messages/           {body?, shirt?} : répondre
  POST /api/conversations/<id>/read/               marque comme lus les messages reçus

Chacun ne voit que les conversations dont il est participant (404 sinon, sans révéler leur existence).
"""
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .models import MESSAGE_MAX_LENGTH, Conversation, Message, Shirt
from .permissions import is_designer
from .serializers import ShirtSerializer

User = get_user_model()
PAGE = 100  # messages renvoyés au premier chargement (les plus récents)


def display_name(user):
    return user.first_name or user.username.split("@")[0]


# --------------------------------------------------------------------------- sérialiseurs

class MessageSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    mine = serializers.SerializerMethodField()
    shirt = ShirtSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "author", "author_name", "mine", "body", "shirt", "created_at", "read_at"]

    def get_author_name(self, obj):
        return display_name(obj.author)

    def get_mine(self, obj):
        return obj.author_id == self.context["request"].user.id


class MessageInputSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=MESSAGE_MAX_LENGTH, required=False, allow_blank=True, trim_whitespace=True)
    shirt = serializers.PrimaryKeyRelatedField(queryset=Shirt.objects.all(), required=False, allow_null=True)

    def validate(self, data):
        if not data.get("body") and not data.get("shirt"):
            raise serializers.ValidationError("Écrivez un message ou joignez un design.")
        return data


class StartInputSerializer(MessageInputSerializer):
    designer = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())

    def validate_designer(self, user):
        if not is_designer(user):
            raise serializers.ValidationError("Ce compte n'est pas un designer.")
        if user.id == self.context["request"].user.id:
            raise serializers.ValidationError("Vous ne pouvez pas vous écrire à vous-même.")
        return user

    def validate(self, data):
        # Ouvrir une conversation sans message est permis (page « Contacter ») : seul le contenu, s'il y en a, est vérifié.
        return data


class ConversationSerializer(serializers.ModelSerializer):
    other = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    unread = serializers.IntegerField(read_only=True, default=0)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "other", "role", "unread", "last_message", "updated_at"]

    def _user(self):
        return self.context["request"].user

    def get_other(self, obj):
        other = obj.other(self._user())
        return {"id": other.id, "name": display_name(other), "is_designer": other.id == obj.designer_id}

    def get_role(self, obj):
        """Mon rôle dans cette conversation : « client » (je l'ai ouverte) ou « designer »."""
        return "client" if obj.client_id == self._user().id else "designer"

    def get_last_message(self, obj):
        if getattr(obj, "last_id", None) is None:
            return None
        body = obj.last_body or ""
        return {
            "id": obj.last_id,
            "body": body[:140],
            "has_shirt": obj.last_shirt is not None,
            "mine": obj.last_author == self._user().id,
            "created_at": obj.last_at,
        }


# --------------------------------------------------------------------------- vues

class MessageThrottle(UserRateThrottle):
    """Limite d'envoi (anti-spam) : 30 messages par minute et par compte."""

    rate = "30/min"
    scope = "messages"


class ConversationViewSet(viewsets.GenericViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        last = Message.objects.filter(conversation=OuterRef("pk")).order_by("-id")
        return (
            Conversation.objects.filter(Q(client=user) | Q(designer=user))
            .select_related("client", "designer")
            .annotate(
                unread=Count("messages", filter=Q(messages__read_at__isnull=True) & ~Q(messages__author=user)),
                last_id=Subquery(last.values("id")[:1]),
                last_body=Subquery(last.values("body")[:1]),
                last_author=Subquery(last.values("author")[:1]),
                last_shirt=Subquery(last.values("shirt")[:1]),
                last_at=Subquery(last.values("created_at")[:1]),
            )
        )

    def get_throttles(self):
        if self.request.method == "POST" and self.action in ("create", "messages"):
            return [MessageThrottle()]
        return super().get_throttles()

    def _conversation(self, pk):
        return get_object_or_404(self.get_queryset(), pk=pk)

    def _serialize(self, conversation):
        return ConversationSerializer(conversation, context=self.get_serializer_context()).data

    def _post(self, conversation, data):
        message = Message.objects.create(
            conversation=conversation, author=self.request.user, body=data.get("body", ""), shirt=data.get("shirt")
        )
        Conversation.objects.filter(pk=conversation.pk).update(updated_at=message.created_at)
        return message

    def list(self, request):
        return Response(ConversationSerializer(self.get_queryset(), many=True, context=self.get_serializer_context()).data)

    def retrieve(self, request, pk=None):
        return Response(self._serialize(self._conversation(pk)))

    def create(self, request):
        data = StartInputSerializer(data=request.data, context=self.get_serializer_context())
        data.is_valid(raise_exception=True)
        designer = data.validated_data["designer"]
        content = {k: v for k, v in data.validated_data.items() if k != "designer"}
        with transaction.atomic():
            conversation, created = Conversation.objects.get_or_create(client=request.user, designer=designer)
            if content.get("body") or content.get("shirt"):
                self._post(conversation, content)
        return Response(self._serialize(self._conversation(conversation.pk)), status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def contact(self, request):
        designer = get_object_or_404(User, pk=request.query_params.get("designer") or 0)
        if not is_designer(designer):
            return Response({"detail": "Ce compte n'est pas un designer."}, status=status.HTTP_404_NOT_FOUND)
        existing = Conversation.objects.filter(
            Q(client=request.user, designer=designer) | Q(client=designer, designer=request.user)
        ).values_list("id", flat=True).first()
        return Response({
            "designer": {"id": designer.id, "name": display_name(designer)},
            "conversation": existing,
            "self": designer.id == request.user.id,
        })

    @action(detail=False, methods=["get"])
    def unread(self, request):
        user = request.user
        count = Message.objects.filter(
            Q(conversation__client=user) | Q(conversation__designer=user), read_at__isnull=True
        ).exclude(author=user).count()
        return Response({"count": count})

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        conversation = self._conversation(pk)
        if request.method == "POST":
            data = MessageInputSerializer(data=request.data)
            data.is_valid(raise_exception=True)
            message = self._post(conversation, data.validated_data)
            return Response(MessageSerializer(message, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

        qs = conversation.messages.select_related("author", "shirt__designer")
        after = request.query_params.get("after")
        if after:
            try:
                qs = qs.filter(id__gt=int(after))
            except ValueError:
                return Response({"detail": "Paramètre « after » invalide."}, status=status.HTTP_400_BAD_REQUEST)
            messages = list(qs[:PAGE])
        else:
            # Premier chargement : les plus récents, dans l'ordre chronologique.
            messages = list(qs.order_by("-id")[:PAGE])[::-1]
        return Response(MessageSerializer(messages, many=True, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        conversation = self._conversation(pk)
        count = conversation.messages.filter(read_at__isnull=True).exclude(author=request.user).update(read_at=timezone.now())
        return Response({"read": count})
