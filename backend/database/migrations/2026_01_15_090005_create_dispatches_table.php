<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->string('reference_code');
            $table->string('driver_name')->nullable();
            $table->string('vehicle_identifier')->nullable();
            $table->string('status')->default('planned');
            $table->timestampTz('scheduled_at')->nullable();
            $table->timestampTz('departed_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();

            $table->unique(['tenant_id', 'reference_code']);
            $table->index(['tenant_id', 'id']);
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatches');
    }
};
