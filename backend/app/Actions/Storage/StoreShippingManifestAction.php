<?php

declare(strict_types=1);

namespace App\Actions\Storage;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Stores an uploaded shipping manifest (or parcel signature capture)
 * onto the cloud-native 's3' filesystem disk.
 *
 * Design boundaries:
 *  - MIME/extension/size validation and tenant-ownership authorization
 *    of the dispatch trip are assumed to have ALREADY happened
 *    upstream (a FormRequest with mimes:pdf,jpg,png|max:... plus a
 *    policy check). This action's single responsibility is safe,
 *    streaming, non-guessable persistence — not "is this upload
 *    acceptable."
 *  - Zero local disk paths, anywhere. 100% disk-driver agnostic: in
 *    local/staging this resolves to the MinIO container, in
 *    production to AWS S3 (or any other S3-compatible provider) —
 *    purely via config/filesystems.php + .env, zero code changes to
 *    move environments.
 *  - Retries/backoff for transient storage failures are NOT handled
 *    here. If this action is invoked from a queued job, let that
 *    job's own #[Tries]/#[Backoff] contract own that concern (see
 *    ProcessAutomatedAccountingLedger for the pattern).
 */
class StoreShippingManifestAction
{
    /** Logical disk name only — never a local path. */
    private const string DISK = 's3';

    private const string VISIBILITY = 'private';

    public function __invoke(UploadedFile $file, string $tenantId, int $dispatchTripId): string
    {
        return $this->handle($file, $tenantId, $dispatchTripId);
    }

    /**
     * Stream the uploaded manifest onto the s3 disk and return the
     * resulting storage key, suitable for persisting onto a
     * dispatch_trips.manifest_path column.
     *
     * @throws RuntimeException if the upload is corrupt/incomplete,
     *                           or the disk write itself fails.
     */
    public function handle(UploadedFile $file, string $tenantId, int $dispatchTripId): string
    {
        if (! $file->isValid()) {
            throw new RuntimeException(sprintf(
                'Rejected shipping manifest upload for dispatch trip #%d: %s',
                $dispatchTripId,
                $file->getErrorMessage(),
            ));
        }

        $directory = $this->buildManifestDirectory($tenantId, $dispatchTripId);
        $filename = $this->buildManifestFilename($file);

        // putFileAs() streams directly from the temp upload location
        // into the Flysystem adapter for the 's3' disk — contents are
        // never fully buffered into PHP process memory, which matters
        // since manifests can be multi-page, multi-MB scanned PDFs.
        $storedPath = Storage::disk(self::DISK)->putFileAs(
            $directory,
            $file,
            $filename,
            ['visibility' => self::VISIBILITY],
        );

        // The 's3' disk's `throw` config option controls whether a
        // failure surfaces as a thrown exception or a `false` return.
        // This normalizes both signaling styles into one "always
        // throws on failure" contract for callers, regardless of how
        // config/filesystems.php has `throw` set for this disk.
        if ($storedPath === false) {
            throw new RuntimeException(sprintf(
                'Failed to stream shipping manifest to disk [%s] for dispatch trip #%d.',
                self::DISK,
                $dispatchTripId,
            ));
        }

        return $storedPath;
    }

    /**
     * Tenant-first, trip-scoped object prefix. Built entirely from
     * server-trusted identifiers — never user input — so there's no
     * directory-traversal surface, and the bucket stays naturally
     * partitioned per tenant for later S3 prefix IAM/lifecycle rules.
     */
    private function buildManifestDirectory(string $tenantId, int $dispatchTripId): string
    {
        return sprintf('tenants/%s/dispatch-trips/%d/manifests', $tenantId, $dispatchTripId);
    }

    /**
     * Fully server-generated filename. The client's original filename
     * is never used as-is — only its content-sniffed extension is
     * preserved, for readability when a human browses the bucket.
     */
    private function buildManifestFilename(UploadedFile $file): string
    {
        return sprintf('%s.%s', (string) Str::uuid(), $this->sanitizeExtension($file));
    }

    private function sanitizeExtension(UploadedFile $file): string
    {
        // Prefer the extension guessed from the file's actual MIME
        // signature over the client-supplied original extension — a
        // spoofed "invoice.pdf" that is secretly something else should
        // never round-trip its claimed extension untouched.
        $extension = $file->extension() ?: $file->getClientOriginalExtension() ?: 'bin';
        $extension = strtolower((string) preg_replace('/[^a-z0-9]/i', '', $extension));

        return $extension !== '' ? $extension : 'bin';
    }
}
