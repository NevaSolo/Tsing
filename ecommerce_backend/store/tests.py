from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Order, Profile, Shirt

User = get_user_model()


def make_user(email, role, password="Motdepasse-solide-42"):
    user = User.objects.create_user(username=email, email=email, password=password)
    Profile.objects.create(user=user, role=role)
    return user


SHIRT_PAYLOAD = {
    "name": "Rétro 90",
    "description": "Un t-shirt",
    "price": "25.00",
    "stock": 5,
    "text_color": "#000000",
    "text_size": 48,
    "position": '{"x": 0.5, "y": 0.4}',
    "rotation": "0",
    "custom_text": "Hello",
    "font_family": "Arial",
    "shirt_color": "#ffffff",
    "image_scale": "1",
    "image_position": '{"x": 0.5, "y": 0.5}',
    "image_rotation": "0",
}


class AuthTests(APITestCase):
    def test_register_then_login_and_me(self):
        res = self.client.post("/api/register/", {
            "email": "Alice@Example.com", "name": "Alice",
            "password": "Motdepasse-solide-42", "role": "designer",
        })
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["role"], "designer")
        self.assertNotIn("password", res.data)

        res = self.client.post("/api/token/", {
            "username": "alice@example.com", "password": "Motdepasse-solide-42",
        })
        self.assertEqual(res.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        me = self.client.get("/api/me/")
        self.assertEqual(me.data["email"], "alice@example.com")
        self.assertEqual(me.data["name"], "Alice")

    def test_register_rejects_duplicate_email_and_weak_password(self):
        make_user("bob@example.com", "client")
        res = self.client.post("/api/register/", {
            "email": "bob@example.com", "name": "Bob", "password": "Motdepasse-solide-42", "role": "client",
        })
        self.assertEqual(res.status_code, 400)
        res = self.client.post("/api/register/", {
            "email": "new@example.com", "name": "New", "password": "123", "role": "client",
        })
        self.assertEqual(res.status_code, 400)


class ShirtPermissionTests(APITestCase):
    def setUp(self):
        self.designer = make_user("designer@example.com", "designer")
        self.other_designer = make_user("other@example.com", "designer")
        self.client_user = make_user("client@example.com", "client")

    def test_anonymous_can_read_but_not_write(self):
        self.assertEqual(self.client.get("/api/shirts/").status_code, 200)
        self.assertEqual(self.client.post("/api/shirts/", SHIRT_PAYLOAD).status_code, 401)

    def test_client_cannot_create(self):
        self.client.force_authenticate(self.client_user)
        self.assertEqual(self.client.post("/api/shirts/", SHIRT_PAYLOAD).status_code, 403)

    def test_designer_creates_and_json_fields_are_parsed(self):
        self.client.force_authenticate(self.designer)
        res = self.client.post("/api/shirts/", SHIRT_PAYLOAD, format="multipart")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["position"], {"x": 0.5, "y": 0.4})
        self.assertEqual(res.data["rotation"], 0)
        self.assertEqual(res.data["designer"], self.designer.id)

    def test_layers_are_saved_and_validated(self):
        self.client.force_authenticate(self.designer)
        layers = [
            {"id": "a", "type": "path", "color": "#000", "width": 8, "points": [[0.2, 0.3], [0.25, 0.32]]},
            {"id": "b", "type": "shape", "shape": "star", "x": 0.26, "y": 0.3, "size": 80, "color": "#a40000"},
            {"id": "c", "type": "text", "text": "Hi", "x": 0.26, "y": 0.4, "size": 40, "color": "#fff"},
            {"id": "d", "type": "text", "text": "Plus haut", "x": 0.26, "y": 0.2, "size": 30, "color": "#fff", "arc": 98},
            {
                "id": "e", "type": "motif", "motif": "mountains", "x": 0.26, "y": 0.3, "size": 120, "rotation": 0,
                "color": "#f28c28", "color2": "#f5e6c8", "accent": "#cfe9ff", "effects": ["frost", "distressed"], "seed": 42,
            },
            {
                "id": "f", "type": "motif", "motif": "icon", "icon": "game-icons:female", "credit": "game-icons.net (CC BY 3.0)",
                "paths": ["M10 10L20 20Z", "m1.5-2e3 4 4z"], "vb": [512, 512],
                "x": 0.26, "y": 0.3, "size": 100, "color": "#fff", "effects": [], "seed": 3,
            },
            {"id": "g", "type": "trim", "parts": ["collar", "hem"], "color": "#a40000", "color2": "#ffffff", "style": "stripes", "width": 26},
        ]
        payload = {**SHIRT_PAYLOAD, "layers": __import__("json").dumps(layers)}
        res = self.client.post("/api/shirts/", payload, format="multipart")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["layers"], layers)

        bad = {**SHIRT_PAYLOAD, "layers": '[{"type": "virus"}]'}
        self.assertEqual(self.client.post("/api/shirts/", bad, format="multipart").status_code, 400)
        # Valeurs qui feraient planter le rendu côté navigateur
        for broken in (
            [{"type": "shape", "shape": "star", "x": 0.2, "y": 0.2, "size": -50, "color": "#000"}],
            [{"type": "path", "color": "#000", "width": 8, "points": [["a", 1]]}],
            [{"type": "path", "color": "#000", "width": -3, "points": [[0.1, 0.1]]}],
            [{"type": "text", "x": 0.2, "y": 0.2, "size": 40, "color": "#000", "text": "x" * 500}],
            [{"type": "shape", "shape": "pentagon", "x": 0.2, "y": 0.2, "size": 50, "color": "#000"}],
            [{"type": "motif", "motif": "<script>", "x": 0.2, "y": 0.2, "size": 50, "color": "#000"}],
            [{"type": "motif", "motif": "sun", "x": 0.2, "y": 0.2, "size": 50, "color": "#000", "effects": "frost"}],
            [{"type": "motif", "motif": "sun", "x": 0.2, "y": 0.2, "size": 50, "color": "#000", "seed": -4}],
            [{"type": "text", "x": 0.2, "y": 0.2, "size": 40, "color": "#000", "text": "x", "arc": 99999}],
            [{"type": "motif", "motif": "icon", "x": 0.2, "y": 0.2, "size": 50, "color": "#000", "paths": ["<script>"], "vb": [24, 24]}],
            [{"type": "motif", "motif": "icon", "x": 0.2, "y": 0.2, "size": 50, "color": "#000", "paths": ["M0 0Z"], "vb": [0, 24]}],
            [{"type": "motif", "motif": "icon", "x": 0.2, "y": 0.2, "size": 50, "color": "#000", "vb": [24, 24]}],
            [{"type": "trim", "parts": ["pocket"], "color": "#000"}],
            [{"type": "trim", "parts": ["hem"], "color": "#000", "style": "zigzag"}],
            [{"type": "trim", "parts": ["hem"], "color": "#000", "width": 500}],
        ):
            payload = {**SHIRT_PAYLOAD, "layers": __import__("json").dumps(broken)}
            self.assertEqual(self.client.post("/api/shirts/", payload, format="multipart").status_code, 400, broken)
        # Coupure de trait (null) acceptée
        with_break = [{"type": "path", "color": "#000", "width": 8, "points": [[0.1, 0.1], None, [0.7, 0.2]]}]
        ok = {**SHIRT_PAYLOAD, "layers": __import__("json").dumps(with_break)}
        self.assertEqual(self.client.post("/api/shirts/", ok, format="multipart").status_code, 201)
        huge = [{"type": "path", "color": "#000", "width": 8, "points": [[0, 0]] * 20001}]
        too_big = {**SHIRT_PAYLOAD, "layers": __import__("json").dumps(huge)}
        self.assertEqual(self.client.post("/api/shirts/", too_big, format="multipart").status_code, 400)

    def test_shirt_without_layers_defaults_to_empty_list(self):
        self.client.force_authenticate(self.designer)
        res = self.client.post("/api/shirts/", SHIRT_PAYLOAD, format="multipart")
        self.assertEqual(res.data["layers"], [])

    def test_only_owner_can_modify(self):
        shirt = Shirt.objects.create(designer=self.designer, name="A", price=10, stock=1)
        self.client.force_authenticate(self.other_designer)
        self.assertEqual(self.client.patch(f"/api/shirts/{shirt.id}/", {"name": "X"}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/shirts/{shirt.id}/").status_code, 403)
        self.client.force_authenticate(self.designer)
        self.assertEqual(self.client.patch(f"/api/shirts/{shirt.id}/", {"name": "X"}).status_code, 200)

    def test_mine_filter(self):
        Shirt.objects.create(designer=self.designer, name="A", price=10, stock=1)
        Shirt.objects.create(designer=self.other_designer, name="B", price=10, stock=1)
        self.client.force_authenticate(self.designer)
        res = self.client.get("/api/shirts/?mine=1")
        self.assertEqual([s["name"] for s in res.data], ["A"])


# Paiement simulé : ces tests ne dépendent pas d'une éventuelle clé Stripe dans .env.
@override_settings(STRIPE_SECRET_KEY="")
class OrderTests(APITestCase):
    def setUp(self):
        self.designer = make_user("designer@example.com", "designer")
        self.buyer = make_user("buyer@example.com", "client")
        self.shirt = Shirt.objects.create(designer=self.designer, name="A", price=Decimal("20.00"), stock=3)

    def order_payload(self, quantity):
        return {
            "customer_name": "Jean Client", "email": "buyer@example.com",
            "address": "1 rue X", "city": "Paris", "postal_code": "75000", "country": "France",
            "items": [{"shirt": self.shirt.id, "quantity": quantity, "size": "L"}],
        }

    def test_order_uses_server_price_and_decrements_stock(self):
        self.client.force_authenticate(self.buyer)
        res = self.client.post("/api/orders/", self.order_payload(2), format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Decimal(res.data["total"]), Decimal("40.00"))
        self.shirt.refresh_from_db()
        self.assertEqual(self.shirt.stock, 1)

    def test_order_rejected_when_out_of_stock(self):
        self.client.force_authenticate(self.buyer)
        res = self.client.post("/api/orders/", self.order_payload(10), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Order.objects.count(), 0)
        self.shirt.refresh_from_db()
        self.assertEqual(self.shirt.stock, 3)

    def test_users_only_see_their_orders_and_designer_sees_sales(self):
        self.client.force_authenticate(self.buyer)
        self.client.post("/api/orders/", self.order_payload(1), format="json")
        other = make_user("other@example.com", "client")
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get("/api/orders/").data, [])
        self.client.force_authenticate(self.designer)
        sales = self.client.get("/api/orders/sales/").data
        self.assertEqual(len(sales), 1)
        self.assertEqual(sales[0]["customer_name"], "Jean Client")

    def test_cannot_delete_ordered_shirt(self):
        self.client.force_authenticate(self.buyer)
        self.client.post("/api/orders/", self.order_payload(1), format="json")
        self.client.force_authenticate(self.designer)
        res = self.client.delete(f"/api/shirts/{self.shirt.id}/")
        self.assertEqual(res.status_code, 409)

    def test_anonymous_cannot_order(self):
        res = self.client.post("/api/orders/", self.order_payload(1), format="json")
        self.assertEqual(res.status_code, 401)


class CartTests(APITestCase):
    def test_add_validates_input(self):
        user = make_user("c@example.com", "client")
        self.client.force_authenticate(user)
        self.assertEqual(self.client.post("/api/cart/add/", {"shirt_id": 999}).status_code, 404)
        shirt = Shirt.objects.create(name="A", price=10, stock=1)
        self.assertEqual(
            self.client.post("/api/cart/add/", {"shirt_id": shirt.id, "quantity": "-2"}).status_code, 400
        )
        self.assertEqual(
            self.client.post("/api/cart/add/", {"shirt_id": shirt.id, "quantity": 2}).status_code, 200
        )
