import hashlib
import hmac
import json
import time
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest import mock

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Order, Shirt
from .payments import release_stale_orders, to_minor_units
from .tests import make_user

STRIPE = {"STRIPE_SECRET_KEY": "sk_test_dummy", "STRIPE_WEBHOOK_SECRET": "whsec_dummy", "STRIPE_CURRENCY": "eur", "FRONTEND_URL": "http://localhost:5173"}
SESSION = SimpleNamespace(id="cs_test_123", url="https://checkout.stripe.com/c/pay/cs_test_123")


def signed(payload, secret="whsec_dummy"):
    """En-tête Stripe-Signature, calculé comme Stripe (HMAC-SHA256 de « horodatage.corps »)."""
    ts = int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}.{payload}".encode(), hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}"


class PaymentTests(APITestCase):
    def setUp(self):
        self.buyer = make_user("acheteur@example.com", "client")
        self.other = make_user("autre@example.com", "client")
        designer = make_user("d@example.com", "designer")
        self.shirt = Shirt.objects.create(designer=designer, name="Les Vagues", price=Decimal("24.90"), stock=5)
        self.client.force_authenticate(self.buyer)

    def order(self, quantity=2):
        res = self.client.post("/api/orders/", {
            "customer_name": "Acheteur", "email": "acheteur@example.com", "address": "1 rue", "city": "Paris",
            "postal_code": "75001", "country": "France",
            "items": [{"shirt": self.shirt.id, "quantity": quantity, "size": "L"}],
        }, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def webhook(self, event_type, session, secret="whsec_dummy"):
        payload = json.dumps({"id": "evt_1", "object": "event", "type": event_type, "data": {"object": session}})
        self.client.force_authenticate(None)
        return self.client.generic("POST", "/api/payments/webhook/", payload, content_type="application/json", HTTP_STRIPE_SIGNATURE=signed(payload, secret))

    @override_settings(STRIPE_SECRET_KEY="")
    def test_demo_mode_without_key(self):
        self.assertEqual(self.client.get("/api/payments/config/").data["mode"], "demo")
        order = self.order()
        self.assertEqual(order["status"], "paid")
        self.assertIsNotNone(order["paid_at"])
        self.assertEqual(self.client.post(f"/api/orders/{order['id']}/pay/").status_code, 409)

    @override_settings(**STRIPE)
    def test_checkout_session_uses_server_prices(self):
        config = self.client.get("/api/payments/config/").data
        self.assertEqual((config["mode"], config["test_mode"]), ("stripe", True))
        order = self.order(quantity=2)
        self.assertEqual(order["status"], "pending")
        self.shirt.refresh_from_db()
        self.assertEqual(self.shirt.stock, 3, "stock réservé pendant le paiement")
        with mock.patch("stripe.checkout.Session.create", return_value=SESSION) as create:
            res = self.client.post(f"/api/orders/{order['id']}/pay/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["url"], SESSION.url)
        kwargs = create.call_args.kwargs
        self.assertEqual(kwargs["api_key"], "sk_test_dummy")
        line = kwargs["line_items"][0]
        self.assertEqual(line["price_data"]["unit_amount"], 2490)
        self.assertEqual(line["quantity"], 2)
        self.assertEqual(kwargs["metadata"]["order_id"], str(order["id"]))
        self.assertIn("{CHECKOUT_SESSION_ID}", kwargs["success_url"])
        self.assertGreaterEqual(kwargs["expires_at"] - int(time.time()), 30 * 60)
        self.assertEqual(Order.objects.get(pk=order["id"]).stripe_session_id, "cs_test_123")

    @override_settings(**STRIPE)
    def test_only_owner_can_pay_confirm_cancel(self):
        order = self.order()
        self.client.force_authenticate(self.other)
        for action in ("pay", "confirm", "cancel"):
            self.assertEqual(self.client.post(f"/api/orders/{order['id']}/{action}/").status_code, 404, action)

    @override_settings(**STRIPE)
    def test_return_page_confirms_payment(self):
        order = self.order()
        Order.objects.filter(pk=order["id"]).update(stripe_session_id="cs_test_123")
        unpaid = SimpleNamespace(id="cs_test_123", payment_status="unpaid", status="open")
        paid = SimpleNamespace(id="cs_test_123", payment_status="paid", status="complete")
        with mock.patch("stripe.checkout.Session.retrieve", return_value=unpaid):
            self.assertEqual(self.client.post(f"/api/orders/{order['id']}/confirm/").data["status"], "pending")
        with mock.patch("stripe.checkout.Session.retrieve", return_value=paid):
            res = self.client.post(f"/api/orders/{order['id']}/confirm/")
        self.assertEqual(res.data["status"], "paid")
        self.assertIsNotNone(res.data["paid_at"])

    @override_settings(**STRIPE)
    def test_webhook_signature_and_events(self):
        order = self.order()
        session = {"id": "cs_test_123", "object": "checkout.session", "payment_status": "paid", "metadata": {"order_id": str(order["id"])}}
        self.assertEqual(self.webhook("checkout.session.completed", session, secret="whsec_mauvais").status_code, 400)
        self.assertEqual(Order.objects.get(pk=order["id"]).status, "pending")
        self.assertEqual(self.webhook("checkout.session.completed", session).status_code, 200)
        self.assertEqual(Order.objects.get(pk=order["id"]).status, "paid")
        # Rejoué (Stripe renvoie parfois un événement) : sans effet.
        self.assertEqual(self.webhook("checkout.session.completed", session).status_code, 200)
        # Une commande payée n'est jamais annulée par un « expired » tardif.
        self.webhook("checkout.session.expired", session)
        self.assertEqual(Order.objects.get(pk=order["id"]).status, "paid")

    @override_settings(**STRIPE)
    def test_expired_or_cancelled_orders_release_stock(self):
        expired = self.order(quantity=2)
        self.webhook("checkout.session.expired", {"id": "cs_x", "metadata": {"order_id": str(expired["id"])}})
        self.assertEqual(Order.objects.get(pk=expired["id"]).status, "cancelled")
        self.shirt.refresh_from_db()
        self.assertEqual(self.shirt.stock, 5)

        self.client.force_authenticate(self.buyer)
        cancelled = self.order(quantity=1)
        res = self.client.post(f"/api/orders/{cancelled['id']}/cancel/")
        self.assertEqual(res.data["status"], "cancelled")
        self.assertEqual(self.client.post(f"/api/orders/{cancelled['id']}/cancel/").status_code, 409)
        self.shirt.refresh_from_db()
        self.assertEqual(self.shirt.stock, 5)

        # Abandon sans webhook : libéré après le délai, si Stripe confirme que rien n'a été payé.
        stale = self.order(quantity=3)
        Order.objects.filter(pk=stale["id"]).update(created_at=timezone.now() - timedelta(hours=2), stripe_session_id="cs_old")
        open_session = SimpleNamespace(id="cs_old", payment_status="unpaid", status="open")
        with mock.patch("stripe.checkout.Session.retrieve", return_value=open_session), mock.patch("stripe.checkout.Session.expire"):
            self.assertEqual(release_stale_orders(), 1)
        self.shirt.refresh_from_db()
        self.assertEqual(self.shirt.stock, 5)

    @override_settings(**STRIPE)
    def test_designer_sales_exclude_unpaid(self):
        order = self.order()
        designer = self.shirt.designer
        self.client.force_authenticate(designer)
        self.assertEqual(self.client.get("/api/orders/sales/").data, [])
        Order.objects.filter(pk=order["id"]).update(status="paid")
        self.assertEqual(len(self.client.get("/api/orders/sales/").data), 1)

    def test_minor_units(self):
        self.assertEqual(to_minor_units(Decimal("24.90"), "eur"), 2490)
        self.assertEqual(to_minor_units(Decimal("0.005"), "eur"), 1)
        self.assertEqual(to_minor_units(Decimal("15000"), "mga"), 15000)
