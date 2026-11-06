FROM node:22-bookworm-slim
WORKDIR /app
COPY shared /app/shared
COPY fixtures /app/fixtures
ENV NODE_ENV=production
EXPOSE 80
CMD ["node", "/app/fixtures/server.mjs"]
