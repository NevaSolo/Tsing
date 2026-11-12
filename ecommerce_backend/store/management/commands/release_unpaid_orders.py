"""
Libère les commandes restées « En attente » au-delà du délai de paiement (stock remis en vente).
Vérifie d'abord chez Stripe qu'elles n'ont pas été payées. À lancer régulièrement (tâche planifiée) :
    python manage.py release_unpaid_orders
"""
from django.core.management.base import BaseCommand

from store.payments import release_stale_orders


class Command(BaseCommand):
    help = "Annule les commandes non payées dans le délai et remet leur stock en vente."

    def handle(self, *args, **options):
        released = release_stale_orders()
        self.stdout.write(self.style.SUCCESS(f"{released} commande(s) non payée(s) annulée(s)."))
