<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->string('sku');
            $table->string('name');
            $table->unsignedInteger('quantity_on_hand')->default(0);
            $table->unsignedInteger('quantity_reserved')->default(0);
            $table->string('status')->default('active');
            $table->decimal('unit_weight_kg', 8, 2)->nullable();
            $table->timestampsTz();

            $table->unique(['tenant_id', 'warehouse_id', 'sku']);
            $table->index(['tenant_id', 'id']);
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_items');
    }
};
