# Déploiement de Tsing sur le serveur (Contabo « neva »)

Architecture (Docker Compose) :

```
Internet ──HTTPS──► Caddy (web) ──/api, /admin──► Django + Gunicorn (backend) ──► PostgreSQL (db)
                     │  site React, /media, /static           │
                     │                                         └──► Ollama (conteneur existant, réseau « tsing-ai »)
```

- **Ollama n'est pas modifié** et reste invisible depuis Internet : seul Django l'appelle, par le réseau Docker interne.
- Modèle utilisé : `qwen3:4b` (secours : `llama3.2:3b`). Sans carte graphique, compter 20 à 40 s par demande.
- Le modèle IA « navigateur » (1 Go) n'est pas déployé : le Studio utilise l'IA du serveur.

## 0. Prérequis (une fois)

```bash
docker --version && docker compose version     # Docker + plugin Compose
sudo ss -tlnp | grep -E ':80 |:443 '            # 80/443 libres ? (sinon : voir « Ports déjà pris »)
docker ps --format '{{.Names}}' | grep ollama   # nom du conteneur Ollama (ici : ollama)
```

Pare-feu (si `ufw` est utilisé) : `sudo ufw allow 80,443/tcp` (SSH reste ouvert).

## 1. Récupérer le code

```bash
git clone git@github.com:<compte>/tsing.git ~/tsing && cd ~/tsing
```

## 2. Configuration

```bash
cp deploy/.env.example deploy/.env
nano deploy/.env        # SITE_ADDRESS, DJANGO_SECRET_KEY, POSTGRES_PASSWORD, STRIPE_SECRET_KEY…
chmod 600 deploy/.env
```

Sans nom de domaine : `SITE_ADDRESS=tsing.75.119.136.160.sslip.io` (adresse gratuite qui pointe vers l'IP du
serveur ; Caddy obtient le certificat HTTPS automatiquement). Si le certificat est refusé (quota du service),
créer un sous-domaine gratuit sur [duckdns.org](https://www.duckdns.org) et l'utiliser à la place.

## 3. Relier Ollama au réseau de Tsing (une fois)

```bash
docker network create tsing-ai
docker network connect tsing-ai ollama
```

(Si le conteneur Ollama est recréé un jour, relancer la seconde commande.)

## 4. Lancer

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.yml --env-file deploy/.env logs -f --tail=50
```

Premier compte administrateur et données de démonstration (facultatif) :

```bash
docker compose -f deploy/docker-compose.yml exec backend python manage.py createsuperuser
docker compose -f deploy/docker-compose.yml exec backend python manage.py seed_demo
```

Vérifications :

```bash
curl -s https://<SITE_ADDRESS>/api/ai/config/        # {"enabled": true, "model": "qwen3:4b"}
curl -s https://<SITE_ADDRESS>/api/payments/config/  # {"mode": "stripe", "test_mode": true, ...}
```

## 5. Stripe

Tableau de bord Stripe → *Développeurs → Webhooks → Ajouter un endpoint* :
`https://<SITE_ADDRESS>/api/payments/webhook/`, événements `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
Copier le secret `whsec_…` dans `STRIPE_WEBHOOK_SECRET`, puis relancer : `… up -d`.

## 6. Tâches planifiées (`crontab -e`)

```cron
# Commandes non payées : stock remis en vente (toutes les 10 min)
*/10 * * * * cd ~/tsing && docker compose -f deploy/docker-compose.yml exec -T backend python manage.py release_unpaid_orders >/dev/null 2>&1
# Sauvegarde quotidienne de la base (gardée 14 jours)
30 3 * * * cd ~/tsing && mkdir -p ~/backups && docker compose -f deploy/docker-compose.yml exec -T db pg_dump -U tsing tsing | gzip > ~/backups/tsing-$(date +\%F).sql.gz && find ~/backups -name 'tsing-*.sql.gz' -mtime +14 -delete
```

## Mise à jour

```bash
cd ~/tsing && git pull && docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

## Ports déjà pris (autre application sur le serveur)

Si un autre serveur web occupe 80/443 : mettre `HTTP_PORT=8080` et `HTTPS_PORT=8443` dans `deploy/.env`, mettre
`SITE_ADDRESS=:80` (Caddy sans HTTPS) et faire relayer le domaine de Tsing par le serveur web existant
(ex. Nginx : `proxy_pass http://127.0.0.1:8080;` avec l'en-tête `X-Forwarded-Proto`).
