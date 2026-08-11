<?php

/*
|--------------------------------------------------------------------------
| PHPUnit Bootstrap
|--------------------------------------------------------------------------
|
| This file runs at the very start of every PHPUnit process, BEFORE any
| test class is loaded and BEFORE the Laravel application boots.
|
| PROBLEM IT SOLVES:
| The docker-compose stack injects real infra env vars (DB_CONNECTION=pgsql,
| DB_DATABASE=logiflow_core, CACHE_STORE=redis, SESSION_DRIVER=redis, etc.)
| into the backend container's process environment. PHP exposes those as
| $_SERVER entries. Laravel's Dotenv repository reads $_SERVER BEFORE $_ENV,
| so env('DB_CONNECTION') would return the live "pgsql" value and
| RefreshDatabase's migrate:fresh would wipe the real database.
|
| PHPUnit's <env force="true"> overrides in phpunit.xml DO write to
| putenv() and $_ENV, but they do NOT touch $_SERVER. So without this
| bootstrap, the live $_SERVER values win and the force="true" SQLite
| overrides are silently ignored.
|
| FIX:
| 1. Strip the live infra variables out of $_SERVER (the source Laravel
|    reads first, and the one PHPUnit cannot override).
| 2. Re-establish the safe test values in $_ENV + putenv so Laravel's
|    env() falls through to the SQLite/array/sync overrides regardless of
|    whether PHPUnit's PhpHandler has already run.
|
| IMPORTANT: This must remain the FIRST thing that happens. vendor/autoload.php
| is only required AFTER the unsafe variables have been removed.
*/

$testEnvironment = [
    'DB_CONNECTION' => 'sqlite',
    'DB_DATABASE' => ':memory:',
    'DB_HOST' => '',
    'DB_PORT' => '',
    'DB_USERNAME' => '',
    'DB_PASSWORD' => '',
    'DB_URL' => '',
    'DB_SOCKET' => '',
    'CACHE_STORE' => 'array',
    'SESSION_DRIVER' => 'file',
    'QUEUE_CONNECTION' => 'sync',
    'BROADCAST_CONNECTION' => 'null',
    'MAIL_MAILER' => 'array',
    'REDIS_HOST' => '',
    'REDIS_PORT' => '',
    'REDIS_PASSWORD' => '',
];

// 1. Remove the live infra values that Laravel would otherwise read first.
foreach (array_keys($testEnvironment) as $key) {
    unset($_SERVER[$key], $_ENV[$key]);
    putenv($key);
}

// 2. Re-establish the isolated test values so env() resolves to SQLite.
foreach ($testEnvironment as $key => $value) {
    $_ENV[$key] = $value;
    putenv("{$key}={$value}");
}

require __DIR__ . '/../vendor/autoload.php';
