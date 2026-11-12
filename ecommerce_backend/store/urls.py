from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OrderViewSet, ShirtViewSet
from .views_auth import MeView, RegisterView
from .views_cart import CartViewSet
from .views_messages import ConversationViewSet
from .views_payments import PaymentConfigView, StripeWebhookView
from .views_ai import AIConfigView, BriefView

router = DefaultRouter()
router.register(r"orders", OrderViewSet, basename="orders")
router.register(r"shirts", ShirtViewSet, basename="shirts")
# Ancienne URL avec majuscule, conservée pour compatibilité.
router.register(r"Shirts", ShirtViewSet, basename="Shirts")
router.register(r"cart", CartViewSet, basename="cart")
router.register(r"conversations", ConversationViewSet, basename="conversations")


urlpatterns = [
    path("", include(router.urls)),
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", MeView.as_view(), name="me"),
    path("payments/config/", PaymentConfigView.as_view(), name="payment-config"),
    path("ai/config/", AIConfigView.as_view(), name="ai-config"),
    path("ai/brief/", BriefView.as_view(), name="ai-brief"),
    path("payments/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
]
