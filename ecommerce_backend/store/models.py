from decimal import Decimal

from django.conf import settings
from django.core.validators import FileExtensionValidator, MinValueValidator
from django.db import models


def default_zero():
    return 0


def default_one():
    return 1


class Profile(models.Model):
    """Informations complémentaires d'un utilisateur (rôle client / designer)."""

    ROLE_CLIENT = "client"
    ROLE_DESIGNER = "designer"
    ROLE_CHOICES = [(ROLE_CLIENT, "Client"), (ROLE_DESIGNER, "Designer")]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_CLIENT)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class Shirt(models.Model):
    designer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shirts",
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    price = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0"))]
    )
    stock = models.PositiveIntegerField(default=0)
    text_color = models.CharField(max_length=20, default="#000000")
    text_size = models.IntegerField(default=48)
    position = models.JSONField(default=dict)
    rotation = models.JSONField(default=default_zero)
    custom_text = models.TextField(blank=True, default="")
    font_family = models.CharField(max_length=100, default="Arial")
    shirt_color = models.CharField(max_length=20, default="#ffffff")
    image = models.ImageField(
        upload_to="uploads/",
        blank=True,
        null=True,
        validators=[FileExtensionValidator(allowed_extensions=["jpg", "jpeg", "png"])],
    )
    image_scale = models.JSONField(default=default_one)
    image_position = models.JSONField(default=dict)
    image_rotation = models.JSONField(default=default_zero)
    # Calques libres dessinés dans l'éditeur (traits, formes, textes), en coordonnées de texture.
    layers = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class Order(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PAID = "paid"
    STATUS_SHIPPED = "shipped"
    STATUS_DELIVERED = "delivered"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "En attente"),
        (STATUS_PAID, "Payée"),
        (STATUS_SHIPPED, "Expédiée"),
        (STATUS_DELIVERED, "Livrée"),
        (STATUS_CANCELLED, "Annulée"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    customer_name = models.CharField(max_length=100)
    email = models.EmailField(blank=True, default="")
    address = models.CharField(max_length=255, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    postal_code = models.CharField(max_length=20, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    created_at = models.DateTimeField(auto_now_add=True)
    # Paiement Stripe Checkout : session en cours (ou dernière) et date de confirmation du paiement.
    stripe_session_id = models.CharField(max_length=255, blank=True, default="", db_index=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Commande #{self.pk} - {self.customer_name}"


class OrderItem(models.Model):
    SIZE_CHOICES = [(s, s) for s in ("XS", "S", "M", "L", "XL", "XXL")]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    # PROTECT : on ne perd pas l'historique des commandes si un t-shirt est supprimé.
    shirt = models.ForeignKey(Shirt, on_delete=models.PROTECT, related_name="order_items")
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    size = models.CharField(max_length=5, choices=SIZE_CHOICES, default="M")
    # Prix figé au moment de la commande.
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))

    @property
    def line_total(self):
        return self.unit_price * self.quantity


# Panier côté serveur

class Cart(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    def __str__(self):
        return f"Panier de {self.user.username}"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    shirt = models.ForeignKey(Shirt, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    def __str__(self):
        return f"{self.quantity} x {self.shirt.name}"


# Messagerie client ↔ designer

MESSAGE_MAX_LENGTH = 2000


class Conversation(models.Model):
    """Une seule conversation par couple (client, designer) ; `client` est celui qui l'a ouverte."""

    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="client_conversations")
    designer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="designer_conversations")
    created_at = models.DateTimeField(auto_now_add=True)
    # Date du dernier message : trie la boîte de réception.
    updated_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [models.UniqueConstraint(fields=["client", "designer"], name="unique_conversation_pair")]

    def __str__(self):
        return f"{self.client} ↔ {self.designer}"

    def other(self, user):
        return self.designer if user.id == self.client_id else self.client

    def involves(self, user):
        return user.id in (self.client_id, self.designer_id)


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="messages")
    body = models.TextField(max_length=MESSAGE_MAX_LENGTH, blank=True, default="")
    # Design joint (ex. « je voudrais ce modèle en rouge ») ; le message reste si le t-shirt est supprimé.
    shirt = models.ForeignKey(Shirt, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.author}: {self.body[:40]}"
