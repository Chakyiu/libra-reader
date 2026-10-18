# Production image for Libra Reader.
# The runtime uses production dependencies rather than Next's standalone trace:
# article extraction and the sample seed need packages (jsdom and its parser)
# that the tracer ships incomplete.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# npm gives up on a single reset. Retry instead, and keep the download cache in
# a BuildKit cache mount (see the stages below) so a retry reuses what landed.
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=10000 \
    npm_config_fetch_retry_maxtimeout=120000

# --- full install, used only to build ---
FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# The project's postinstall runs `prisma generate`, so this stage needs the
# schema. Only the schema: copying all of prisma/ would tie the install below to
# every new migration and seed edit, and make each one re-download the tree.
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma.config.ts ./
COPY scripts/copy-pdf-worker.mjs ./scripts/copy-pdf-worker.mjs
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Both are produced by postinstall and kept out of the build context, so
# recreate them here from the dependencies copied above.
ENV DATABASE_URL=file:/tmp/libra-build.db
ENV LIBRA_STORAGE_DIR=/tmp/uploads
RUN --mount=type=cache,target=/app/.next/cache npx prisma generate \
  && node scripts/copy-pdf-worker.mjs \
  && npm run build

# Production dependencies, with better-sqlite3 compiled for this image.
FROM base AS prod-deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# The project postinstall needs the Prisma CLI, which is a dev dependency.
# Compile the native addon explicitly instead.
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts \
  && npm rebuild better-sqlite3 \
  && node -e "require('better-sqlite3')"

# Prisma CLI and tsx, with the Linux schema engine, for startup migrations
# and the optional sample seed.
FROM base AS prisma-cli
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/prisma-cli
RUN --mount=type=cache,target=/root/.npm npm init -y \
  && npm install --no-package-lock --no-save prisma@7.10.1 tsx@4.23.15

# --- runtime ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/data/libra.db
ENV LIBRA_STORAGE_DIR=/data/uploads
ENV PRISMA_TELEMETRY_DISABLED=1
ENV CHECKPOINT_DISABLE=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl tzdata \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --home /home/nextjs --create-home nextjs

COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=prisma-cli --chown=nextjs:nodejs /opt/prisma-cli /opt/prisma-cli
COPY --chown=nextjs:nodejs docker/entrypoint.sh /entrypoint.sh

# `prisma.config.ts` imports "prisma/config", resolved from the app directory.
# Ownership is set on copy: a later chown would store a second copy of every file.
RUN ln -s /opt/prisma-cli/node_modules/prisma ./node_modules/prisma \
  && chmod 755 /entrypoint.sh \
  && mkdir -p /data/uploads \
  && chown nextjs:nodejs /data /data/uploads

EXPOSE 3000
VOLUME ["/data"]
ENTRYPOINT ["/entrypoint.sh"]
