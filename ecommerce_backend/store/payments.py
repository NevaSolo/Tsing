"""
Paiement par Stripe Checkout (page de paiement hébergée par Stripe : les cartes ne passent jamais par nous).

Cycle d'une commande :
  1. POST /api/orders/              → commande « En attente », stock réservé.
  2. POST /api/orders/<id>/pay/     → session Stripe Checkout, le navigateur y est redirigé.
  3. Paiement réussi → webhook Stripe (production) ou retour sur /checkout/success (POST confirm/) → « Payée ».
  4. Abandon / délai dépassé → « Annulée », stock remis en vente.

Sans STRIPE_SECRET_KEY (développement) : paiement simulé, la commande est payée à sa création.
"""
import logging
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

import stripe
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Order, Shirt

logger = logging.getLogger(__name__)

# Devises sans centimes (montants Stripe en unités entières).
ZERO_DECIMAL = {"bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"}


def stripe_enabled():
    return bool(settings.STRIPE_SECRET_KEY)


def test_mode():
    return settings.STRIPE_SECRET_KEY.startswith(("sk_test_", "rk_test_"))


def to_minor_units(amount, currency=None):
    """Montant en plus petite unité de la devise (centimes), comme l'attend Stripe."""
    currency = (currency or settings.STRIPE_CURRENCY).lower()
    factor = Decimal(1) if currency in ZERO_DECIMAL else Decimal(100)
    return int((Decimal(amount) * factor).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def create_checkout_session(order):
    """Crée la session de paiement (prix lus en base, jamais envoyés par le navigateur) ; renvoie son URL."""
    items = list(order.items.select_related("shirt"))
    params = {
        "mode": "payment",
        "locale": "fr",
        "line_items": [
            {
                "price_data": {
                    "currency": settings.STRIPE_CURRENCY,
                    "unit_amount": to_minor_units(item.unit_price),
                    "product_data": {"name": f"{item.shirt.name} — taille {item.size}"},
                },
                "quantity": item.quantity,
            }
            for item in items
        ],
        "client_reference_id": str(order.pk),
        "metadata": {"order_id": str(order.pk)},
        "payment_intent_data": {"metadata": {"order_id": str(order.pk)}},
        "success_url": f"{settings.FRONTEND_URL}/checkout/success?order={order.pk}&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{settings.FRONTEND_URL}/checkout/cancel?order={order.pk}",
        # Stripe impose au moins 30 min ; une minute de marge.
        "expires_at": int((timezone.now() + timedelta(minutes=max(30, settings.PAYMENT_TIMEOUT_MINUTES), seconds=60)).timestamp()),
    }
    if order.email:
        params["customer_email"] = order.email
    session = stripe.checkout.Session.create(api_key=settings.STRIPE_SECRET_KEY, **params)
    Order.objects.filter(pk=order.pk).update(stripe_session_id=session.id)
    order.stripe_session_id = session.id
    return session.url


def mark_paid(order_id, session_id=""):
    """Paiement confirmé (idempotent : webhook et page de retour peuvent arriver tous les deux)."""
    with transaction.atomic():
        order = Order.objects.select_for_update().filter(pk=order_id).first()
        if not order or order.status not in (Order.STATUS_PENDING, Order.STATUS_CANCELLED):
            return order
        if order.status == Order.STATUS_CANCELLED:
            # Paiement arrivé après l'annulation (rare) : on l'enregistre, à traiter à la main (stock déjà libéré).
            logger.warning("Commande %s payée après annulation (session %s)", order.pk, session_id)
        order.status = Order.STATUS_PAID
        order.paid_at = timezone.now()
        if session_id:
            order.stripe_session_id = session_id
        order.save(update_fields=["status", "paid_at", "stripe_session_id"])
        return order


def cancel_order(order_id, expire_session=True):
    """Annule une commande en attente et remet son stock en vente. Sans effet sur une commande payée."""
    with transaction.atomic():
        order = Order.objects.select_for_update().filter(pk=order_id).first()
        if not order or order.status != Order.STATUS_PENDING:
            return order
        items = list(order.items.all())
        shirts = {s.id: s for s in Shirt.objects.select_for_update().filter(id__in=[i.shirt_id for i in items])}
        for item in items:
            shirt = shirts.get(item.shirt_id)
            if shirt:
                shirt.stock += item.quantity
                shirt.save(update_fields=["stock"])
        order.status = Order.STATUS_CANCELLED
        order.save(update_fields=["status"])
    # Empêche de payer une commande annulée (au mieux : la session peut déjà être expirée).
    if expire_session and order.stripe_session_id and stripe_enabled():
        try:
            stripe.checkout.Session.expire(order.stripe_session_id, api_key=settings.STRIPE_SECRET_KEY)
        except stripe.StripeError:
            pass
    return order


def sync_order(order):
    """Met la commande à jour d'après Stripe (retour sur le site, ou webhook absent en développement)."""
    if order.status != Order.STATUS_PENDING or not order.stripe_session_id or not stripe_enabled():
        return order
    session = stripe.checkout.Session.retrieve(order.stripe_session_id, api_key=settings.STRIPE_SECRET_KEY)
    if session.payment_status in ("paid", "no_payment_required"):
        return mark_paid(order.pk, session.id)
    if session.status == "expired":
        return cancel_order(order.pk, expire_session=False)
    return order


def release_stale_orders(queryset=None):
    """Commandes en attente au-delà du délai de paiement : vérifiées chez Stripe, sinon annulées (stock libéré)."""
    limit = timezone.now() - timedelta(minutes=max(30, settings.PAYMENT_TIMEOUT_MINUTES) + 5)
    qs = (queryset if queryset is not None else Order.objects).filter(status=Order.STATUS_PENDING, created_at__lt=limit)
    released = 0
    for order in qs:
        try:
            order = sync_order(order)
        except stripe.StripeError:
            continue  # Stripe injoignable : on réessaiera plus tard plutôt que d'annuler une commande peut-être payée
        if order.status == Order.STATUS_PENDING:
            order = cancel_order(order.pk)
        if order.status == Order.STATUS_CANCELLED:
            released += 1
    return released
