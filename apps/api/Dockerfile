FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci -w @quotecage/api
COPY shared ./shared
COPY apps/api ./apps/api
RUN npm run build -w @quotecage/api

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci -w @quotecage/api --omit=dev
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY shared ./shared
WORKDIR /app/apps/api
EXPOSE 8080
CMD ["node", "dist/index.js"]
