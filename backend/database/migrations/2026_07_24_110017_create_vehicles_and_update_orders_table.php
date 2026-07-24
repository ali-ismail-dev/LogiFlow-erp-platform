<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Creates the fleet vehicle registry table
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('license_plate', 50);
            // The mathematical carrying capacity ceiling for cargo bundling calculations
            $table->decimal('max_weight_capacity_kg', 10, 2);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->index(['tenant_id', 'id']);
            $table->index(['tenant_id', 'is_active']);
        });

        // Enhances orders with mathematical sorting vectors
        Schema::table('orders', function (Blueprint $table) {
            $table->timestampTz('delivery_window_start')->nullable();
            $table->timestampTz('delivery_window_end')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['delivery_window_start', 'delivery_window_end']);
        });
        Schema::dropIfExists('vehicles');
    }
};
