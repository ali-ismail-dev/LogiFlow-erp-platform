<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * Create the application and immediately verify the test database
     * connection is SQLite before any test trait (RefreshDatabase) can run
     * `migrate:fresh` against a live database.
     *
     * Why this matters:
     * A stale config cache (bootstrap/cache/config.php) bakes in the live
     * connection values (e.g. pgsql / logiflow_core) and causes Laravel to
     * silently ignore the force="true" env overrides in phpunit.xml. The
     * RefreshDatabase trait would then drop and re-migrate the real database,
     * wiping production/dev data.
     *
     * refreshApplication() is called by setUpTheTestEnvironment() BEFORE
     * setUpTraits() runs, so failing this check throws before any database
     * migration can execute.
     */
    protected function refreshApplication(): void
    {
        parent::refreshApplication();

        if (config('database.default') !== 'sqlite') {
            throw new RuntimeException(
                'Refusing to run tests: default database connection is "'
                    . config('database.default')
                    . '" but tests must run against "sqlite". '
                    . 'A stale config cache (bootstrap/cache/config.php) may be present. '
                    . 'Run `php artisan config:clear` before running the test suite.'
            );
        }
    }
}
