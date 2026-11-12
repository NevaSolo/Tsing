"""
Paiement : configuration publique et webhook Stripe.

  GET  /api/payments/config/   {mode: "stripe"|"demo", test_mode, currency} — lu par la page de commande
  POST /api/payments/webhook/  appelé par Stripe ; signature vérifiée avec STRIPE_WEBHOOK_SECRET
"""
import logging

import stripe
from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import payments

logger = logging.getLogger(__name__)


class PaymentConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            "mode": "stripe" if payments.stripe_enabled() else "demo",
            "test_mode": payments.stripe_enabled() and payments.test_mode(),
            "currency": settings.STRIPE_CURRENCY,
        })


class StripeWebhookView(APIView):
    """Événements Stripe → statut des commandes. Aucune session utilisateur : seule la signature fait foi."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        if not settings.STRIPE_WEBHOOK_SECRET:
            return Response({"detail": "Webhook non configuré."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            event = stripe.Webhook.construct_event(
                request.body, request.META.get("HTTP_STRIPE_SIGNATURE", ""), settings.STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.SignatureVerificationError):
            return Response({"detail": "Signature invalide."}, status=status.HTTP_400_BAD_REQUEST)

        session = event["data"]["object"]
        order_id = (session.get("metadata") or {}).get("order_id") or session.get("client_reference_id")
        if not order_id:
            return Response({"received": True})
        kind = event["type"]
        if kind in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
            # Paiements différés (virement…) : « completed » arrive avant l'encaissement.
            if session.get("payment_status") in ("paid", "no_payment_required"):
                payments.mark_paid(order_id, session.get("id", ""))
        elif kind in ("checkout.session.expired", "checkout.session.async_payment_failed"):
            payments.cancel_order(order_id, expire_session=False)
        else:
            logger.debug("Événement Stripe ignoré : %s", kind)
        return Response({"received": True})
