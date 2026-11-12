import logging

import stripe
from django.db.models import Prefetch, ProtectedError, Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Order, OrderItem, Shirt
from .permissions import IsDesignerOwnerOrReadOnly, is_designer
from .serializers import OrderItemSerializer, OrderSerializer, ShirtSerializer
from . import payments

logger = logging.getLogger(__name__)


class ShirtViewSet(viewsets.ModelViewSet):
    """
    Catalogue public en lecture.
    - `?mine=1` : uniquement les t-shirts du designer connecté.
    - `?search=texte` : filtre sur le nom ou la description.
    """

    serializer_class = ShirtSerializer
    permission_classes = [IsDesignerOwnerOrReadOnly]

    def get_queryset(self):
        qs = Shirt.objects.select_related("designer")
        params = self.request.query_params
        if params.get("mine") in ("1", "true") and self.request.user.is_authenticated:
            qs = qs.filter(designer=self.request.user)
        search = params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))
        return qs

    def perform_create(self, serializer):
        serializer.save(designer=self.request.user)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Ce t-shirt figure dans des commandes : mettez son stock à 0 plutôt que de le supprimer."},
                status=status.HTTP_409_CONFLICT,
            )


class OrderViewSet(viewsets.ModelViewSet):
    """Chaque utilisateur ne voit que ses propres commandes."""

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    # Une commande passée ne se modifie pas via l'API publique.
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        items = OrderItem.objects.select_related("shirt__designer")
        return Order.objects.filter(user=self.request.user).prefetch_related(
            Prefetch("items", queryset=items)
        )

    def list(self, request, *args, **kwargs):
        # Commandes abandonnées au paiement : vérifiées / annulées (stock libéré) avant affichage.
        payments.release_stale_orders(Order.objects.filter(user=request.user))
        return super().list(request, *args, **kwargs)

    def _stripe_error(self, err):
        if isinstance(err, (stripe.AuthenticationError, stripe.PermissionError)):
            # Clé absente/invalide : problème de configuration du site, pas du client.
            detail = "Le paiement en ligne est mal configuré (clé Stripe refusée). Le site a été prévenu ; réessayez plus tard."
        elif isinstance(err, stripe.APIConnectionError):
            detail = "Le service de paiement est injoignable. Réessayez dans un instant."
        else:
            detail = f"Le paiement n'a pas pu être lancé : {getattr(err, 'user_message', None) or 'réessayez dans un instant.'}"
        logger.error("Erreur Stripe : %s", err)
        return Response({"detail": detail}, status=status.HTTP_502_BAD_GATEWAY)

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        """Ouvre (ou rouvre) le paiement Stripe d'une commande en attente → {url}."""
        order = self.get_object()
        if order.status != Order.STATUS_PENDING:
            return Response({"detail": "Cette commande n'est plus à payer.", "status": order.status}, status=status.HTTP_409_CONFLICT)
        if not payments.stripe_enabled():
            return Response({"detail": "Le paiement en ligne n'est pas configuré sur ce serveur."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            return Response({"url": payments.create_checkout_session(order)})
        except stripe.StripeError as err:
            return self._stripe_error(err)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """Retour de Stripe : met à jour le statut d'après la session (le webhook le fait aussi en production)."""
        order = self.get_object()
        try:
            payments.sync_order(order)
        except stripe.StripeError as err:
            return self._stripe_error(err)
        return Response(OrderSerializer(self.get_queryset().get(pk=order.pk)).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Annule une commande pas encore payée (stock remis en vente)."""
        order = self.get_object()
        if order.status != Order.STATUS_PENDING:
            return Response({"detail": "Seule une commande en attente de paiement peut être annulée."}, status=status.HTTP_409_CONFLICT)
        payments.cancel_order(order.pk)
        return Response(OrderSerializer(self.get_queryset().get(pk=order.pk)).data)

    @action(detail=False, methods=["get"])
    def sales(self, request):
        """Lignes de commande portant sur les t-shirts du designer connecté."""
        if not is_designer(request.user):
            return Response({"detail": "Réservé aux designers."}, status=403)
        # Ventes réelles seulement : ni les commandes en attente de paiement, ni les annulées.
        items = (
            OrderItem.objects.filter(shirt__designer=request.user)
            .exclude(order__status__in=[Order.STATUS_PENDING, Order.STATUS_CANCELLED])
            .select_related("order", "shirt__designer")
            .order_by("-order__created_at")
        )
        data = [
            {
                **OrderItemSerializer(item).data,
                "order_id": item.order_id,
                "customer_name": item.order.customer_name,
                "status": item.order.status,
                "status_display": item.order.get_status_display(),
                "created_at": item.order.created_at,
            }
            for item in items
        ]
        return Response(data)
