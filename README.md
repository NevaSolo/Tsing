# Tsing : personnalisation de t-shirts en 3D

- `client/` : React 19 + Vite + Three.js (react-three-fiber) + Tailwind
- `ecommerce_backend/` : Django + Django REST Framework + JWT (SimpleJWT) + SQLite en dev / PostgreSQL en production

## Mise en production

Voir [deploy/README.md](deploy/README.md) : Docker Compose (Caddy HTTPS, Django, PostgreSQL) et IA du serveur via Ollama (`qwen3:4b`).

## Démarrage en local

### 1. Base de données

Rien à installer en développement : Django utilise SQLite (fichier `ecommerce_backend/db.sqlite3`, créé par `migrate`).
En production, définir `DB_ENGINE=postgres` et les variables `POSTGRES_*` (voir `.env.example`).

### 2. Backend

```bash
cd ecommerce_backend
python -m venv env
env\Scripts\activate            # Windows (source env/bin/activate sous Linux/macOS)
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo       # comptes de démo + 3 t-shirts (mot de passe : Demo-pass-2026)
python manage.py createsuperuser  # optionnel, pour /admin
python manage.py runserver 8001
python manage.py test store       # tests de l'API
```

La configuration se fait par variables d'environnement (voir `.env.example`). Sans elles, ce sont les valeurs de dev qui s'appliquent.

### Paiement (Stripe Checkout)

Sans clé, le paiement est **simulé** (commande payée immédiatement). Pour activer Stripe en **mode test** (aucun débit réel) :

1. Créer un compte sur [stripe.com](https://dashboard.stripe.com/register), puis copier la clé secrète de test (`sk_test_…`) depuis *Développeurs → Clés API*.
2. Dans `ecommerce_backend/.env` (copie de `.env.example`) : `STRIPE_SECRET_KEY=sk_test_…`, puis relancer Django.
3. Payer avec la carte `4242 4242 4242 4242`, une date future et n'importe quel code.

Fonctionnement : la commande est créée « En attente » (stock réservé), le client paie sur la page sécurisée de Stripe (aucune donnée de carte ne passe par Tsing), puis la commande passe à « Payée » au retour sur le site (`/checkout/success`, le serveur interroge Stripe) **et** via le webhook `POST /api/payments/webhook/` (signature vérifiée). Sans paiement sous `PAYMENT_TIMEOUT_MINUTES` (30 min), la commande est annulée et le stock libéré (webhook `checkout.session.expired`, ou `python manage.py release_unpaid_orders` à planifier).

Webhook en local (facultatif) : [Stripe CLI](https://docs.stripe.com/stripe-cli) → `stripe listen --forward-to localhost:8001/api/payments/webhook/`, puis mettre le `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`.

### 3. Frontend

```bash
cd client
npm install
echo VITE_API_URL=http://localhost:8001 > .env.local   # URL du backend (par défaut : http://localhost:8000)
npm run dev
npm test        # tests du moteur du Studio (node --test, aucune dépendance)
```

## Studio (onglet du personnaliseur)

Génération de designs **100 % locale** (aucune API, aucun coût) : `client/src/studio/`.

- `engine.js` : demande en français → thème, style, couleurs, texte → 3 propositions en calques éditables ; slogans ; variantes de couleurs.
- `checker.js` : vérification avant impression (contraste WCAG sur le fond réel, taille des textes en cm, zone imprimable, chevauchements).
- `catalog.js` : thèmes, slogans, palettes, styles, zones imprimables (mesurées sur le modèle 3D).
- `motifs.js` : 30 illustrations vectorielles dessinées en code (montagnes, vague, fusée, manette, café…) et 5 effets (givré, rayons, usé vintage, néon, étincelles). Un calque `motif` ne stocke que le nom, 3 couleurs, les effets et une graine (« Redessiner ») : net à toute taille et modifiable dans l'onglet Calques. Les mots de la demande (« montagne givrée ») ou l'IA choisissent le motif. Aperçu de tous les motifs (dev) : `http://localhost:5173/motifs-preview.html?bg=111111&fx=frost`.
- `illustrations.js` : l'IA décrit le dessin voulu en mots-clés (« woman, silhouette ») ; on cherche l'illustration la plus proche parmi nos motifs, ≈ 4 100 silhouettes de [game-icons.net](https://game-icons.net) (CC BY 3.0, source citée sous les propositions) et ≈ 7 600 icônes [Material Design Icons](https://pictogrammers.com) (Apache 2.0). Bibliothèques chargées à la demande ; le tracé retenu est copié dans le calque (le t-shirt s'affiche ensuite sans elles).
- Bordures du t-shirt (col, manches, bas ; uni, liseré deux tons ou rayures sport) : calque `trim`, réglable dans l'onglet Image ou Calques, ou demandé dans la phrase (« liseré rouge au col et au bas »). Géométrie tirée du modèle 3D par `node scripts/extract-trims.mjs` (à relancer si `public/shirt.gltf` change).
- Mise en page « Écusson » (style vintage / percutant) : anneau, motif au centre, texte courbé en haut et en bas (calque texte avec `arc`).

### IA locale (facultative) : `client/src/ai/`

Un petit modèle de langage (Qwen3.5 2B, licence Apache 2.0) tourne **dans le navigateur** via WebLLM et WebGPU : aucune clé, aucun serveur, aucune donnée envoyée.

- Activation depuis l'onglet Studio. Le premier lancement télécharge le modèle une seule fois (environ 1 Go, ensuite en cache) ; il faut Chrome ou Edge récent avec WebGPU et environ 2,2 Go de mémoire graphique.
- **Modèle inclus dans le projet** : `cd client && npm run ai:download` copie une fois le modèle (≈ 1 Go, reprise possible) dans `client/public/models/` (ignoré par Git). Le site le sert alors lui-même : plus de téléchargement depuis Hugging Face, activation en moins d'une minute. Sans cette copie, le modèle est pris sur Hugging Face. Le build ne copie pas ce dossier (`AI_BUNDLE=1 npm run build` pour l'inclure).
- Plus tard, en production : faire tourner le modèle sur le serveur (Ollama ou llama.cpp) pour que les visiteurs n'aient rien à télécharger.
- `brief.js` : le modèle ne dessine rien, il répond par un court « brief » JSON (thème, style, couleurs, 3 slogans) contraint par un schéma ; la sortie est filtrée (écriture latine, mots déplacés, longueur).
- `fromBrief.js` : le brief passe par le même moteur que le générateur (`buildPalette`, `buildLayers`), donc mêmes garanties de contraste et de zone. Ce que l'utilisateur écrit explicitement (texte entre guillemets, couleurs, style, « dans le dos ») prime sur le modèle.
- `localAI.js` : chargement dans un Web Worker, délai maximal, annulation, libération de la mémoire, suppression du cache. En cas d'échec, le générateur par mots-clés prend le relais.
- `client/ai-bench.html` : page de mesure des modèles (développement).

## Rôles

- **Designer** : crée, modifie et supprime ses t-shirts (`/customizer`, `/archive`), et voit ses ventes.
- **Client** : achète des t-shirts (`/ecommerce`, `/checkout`) et suit ses commandes.

## API principale

| Méthode | URL | Accès |
|---|---|---|
| POST | `/api/register/` | public (`email`, `name`, `password`, `role`) |
| POST | `/api/token/`, `/api/token/refresh/` | public (`username` = email) |
| GET | `/api/me/` | connecté |
| GET | `/api/shirts/?search=&mine=1` | public |
| POST/PATCH/DELETE | `/api/shirts/…` | designer propriétaire |
| GET/POST | `/api/orders/` | connecté (ses propres commandes) |
| GET | `/api/orders/sales/` | designer |

## Limites connues

- Paiement : simulé (la commande est marquée « Payée »). À remplacer par Stripe Checkout côté serveur.
- Messagerie client ↔ designer (`/messages`) : bouton « Contacter » sur les t-shirts et la page Designers, design joint aux messages, non lus dans l'en-tête et les tableaux de bord. API `/api/conversations/` (chacun ne voit que ses conversations, 30 messages/min max). Pas de serveur temps réel : le navigateur vérifie les nouveaux messages toutes les 4 s dans une conversation ouverte, 10 s pour la liste, 30 s pour le badge — uniquement quand l'onglet est visible.
# Tsing
