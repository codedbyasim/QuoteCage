FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci -w @quotecage/web
COPY shared ./shared
COPY apps/web ./apps/web
RUN npm run build -w @quotecage/web

FROM caddy:2-alpine
COPY deploy/Caddyfile.http /etc/caddy/Caddyfile.http
COPY deploy/caddy-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
COPY --from=build /app/apps/web/dist /srv
EXPOSE 80 443
ENTRYPOINT ["/entrypoint.sh"]
