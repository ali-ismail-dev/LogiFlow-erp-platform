<?php

declare(strict_types=1);

namespace App\Http\Requests\Webhooks;

use App\Enums\Logistics\CarrierShipmentStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CarrierWebhookRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'carrier_waybill_reference' => ['required', 'string', 'min:1'],
            'stop_sequence' => ['nullable', 'integer', 'min:1'],
            'status' => ['required', 'string', Rule::enum(CarrierShipmentStatus::class)],
            'status_timestamp' => ['required', 'date'],
            'location_description' => ['nullable', 'string'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:longitude'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:latitude'],
            'raw_carrier_status_code' => ['nullable', 'string'],
        ];
    }
}
