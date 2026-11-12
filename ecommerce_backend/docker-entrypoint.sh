#!/bin/sh
# Au démarrage : base à jour et fichiers statiques (admin) copiés, puis lancement de Gunicorn.
set -e
python manage.py migrate --noinput
python manage.py collectstatic --noinput >/dev/null
exec "$@"
