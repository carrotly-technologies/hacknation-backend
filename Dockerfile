# syntax=docker/dockerfile:1

# ---- build ----
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:26-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
# `apk upgrade` pulls Alpine security fixes released after the base image.
# The app runs with plain `node`; npm, npx and corepack are not needed at
# runtime and their bundled packages carry CVEs (docs/security/podatnosci.md).
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# Database migrations, applied at startup when DATABASE_URL is set.
COPY --from=build --chown=node:node /app/drizzle ./drizzle
# Fonts embedded in the downloaded sheet PDF (Tinos, SIL OFL 1.1).
COPY --from=build --chown=node:node /app/assets ./assets
# Source documents, served by GET /api/docs/*.
COPY --from=build --chown=node:node /app/docs ./docs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "dist/main"]
