# Proveedor OIDC de CeBasic = código de cebasicapi-node (rama feat/oidc-login).
# deploy.sh copia el código a ./oidc/app con `git archive` antes de construir.
FROM docker.io/library/node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY app/ ./
USER node
EXPOSE 3000
CMD ["node", "index.js"]
