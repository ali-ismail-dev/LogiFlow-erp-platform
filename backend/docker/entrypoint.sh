#!/bin/sh
# Runs once per container start. db/redis/minio are already confirmed
# healthy by the time this fires (docker-compose's depends_on/condition
# handles that) — no wait-for-it polling needed here.
set -e

if [ ! -f vendor/autoload.php ]; then
  echo "[entrypoint] vendor/ is empty (fresh volume) — running composer install..."
  composer install --no-interaction --prefer-dist
fi

if [ -z "$APP_KEY" ]; then
  echo "[entrypoint] WARNING: APP_KEY is not set. Encryption/session/cookie"
  echo "[entrypoint]          features will fail until you run:"
  echo "[entrypoint]            docker compose exec backend php artisan key:generate --show"
  echo "[entrypoint]          and set the result as APP_KEY in your .env file."
fi

exec "$@"