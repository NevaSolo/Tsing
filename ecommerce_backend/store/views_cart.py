from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Cart, CartItem, Shirt
from .serializers import CartSerializer


def _parse_quantity(raw, default=1):
    try:
        value = int(raw if raw is not None else default)
    except (TypeError, ValueError):
        return None
    return value if value >= 1 else None


class CartViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return Response(CartSerializer(cart, context={"request": request}).data)

    @action(detail=False, methods=["post"])
    def add(self, request):
        quantity = _parse_quantity(request.data.get("quantity"))
        if quantity is None:
            return Response(
                {"detail": "La quantité doit être un entier ≥ 1."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        shirt = get_object_or_404(Shirt, id=request.data.get("shirt_id"))
        cart, _ = Cart.objects.get_or_create(user=request.user)

        item, created = CartItem.objects.get_or_create(
            cart=cart, shirt=shirt, defaults={"quantity": quantity}
        )
        if not created:
            item.quantity += quantity
            item.save(update_fields=["quantity"])

        return Response({"message": "Produit ajouté au panier"})

    @action(detail=False, methods=["post"])
    def remove(self, request):
        cart, _ = Cart.objects.get_or_create(user=request.user)
        CartItem.objects.filter(cart=cart, shirt_id=request.data.get("shirt_id")).delete()
        return Response({"message": "Produit supprimé du panier"})
