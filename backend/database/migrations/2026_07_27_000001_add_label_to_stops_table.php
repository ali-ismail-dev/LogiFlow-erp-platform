<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add the human-readable display label to stops.
     *
     * The label is a short, operational display name for a stop that is used
     * in real-time broadcast payloads (e.g. "Warehouse B Dropoff") without
     * requiring the client to reconstruct it from the destination address.
     */
    public function up(): void
    {
        Schema::table('stops', function (Blueprint $table): void {
            $table->string('label', 200)->nullable()->after('destination_address');
        });
    }

    public function down(): void
    {
        Schema::table('stops', function (Blueprint $table): void {
            $table->dropColumn('label');
        });
    }
};
