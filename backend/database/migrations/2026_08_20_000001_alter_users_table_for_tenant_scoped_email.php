<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasIndex('users', 'users_email_unique')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropUnique('users_email_unique');
            });
        }

        if (!Schema::hasIndex('users', 'users_tenant_id_email_unique')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->unique(['tenant_id', 'email']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasIndex('users', 'users_tenant_id_email_unique')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropUnique('users_tenant_id_email_unique');
            });
        }

        if (!Schema::hasIndex('users', 'users_email_unique')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->unique('email');
            });
        }
    }
};
