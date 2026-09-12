<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatches', function (Blueprint $table): void {
            $table->timestampTz('carrier_status_timestamp')->nullable()->after('carrier_waybill_reference');
        });

        Schema::create('carrier_webhook_events', function (Blueprint $table): void {
            $table->id();
            $table->string('carrier', 100);
            $table->string('event_id', 255);
            $table->foreignId('dispatch_id')->constrained()->cascadeOnDelete();
            $table->timestampTz('status_timestamp');
            $table->timestampTz('processed_at');

            $table->unique(['carrier', 'event_id']);
            $table->index(['dispatch_id', 'status_timestamp']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('carrier_webhook_events');

        Schema::table('dispatches', function (Blueprint $table): void {
            $table->dropColumn('carrier_status_timestamp');
        });
    }
};
