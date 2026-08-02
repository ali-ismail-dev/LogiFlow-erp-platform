<?php

declare(strict_types=1);

namespace App\Events;

use App\Models\Dispatch;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DispatchMovementUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly Dispatch $dispatch,
    ) {}

    /**
     * The channel(s) this event broadcasts on.
     *
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('tenant.' . $this->dispatch->tenant_id . '.ops'),
        ];
    }

    /**
     * Override the wire event name.
     */
    public function broadcastAs(): string
    {
        return 'dispatch.movement.updated';
    }

    /**
     * Resolve a status value to its wire-safe string representation.
     */
    private static function statusToString(mixed $status): ?string
    {
        if ($status === null) {
            return null;
        }

        if ($status instanceof \BackedEnum) {
            return (string) $status->value;
        }

        return (string) $status;
    }

    /**
     * The payload actually placed on the wire.
     * 
     * FIXED: Aligned all wire array property keys to perfectly match our 
     * true database schema architecture fields and frontend layout expectations.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        // Safely extract relational entities or fallback gracefully
        $stop = $this->dispatch->currentStop;
        $warehouse = $this->dispatch->warehouse;

        return [
            'id' => $this->dispatch->id,
            'tenant_id' => $this->dispatch->tenant_id,
            'status' => self::statusToString($this->dispatch->status),

            // FIXED: Swapped legacy reference_number key match down to valid reference_code column
            'reference_code' => $this->dispatch->reference_code,

            // FIXED: Added missing vehicle identifier property map to prevent frontend fallback drops
            'vehicle_identifier' => $this->dispatch->vehicle_identifier,

            // FIXED: Added missing driver name flat fallback parameter tracking
            'driver_name' => $this->dispatch->driver_name,

            'current_stop' => $stop ? [
                'id' => $stop->id,
                'sequence' => $stop->sequence,
                'label' => $stop->label,
                'status' => self::statusToString($stop->status),
                'eta' => optional($stop->eta)->toIso8601String(),
            ] : null,

            // FIXED: Added structured warehouse relationship payload parameters mapping natively
            'warehouse' => $warehouse ? [
                'id' => $warehouse->id,
                'name' => $warehouse->name,
                'code' => $warehouse->code,
                'timezone' => $warehouse->timezone ?? 'UTC',
            ] : null,

            'updated_at' => optional($this->dispatch->updated_at)->toIso8601String(),
        ];
    }
}
