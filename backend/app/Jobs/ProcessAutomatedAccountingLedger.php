<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\DispatchTrip;
use App\Services\Accounting\LedgerGenerator;
use App\Support\Tenancy\TenantManager;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Attributes\Backoff;
use Illuminate\Queue\Attributes\Timeout;
use Illuminate\Queue\Attributes\Tries;
use Illuminate\Queue\Attributes\UniqueFor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Parses a completed dispatch trip and posts its financial ledger
 * entries, entirely off the Redis 'accounting-ledger' queue so a slow
 * or unavailable downstream accounting system can never stall the
 * HTTP request/response cycle.
 *
 * NAMESPACE NOTE: App\Services\Accounting\LedgerGenerator and
 * App\Support\Tenancy\TenantManager stand in for wherever your actual
 * Phase 2 tenant manager and ledger-generation domain service live —
 * adjust these `use` paths to match your real classes.
 */
#[Tries(3)]
#[Backoff([60, 300, 900])]
#[Timeout(120)]
// No #[FailOnTimeout]: a timeout mid accounting-system-outage should
// retry through this same 60/300/900 backoff like any other failure,
// not fail-fast past it.
#[UniqueFor(3600)] // comfortably above sum(backoff) + tries*timeout = 1,620s
class ProcessAutomatedAccountingLedger implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    public function __construct(
        /**
         * Captured explicitly at dispatch time. A queue worker is a
         * long-lived CLI process with no HTTP Request to resolve a
         * subdomain/tenant from, so tenant identity has to travel on
         * the job payload itself.
         */
        public readonly string $tenantId,

        /**
         * An ID, not a hydrated DispatchTrip model — deliberately.
         * Laravel automatically re-fetches a model constructor
         * argument from the database the moment the job is
         * deserialized, which happens BEFORE handle() below gets a
         * chance to run and register tenant context. Against a
         * fail-closed TenantScope, that re-fetch would run with no
         * tenant bound yet, resolving to a ModelNotFoundException or
         * a silently wrong boundary. Passing the raw ID sidesteps
         * this entirely: the model is only ever queried after tenant
         * context is set, below.
         */
        public readonly int $dispatchTripId,
    ) {
        $this->onQueue('accounting-ledger');
    }

    /**
     * Guards against a second identical ledger job for the same trip
     * being queued while this one is still mid-flight across its own
     * retry/backoff window — the concrete defense against two workers
     * racing to lockForUpdate() the same row. Backed by the Redis
     * cache store, so the check itself is a cheap atomic lock, not a
     * DB round-trip.
     */
    public function uniqueId(): string
    {
        return "ledger:{$this->tenantId}:{$this->dispatchTripId}";
    }

    public function handle(TenantManager $tenantManager, LedgerGenerator $ledgerGenerator): void
    {
        // Tenant context MUST be registered before anything below,
        // including the very first Eloquent query — this is what lets
        // the Phase 2 TenantScope guard this job's DB access exactly
        // as it would guard a request-scoped controller.
        $tenantManager->setTenantId($this->tenantId);

        try {
            DB::transaction(function () use ($ledgerGenerator): void {
                $trip = DispatchTrip::query()
                    ->whereKey($this->dispatchTripId)
                    ->lockForUpdate()
                    ->firstOrFail();

                // Ledger line-item generation is a distinct domain
                // concern living outside this job — this job is a
                // thin, retry-aware orchestration shell around it,
                // not the accounting logic itself.
                $ledgerGenerator->generateForTrip($trip);

                $trip->update(['ledger_status' => 'posted']);
            });
        } finally {
            // Queue workers are long-lived processes that immediately
            // pick up the next job — possibly for a different tenant
            // — on the same PHP process, so context must never leak
            // past this job's own execution, success or failure.
            $tenantManager->clear();
        }
    }

    /**
     * DLQ containment boundary. Fires once #[Tries(3)] is fully
     * exhausted (i.e. only after the attempt following the final
     * 900s backoff also fails), or on a non-retryable exception.
     * $exception may be null, or an Illuminate\Queue\
     * MaxAttemptsExceededException / TimeoutExceededException rather
     * than a "real" business exception, if the job failed by
     * exhausting attempts/timeout rather than throwing — every branch
     * below degrades gracefully either way.
     */
    public function failed(?Throwable $exception): void
    {
        // failed() runs against a freshly re-hydrated job instance and
        // does not support handle()-style method injection, so
        // dependencies are resolved explicitly from the container.
        $tenantManager = app(TenantManager::class);
        $tenantManager->setTenantId($this->tenantId);

        try {
            // Full detail goes to a dedicated 'dlq' log channel —
            // configure its handler to forward to your alerting
            // pipeline (Slack / PagerDuty / Sentry) so an exhausted
            // job pages someone rather than sitting quietly in a file.
            Log::channel('dlq')->critical('Accounting ledger job exhausted all retries', [
                'job' => self::class,
                'tenant_id' => $this->tenantId,
                'dispatch_trip_id' => $this->dispatchTripId,
                'attempts' => $this->attempts(),
                'exception_class' => $exception ? $exception::class : null,
                'exception_message' => $exception?->getMessage() ?? 'No exception instance was provided.',
                'trace' => $exception?->getTraceAsString(),
            ]);

            // dispatch_trips.ledger_error MUST be TEXT/LONGTEXT, not
            // VARCHAR(255) — truncating this is exactly the
            // "unmitigated backoff data truncation" failure mode this
            // hook exists to avoid.
            DispatchTrip::query()
                ->whereKey($this->dispatchTripId)
                ->update([
                    'ledger_status' => 'exception',
                    'ledger_error' => $exception?->getMessage() ?? 'Job failed with no exception instance.',
                    'ledger_failed_at' => now(),
                ]);
        } finally {
            $tenantManager->clear();
        }
    }

    /**
     * Horizon dashboard tagging (no-op if Horizon isn't installed) —
     * lets ops filter "all ledger jobs for tenant X" or "everything
     * touching trip #123" during an incident.
     */
    public function tags(): array
    {
        return [
            'ledger',
            "tenant:{$this->tenantId}",
            "trip:{$this->dispatchTripId}",
        ];
    }
}
