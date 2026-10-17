#!/bin/sh
# Runs as root so it can hand a fresh data volume to the unprivileged user,
# then drops privileges before touching the database or starting the server.
set -eu

mkdir -p /data/uploads
chown -R nextjs:nodejs /data

cd /app

echo "[libra] Applying database migrations."
setpriv --reuid=nextjs --regid=nodejs --init-groups \
  node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy

# The seed only fills an empty database, and it refuses to run in production
# unless LIBRA_ALLOW_SEED=1. Set LIBRA_SEED=0 to start with an empty library.
if [ "${LIBRA_SEED:-0}" = "1" ]; then
  echo "[libra] Adding the sample library if the database is empty."
  setpriv --reuid=nextjs --regid=nodejs --init-groups \
    env LIBRA_ALLOW_SEED=1 \
    node /opt/prisma-cli/node_modules/tsx/dist/cli.mjs prisma/seed.ts
fi

echo "[libra] Starting on port ${PORT:-3000}."
exec setpriv --reuid=nextjs --regid=nodejs --init-groups \
  node /app/node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port "${PORT:-3000}"
