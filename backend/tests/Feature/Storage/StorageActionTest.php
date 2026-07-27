<?php

declare(strict_types=1);

namespace Tests\Feature\Storage;

use App\Actions\Storage\StoreShippingManifestAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\TestCase;

class StorageActionTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_streams_a_manifest_file_to_the_s3_disk_without_using_local_paths(): void
    {
        Storage::fake('s3');

        $file = UploadedFile::fake()->create('manifest.pdf', 512, 'application/pdf');
        $action = new StoreShippingManifestAction();

        $storedPath = $action->handle($file, 'tenant-42', 77);

        $this->assertStringStartsWith('tenants/tenant-42/dispatch-trips/77/manifests/', $storedPath);
        $this->assertStringNotContainsString('C:\\', $storedPath);
        $this->assertStringNotContainsString('\\', $storedPath);
        $this->assertTrue(Storage::disk('s3')->exists($storedPath));
    }

    #[Test]
    public function it_rejects_invalid_file_formats(): void
    {
        Storage::fake('s3');

        $file = UploadedFile::fake()->create('manifest.exe', 512, 'application/octet-stream');
        $action = new StoreShippingManifestAction();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Unsupported shipping manifest format');

        $action->handle($file, 'tenant-42', 77);
    }
}
