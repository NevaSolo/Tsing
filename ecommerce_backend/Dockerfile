# API Django (production) : Gunicorn derrière Caddy.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY requirements.txt .
# psycopg-binary embarque libpq : aucune bibliothèque système à installer.
RUN pip install -r requirements.txt

COPY . .
RUN chmod +x docker-entrypoint.sh && useradd --create-home tsing && mkdir -p /data/media /data/static && chown -R tsing /app /data
USER tsing

ENV DJANGO_DEBUG=false DB_ENGINE=postgres DJANGO_STATIC_ROOT=/data/static DJANGO_MEDIA_ROOT=/data/media
EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
# Threads : une demande à l'IA (plusieurs dizaines de secondes) ne bloque pas les autres visiteurs.
CMD ["gunicorn", "ecommerce_backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--threads", "4", "--timeout", "200", "--access-logfile", "-"]
