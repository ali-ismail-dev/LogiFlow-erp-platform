#!/bin/sh
# Runs once per container start. db/redis/minio are already confirmed
# healthy by the time this fires (docker-compose's depends_on/condition
# handles that) — no wait-for-it polling needed here.
set -e

# Self-heal storage + bootstrap/cache ownership so the PHP-FPM www-data user can
# write compiled Blade views, sessions, package manifests, etc. On Docker Desktop
# (Windows/Mac), bind-mounted files are created as root on first sync, which makes
# storage/framework and bootstrap/cache unwritable to www-data and breaks the /up
# healthcheck + view compilation. Re-applied on every boot.
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

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