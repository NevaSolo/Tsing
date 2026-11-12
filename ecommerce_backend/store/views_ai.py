"""
IA du serveur (Ollama).

  GET  /api/ai/config/   {enabled, model} — le Studio choisit l'IA du serveur si elle est disponible
  POST /api/ai/brief/    {prompt, text?} → {brief, model, seconds} (connecté, 6 demandes / minute)
"""
from django.conf import settings
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from . import ai


class AIConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"enabled": ai.enabled(), "model": settings.OLLAMA_MODEL if ai.enabled() else None})


class BriefThrottle(UserRateThrottle):
    """Le modèle tourne sur le processeur du serveur : on protège les autres visiteurs."""

    rate = "6/min"
    scope = "ai_brief"


class BriefInput(serializers.Serializer):
    prompt = serializers.CharField(max_length=settings.AI_MAX_PROMPT, allow_blank=True, trim_whitespace=True)
    text = serializers.CharField(max_length=80, required=False, allow_blank=True, trim_whitespace=True)


class BriefView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [BriefThrottle]

    def post(self, request):
        if not ai.enabled():
            return Response({"detail": "L'IA du serveur n'est pas configurée."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        data = BriefInput(data=request.data)
        data.is_valid(raise_exception=True)
        prompt = data.validated_data["prompt"] or "Un t-shirt original et tendance"
        try:
            brief, info = ai.generate_brief(prompt, data.validated_data.get("text", ""))
        except ai.AIError as err:
            return Response({"detail": str(err)}, status=err.status)
        return Response({"brief": brief, **info})
