# syntax=docker/dockerfile:1
#
# Multi-stage build so the SAME Dockerfile describes both the local dev
# container (source bind-mounted, composer runs at container start) and the
# production image (source copied in, deps locked at build time) — that's
# what "production parity" means in practice, not just matching versions.

ARG PHP_VERSION=8.4

FROM php:${PHP_VERSION}-fpm-alpine AS base

# System packages needed to compile the PHP extensions below
RUN apk add --no-cache \
    postgresql-dev \
    libzip-dev \
    icu-dev \
    oniguruma-dev \
    autoconf \
    g++ \
    make \
    linux-headers \
    git \
    curl \
    unzip

# Laravel 13 core requirements: Ctype, cURL, DOM, Fileinfo, Filter, Hash,
# Mbstring, OpenSSL, PCRE, PDO, Session, Tokenizer, XML are already present in
# the base php:8.4-fpm image; the ones below still need explicit compilation.
RUN docker-php-ext-install -j"$(nproc)" \
    pdo \
    pdo_pgsql \
    pgsql \
    mbstring \
    bcmath \
    zip \
    intl \
    opcache \
    pcntl \
    && pecl install redis \
    && docker-php-ext-enable redis

# Composer, copied from its official image rather than curl|bash'd in
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# -----------------------------------------------------------------------------
# development — this is the target docker-compose.yml builds. Source code is
# bind-mounted at runtime (see volumes: in compose), so nothing is COPY'd
# here; the entrypoint installs composer deps into the `backend-vendor`
# named volume on first start if they're missing.
# -----------------------------------------------------------------------------
FROM base AS development

# Xdebug — dev-only coverage/debug tool. Installed but NOT auto-enabled so
# normal requests stay fast; load it on demand with:
#   docker compose exec backend php -d zend_extension=/usr/local/lib/php/extensions/no-debug-non-zts-20240924/xdebug.so -d xdebug.mode=coverage artisan test --coverage --min=80
# (the extension directory is container-specific; use `php -i | grep extension_dir`
# or `find / -name xdebug.so` to locate the exact path on a different PHP version)
RUN pecl install xdebug

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 9000
ENTRYPOINT ["entrypoint.sh"]
CMD ["php-fpm"]

# -----------------------------------------------------------------------------
# production — code is copied in and locked at build time; no bind mount, no
# dev dependencies, runs as an unprivileged user.
# -----------------------------------------------------------------------------
FROM base AS production

COPY . .
RUN composer install --no-dev --optimize-autoloader --no-interaction \
    && chown -R www-data:www-data storage bootstrap/cache

# Deliberately NOT running `php artisan config:cache` / `route:cache` /
# `view:cache` here: those bake in whatever env vars exist at `docker build`
# time, which is BEFORE Compose/Kubernetes ever injects real secrets. Run
# them from a release-phase entrypoint or CI deploy step once the real
# environment is attached — caching them at build time silently locks in
# empty/wrong config.

USER www-data
EXPOSE 9000
CMD ["php-fpm"]