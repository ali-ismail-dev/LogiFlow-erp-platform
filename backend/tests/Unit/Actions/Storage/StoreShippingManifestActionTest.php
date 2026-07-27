<?php

declare(strict_types=1);

namespace Tests\Unit\Actions\Storage;

use App\Actions\Storage\StoreShippingManifestAction;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StoreShippingManifestActionTest extends TestCase
{
    private StoreShippingManifestAction $action;

    protected function setUp(): void
    {
        parent::setUp();
        $this->action = new StoreShippingManifestAction();

        // Fake the 's3' disk to intercept Flysystem calls
        Storage::fake('s3');
    }

    #[Test]
    public function it_successfully_streams_and_stores_valid_pdf_manifest(): void
    {
        $file = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');
        $tenantId = 'tenant_xyz';
        $dispatchTripId = 42;

        $storedPath = $this->action->handle($file, $tenantId, $dispatchTripId);

        // Assert path is built correctly following the tenant-first directory spec
        $this->assertStringStartsWith("tenants/{$tenantId}/dispatch-trips/{$dispatchTripId}/manifests/", $storedPath);
        $this->assertStringEndsWith('.pdf', $storedPath);

        // Assert file exists on the faked 's3' disk with private visibility
        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk('s3');
        $disk->assertExists($storedPath);
        $this->assertEquals('private', $disk->getVisibility($storedPath));
    }

    #[Test]
    public function it_successfully_stores_jpg_image_manifest(): void
    {
        $file = UploadedFile::fake()->create('signature.jpg', 100, 'image/jpeg');
        $tenantId = 'tenant_abc';
        $dispatchTripId = 101;

        $storedPath = $this->action->handle($file, $tenantId, $dispatchTripId);

        $this->assertStringStartsWith("tenants/{$tenantId}/dispatch-trips/{$dispatchTripId}/manifests/", $storedPath);
        $this->assertStringEndsWith('.jpg', $storedPath);
        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk('s3');
        $disk->assertExists($storedPath);
    }

    #[Test]
    public function it_throws_exception_if_uploaded_file_is_invalid(): void
    {
        // Create an explicitly invalid/error upload (e.g., UPLOAD_ERR_PARTIAL)
        $file = UploadedFile::fake()->create('corrupt.pdf', 100, 'application/pdf');

        // Use reflection or error state injection if possible, or mock the UploadedFile isValid method
        $invalidFile = new class('corrupt.pdf', 'corrupt.pdf', 'application/pdf', UPLOAD_ERR_PARTIAL, true) extends UploadedFile {
            public function isValid(): bool
            {
                return false;
            }
            public function getErrorMessage(): string
            {
                return 'The uploaded file was only partially uploaded.';
            }
        };

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Rejected shipping manifest upload for dispatch trip #99: The uploaded file was only partially uploaded.');

        $this->action->handle($invalidFile, 'tenant_123', 99);
    }

    #[Test]
    public function it_throws_exception_for_unsupported_file_extensions(): void
    {
        // Create a file with a forbidden extension/mime type (e.g., .exe)
        $file = UploadedFile::fake()->create('malware.exe', 50, 'application/x-msdownload');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Unsupported shipping manifest format: exe');

        $this->action->handle($file, 'tenant_123', 55);
    }

    #[Test]
    public function it_throws_exception_if_disk_storage_write_fails(): void
    {
        // Mock Storage facade to return false on putFileAs to simulate write failures
        Storage::shouldReceive('disk')
            ->with('s3')
            ->andReturnSelf();

        Storage::shouldReceive('putFileAs')
            ->andReturn(false);

        $file = UploadedFile::fake()->create('manifest.pdf', 100, 'application/pdf');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Failed to stream shipping manifest to disk [s3] for dispatch trip #77.');

        $this->action->handle($file, 'tenant_123', 77);
    }
}
