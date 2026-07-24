<?php

namespace App\Events;

use App\Models\Dispatch;
use Illuminate\Broadcasting\Channel;
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
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('tenant.' . $this->dispatch->tenant_id . '.ops'),
        ];
    }

    /**
     * Override the wire event name. Without this, Laravel broadcasts the
     * fully-qualified class name (App\Events\DispatchMovementUpdated),
     * which forces every Echo `.listen()` call on the client to fight
     * namespace-prefixing rules. Naming it once, explicitly, keeps the
     * client-side contract simple and stable even if this class ever
     * gets renamed or moved to a different namespace.
     */
    public function broadcastAs(): string
    {
        return 'dispatch.movement.updated';
    }

    /**
     * The payload actually placed on the wire.
     *
     * Deliberately NOT `$this->dispatch->toArray()` and NOT
     * `(new DispatchResource($this->dispatch))->resolve()`.
     *
     * A broadcast is multicast to every subscriber on the tenant channel
     * at once, but a JsonResource's conditional fields (when() /
     * mergeWhen()) are evaluated against whatever request/user happens
     * to be bound in the container at the moment the event fires --
     * almost always the user who *triggered* the update (a dispatcher
     * clicking "mark in transit"), not the various users who will
     * *receive* it over the socket. Reusing the HTTP resource here would
     * silently leak or hide fields depending on whichever request
     * context happened to cause the broadcast, which is exactly the kind
     * of cross-user leak this phase is supposed to close off, not
     * introduce. An explicit, hand-picked map has no such ambiguity:
     * what's listed here is what every subscriber on the channel gets,
     * full stop.
     *
     * Keep the field names/casing here in lockstep with DispatchResource
     * (snake_case on the wire) so the frontend can share one TypeScript
     * type between the REST payload and the socket payload -- see
     * DispatchMovementPayload in useWebSockets.ts.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $stop = $this->dispatch->currentStop;
        $driver = $this->dispatch->driver;

        return [
            'id' => $this->dispatch->id,
            'tenant_id' => $this->dispatch->tenant_id,
            'status' => $this->dispatch->status,
            'reference_number' => $this->dispatch->reference_number,
            'current_stop' => $stop ? [
                'id' => $stop->id,
                'sequence' => $stop->sequence,
                'label' => $stop->label,
                'status' => $stop->status,
                'eta' => optional($stop->eta)->toIso8601String(),
            ] : null,
            'driver' => $driver ? [
                'id' => $driver->id,
                'name' => $driver->name,
            ] : null,
            'updated_at' => optional($this->dispatch->updated_at)->toIso8601String(),
        ];
    }
}
