<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatches', function (Blueprint $table) {
            // Adds the cloud manifest string pointer column
            $table->string('manifest_path')->nullable();

            // Background Redis accounting metrics and error trace tracking fields
            $table->string('ledger_status')->default('none'); // 'none' | 'queued' | 'posted' | 'exception'
            $table->text('ledger_error')->nullable(); // Using explicit TEXT to avoid VARCHAR truncation crashes
            $table->timestampTz('ledger_failed_at')->nullable();

            // Carrier webhook correlation / matching field for inbound tracking updates
            $table->string('carrier_waybill_reference')->nullable()->unique();
        });
    }

    public function down(): void
    {
        Schema::table('dispatches', function (Blueprint $table) {
            $table->dropColumn(['manifest_path', 'ledger_status', 'ledger_error', 'ledger_failed_at', 'carrier_waybill_reference']);
        });
    }
};
