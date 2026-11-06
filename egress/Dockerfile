FROM node:22-bookworm-slim
WORKDIR /app
COPY shared/policy.mjs ./policy.mjs
COPY egress/proxy.mjs ./proxy.mjs
ENV NODE_ENV=production
EXPOSE 3128
CMD ["node", "proxy.mjs"]
