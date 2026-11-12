import json
import math
import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import Cart, CartItem, Order, OrderItem, Profile, Shirt

User = get_user_model()

LAYER_TYPES = {"path", "shape", "text", "motif", "trim"}
# Bordures du t-shirt (col, manches, bas).
TRIM_PARTS = {"collar", "sleeves", "hem"}
TRIM_STYLES = {"solid", "double", "stripes"}
# Motif : identifiant d'illustration (liste tenue côté client ; un motif inconnu y est simplement ignoré).
MOTIF_ID = re.compile(r"^[a-z_]{1,40}$")
EFFECT_ID = re.compile(r"^[a-z]{1,20}$")
MAX_EFFECTS = 5
# Illustration de bibliothèque (motif « icon ») : tracés SVG (attribut d) — caractères de tracé uniquement.
SVG_PATH = re.compile(r"^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$")
MAX_ICON_PATHS = 20
MAX_ICON_CHARS = 60000
SHAPE_KINDS = {"rect", "circle", "triangle", "star", "heart"}
MAX_LAYERS = 200
MAX_PATH_POINTS = 20000


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _check_range(layer, field, low, high, required=True):
    if field not in layer and not required:
        return
    value = layer.get(field)
    if not _is_number(value) or not (low <= value <= high):
        raise serializers.ValidationError(f"Calque invalide : « {field} » doit être un nombre entre {low} et {high}.")


def _validate_motif(layer):
    """Motif vectoriel : identifiant, couleurs secondaires, effets, graine."""
    if not isinstance(layer.get("motif"), str) or not MOTIF_ID.match(layer["motif"]):
        raise serializers.ValidationError("Calque invalide : motif inconnu.")
    for key in ("color2", "accent"):
        value = layer.get(key)
        if value is not None and (not isinstance(value, str) or len(value) > 32):
            raise serializers.ValidationError(f"Calque invalide : « {key} » doit être une couleur.")
    effects = layer.get("effects", [])
    if not isinstance(effects, list) or len(effects) > MAX_EFFECTS or not all(
        isinstance(e, str) and EFFECT_ID.match(e) for e in effects
    ):
        raise serializers.ValidationError("Calque invalide : effets mal formés.")
    if layer["motif"] == "icon":
        paths = layer.get("paths")
        if (
            not isinstance(paths, list) or not paths or len(paths) > MAX_ICON_PATHS
            or not all(isinstance(d, str) and SVG_PATH.match(d) for d in paths)
            or sum(len(d) for d in paths) > MAX_ICON_CHARS
        ):
            raise serializers.ValidationError("Calque invalide : tracé d'illustration mal formé.")
        vb = layer.get("vb")
        if not (isinstance(vb, list) and len(vb) == 2 and all(_is_number(n) and 0 < n <= 4096 for n in vb)):
            raise serializers.ValidationError("Calque invalide : dimensions d'illustration incorrectes.")
        for key in ("icon", "credit"):
            if key in layer and (not isinstance(layer[key], str) or len(layer[key]) > 80):
                raise serializers.ValidationError(f"Calque invalide : « {key} » trop long.")
    seed = layer.get("seed", 1)
    if isinstance(seed, bool) or not isinstance(seed, int) or not (0 <= seed <= 1_000_000):
        raise serializers.ValidationError("Calque invalide : « seed » doit être un entier entre 0 et 1 000 000.")


class LenientJSONField(serializers.JSONField):
    """Accepte du JSON natif ou une chaîne JSON (cas des envois multipart/form-data)."""

    def to_internal_value(self, data):
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except ValueError:
                raise serializers.ValidationError("JSON invalide.")
        return super().to_internal_value(data)


# --- Utilisateurs -----------------------------------------------------------

class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="profile.role", read_only=True)
    name = serializers.CharField(source="first_name", read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "name", "role"]


class RegisterSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", max_length=150)
    role = serializers.ChoiceField(choices=Profile.ROLE_CHOICES, write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ["id", "email", "name", "password", "role"]
        extra_kwargs = {"email": {"required": True}}

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Cet email est déjà utilisé.")
        return value

    def validate(self, attrs):
        candidate = User(username=attrs["email"], email=attrs["email"])
        validate_password(attrs["password"], user=candidate)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.pop("role")
        # L'email sert d'identifiant de connexion.
        user = User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
        )
        Profile.objects.create(user=user, role=role)
        return user

    def to_representation(self, instance):
        return UserSerializer(instance).data


# --- T-shirts ---------------------------------------------------------------

class ShirtSerializer(serializers.ModelSerializer):
    position = LenientJSONField(required=False)
    rotation = LenientJSONField(required=False)
    image_scale = LenientJSONField(required=False)
    image_position = LenientJSONField(required=False)
    image_rotation = LenientJSONField(required=False)
    layers = LenientJSONField(required=False)
    designer = serializers.PrimaryKeyRelatedField(read_only=True)
    designer_name = serializers.SerializerMethodField()

    class Meta:
        model = Shirt
        fields = "__all__"

    def get_designer_name(self, obj):
        if not obj.designer:
            return None
        return obj.designer.first_name or obj.designer.username

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Le prix doit être positif ou nul.")
        return value

    def validate_layers(self, value):
        """Garde-fous : structure attendue et taille raisonnable (le JSON est stocké tel quel)."""
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Les calques doivent être une liste.")
        if len(value) > MAX_LAYERS:
            raise serializers.ValidationError(f"{MAX_LAYERS} calques maximum.")
        total_points = 0
        for layer in value:
            if not isinstance(layer, dict) or layer.get("type") not in LAYER_TYPES:
                raise serializers.ValidationError("Type de calque invalide.")
            color = layer.get("color")
            if not isinstance(color, str) or len(color) > 32:
                raise serializers.ValidationError("Calque invalide : couleur manquante.")
            if layer["type"] == "trim":
                parts = layer.get("parts")
                if not isinstance(parts, list) or not parts or not set(parts) <= TRIM_PARTS:
                    raise serializers.ValidationError("Bordure invalide : parties inconnues.")
                if layer.get("style", "solid") not in TRIM_STYLES:
                    raise serializers.ValidationError("Bordure invalide : style inconnu.")
                color2 = layer.get("color2")
                if color2 is not None and (not isinstance(color2, str) or len(color2) > 32):
                    raise serializers.ValidationError("Bordure invalide : 2e couleur.")
                _check_range(layer, "width", 4, 80, required=False)
                continue
            if layer["type"] == "path":
                points = layer.get("points")
                if not isinstance(points, list) or not points:
                    raise serializers.ValidationError("Un trait doit contenir une liste de points.")
                for point in points:
                    # `null` = coupure (couture du patron franchie)
                    if point is None:
                        continue
                    if not (isinstance(point, list) and len(point) == 2 and all(_is_number(c) for c in point)):
                        raise serializers.ValidationError("Calque invalide : point de trait mal formé.")
                _check_range(layer, "width", 0.5, 200)
                total_points += len(points)
            else:
                _check_range(layer, "x", -1, 2)
                _check_range(layer, "y", -1, 2)
                _check_range(layer, "size", 1, 1000)
                _check_range(layer, "rotation", -360, 360, required=False)
                if layer["type"] == "shape":
                    if layer.get("shape") not in SHAPE_KINDS:
                        raise serializers.ValidationError("Calque invalide : forme inconnue.")
                    _check_range(layer, "strokeWidth", 0, 200, required=False)
                elif layer["type"] == "motif":
                    _validate_motif(layer)
                else:
                    if not isinstance(layer.get("text"), str) or len(layer["text"]) > 200:
                        raise serializers.ValidationError("Calque invalide : texte manquant ou trop long (200 caractères max).")
                    # Texte courbé : rayon en px (négatif = bas du cercle).
                    _check_range(layer, "arc", -2000, 2000, required=False)
        if total_points > MAX_PATH_POINTS:
            raise serializers.ValidationError("Dessin trop détaillé : simplifiez ou effacez quelques traits.")
        return value


# --- Commandes --------------------------------------------------------------

class OrderItemSerializer(serializers.ModelSerializer):
    shirt_name = serializers.CharField(source="shirt.name", read_only=True)
    designer_name = serializers.SerializerMethodField()
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id", "shirt", "shirt_name", "designer_name",
            "quantity", "size", "unit_price", "line_total",
        ]
        read_only_fields = ["unit_price"]

    def get_designer_name(self, obj):
        designer = obj.shirt.designer
        return (designer.first_name or designer.username) if designer else None

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("La quantité doit être au moins 1.")
        return value


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "customer_name", "email", "address", "city", "postal_code",
            "country", "status", "status_display", "total", "created_at", "paid_at", "items",
        ]
        read_only_fields = ["status", "total", "created_at", "paid_at"]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("La commande doit contenir au moins un article.")
        return items

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        user = self.context["request"].user
        order = Order.objects.create(user=user, **validated_data)

        total = 0
        # Verrouille les t-shirts concernés pour éviter les ventes au-delà du stock.
        shirt_ids = {item["shirt"].id for item in items_data}
        shirts = {s.id: s for s in Shirt.objects.select_for_update().filter(id__in=shirt_ids)}
        errors = []
        for item in items_data:
            shirt = shirts[item["shirt"].id]
            if shirt.stock < item["quantity"]:
                errors.append(f"Stock insuffisant pour « {shirt.name} » ({shirt.stock} disponible(s)).")
                continue
            shirt.stock -= item["quantity"]
            shirt.save(update_fields=["stock"])
            OrderItem.objects.create(
                order=order,
                shirt=shirt,
                quantity=item["quantity"],
                size=item.get("size", "M"),
                unit_price=shirt.price,  # prix pris en base, jamais celui envoyé par le client
            )
            total += shirt.price * item["quantity"]
        if errors:
            raise serializers.ValidationError({"items": errors})

        order.total = total
        # Avec Stripe : « En attente » jusqu'au paiement (stock réservé). Sans clé : paiement simulé.
        from .payments import stripe_enabled  # import local : évite une importation circulaire

        if not stripe_enabled():
            order.status = Order.STATUS_PAID
            order.paid_at = timezone.now()
        order.save(update_fields=["total", "status", "paid_at"])
        return order


# --- Panier serveur ---------------------------------------------------------

class CartItemSerializer(serializers.ModelSerializer):
    shirt = ShirtSerializer(read_only=True)
    shirt_id = serializers.PrimaryKeyRelatedField(
        queryset=Shirt.objects.all(), write_only=True, source="shirt"
    )

    class Meta:
        model = CartItem
        fields = ["id", "shirt", "shirt_id", "quantity"]


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = ["id", "user", "items"]
        read_only_fields = ["user"]
