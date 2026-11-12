"""Crée (ou réinitialise) les comptes de démonstration : python manage.py seed_demo"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from decimal import Decimal

from store.models import Profile, Shirt

DEMO_PASSWORD = "Demo-pass-2026"
ACCOUNTS = [
    ("designer.demo@example.com", "Demo", "Designer", Profile.ROLE_DESIGNER),
    ("client.demo@example.com", "Demo", "Client", Profile.ROLE_CLIENT),
]


# T-shirts de la boutique de démo (créés une seule fois, par nom).
DEMO_SHIRTS = [
    ("Les Vagues", "T-shirt surf au style rétro.", "24.90", 25, "#fff7ed", "#c2410c", "LES VAGUES"),
    ("Néon Gamer", "Pour les soirées jeux entre amis.", "22.00", 15, "#111111", "#22d3ee", "GAME ON"),
    ("Paris 2026", "Streetwear minimaliste.", "27.50", 10, "#ffffff", "#111111", "PARIS 2026"),
]


class Command(BaseCommand):
    help = "Crée les comptes de démonstration (designer et client)."

    def handle(self, *args, **options):
        User = get_user_model()
        for email, first, last, role in ACCOUNTS:
            user, created = User.objects.get_or_create(
                username=email, defaults={"email": email, "first_name": first, "last_name": last}
            )
            user.set_password(DEMO_PASSWORD)
            user.save()
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.role = role
            profile.save()
            self.stdout.write(f"{'Créé' if created else 'Mis à jour'} : {email} ({role})")
        designer = User.objects.get(username=ACCOUNTS[0][0])
        for name, description, price, stock, shirt_color, text_color, text in DEMO_SHIRTS:
            _, created = Shirt.objects.get_or_create(
                name=name,
                designer=designer,
                defaults={
                    "description": description,
                    "price": Decimal(price),
                    "stock": stock,
                    "shirt_color": shirt_color,
                    "text_color": text_color,
                    "custom_text": text,
                    "position": {"x": 0.265, "y": 0.3},
                },
            )
            if created:
                self.stdout.write(f"T-shirt de démo créé : {name}")
        self.stdout.write(self.style.SUCCESS(f"Mot de passe des comptes de démo : {DEMO_PASSWORD}"))
