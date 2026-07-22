<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stops', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dispatch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sequence');
            $table->jsonb('destination_address');
            $table->string('status')->default('pending');
            $table->timestampTz('eta')->nullable();
            $table->timestampTz('arrived_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestampsTz();

            $table->unique(['tenant_id', 'dispatch_id', 'order_id']);
            $table->index(['tenant_id', 'id']);
            $table->index(['tenant_id', 'dispatch_id', 'sequence']);
            $table->index(['tenant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stops');
    }
};
