# Site React compilé, servi par Caddy (HTTPS automatique) qui relaie /api vers Django.
FROM node:20-alpine AS build
WORKDIR /app
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ .
# API à la même adresse que le site (pas de CORS) ; le modèle IA du navigateur n'est pas embarqué.
ENV VITE_API_URL=""
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv/www
