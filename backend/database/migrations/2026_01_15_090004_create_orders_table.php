<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->string('order_number');
            $table->string('customer_name');
            $table->jsonb('shipping_address');
            $table->string('status')->default('pending');
            $table->decimal('total_weight_kg', 10, 2)->default(0);
            $table->timestampTz('promised_at')->nullable();
            $table->timestampsTz();

            $table->unique(['tenant_id', 'order_number']);
            $table->index(['tenant_id', 'id']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'warehouse_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
