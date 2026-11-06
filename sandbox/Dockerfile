FROM mcr.microsoft.com/playwright:v1.65.0-noble
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY sandbox/package.json ./
RUN npm install --omit=dev
COPY sandbox/worker.mjs ./
COPY shared/policy.mjs ./policy.mjs
USER pwuser
CMD ["node", "worker.mjs"]
