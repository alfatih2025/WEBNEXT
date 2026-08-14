<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SensorData;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\MqttPublisher;

class SensorDataController extends Controller
{
    /**
     * POST /api/sensor-data
     * ESP32 Gateway mengirim data sensor baru.
     * Menerima JSON: { node_id, temperature, humidity, soil_moisture }
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'node_id'       => 'required|integer|in:1,2',
            'temperature'   => 'nullable|numeric',
            'humidity'      => 'nullable|numeric',
            'soil_moisture' => 'nullable|numeric',
        ]);

        $record = SensorData::create([
            'node_id' => $validated['node_id'],
            'temperature' => $validated['temperature'] ?? null,
            'humidity' => $validated['humidity'] ?? null,
            'soil_moisture' => $validated['soil_moisture'] ?? null,
        ]);

        // Publish to MQTT
        MqttPublisher::publish('sproutai/sensor/data', [
            'node_id' => $record->node_id,
            'temperature' => $record->temperature,
            'humidity' => $record->humidity,
            'soil_moisture' => $record->soil_moisture,
        ]);

        return response()->json([
            'success' => true,
            'data'    => $record,
        ], 201);
    }

    /**
     * GET /api/sensor-data/latest
     * Ambil data sensor terbaru per node (atau node tertentu via query param).
     * ?node_id=1  → hanya node 1
     * tanpa param → semua node (group by node_id, ambil terbaru)
     */
    public function latest(Request $request): JsonResponse
    {
        $nodeId = $request->query('node_id');

        if ($nodeId) {
            $data = SensorData::where('node_id', $nodeId)
                ->orderByDesc('created_at')
                ->first();

            return response()->json($data);
        }

        // Ambil data terbaru untuk setiap node
        $nodes = [1, 2];
        $result = [];

        foreach ($nodes as $id) {
            $latest = SensorData::where('node_id', $id)
                ->orderByDesc('created_at')
                ->first();

            if ($latest) {
                $result["node{$id}"] = $latest;
            }
        }

        return response()->json($result);
    }

    /**
     * GET /api/sensor-data
     * Ambil data historis sensor.
     * ?node_id=1&limit=60  → 60 data terakhir dari node 1
     * ?limit=60            → 60 data terakhir dari semua node
     */
    public function index(Request $request): JsonResponse
    {
        $nodeId = $request->query('node_id');
        $limit  = min((int) ($request->query('limit', 60)), 500);

        $query = SensorData::orderByDesc('created_at')->limit($limit);

        if ($nodeId) {
            $query->where('node_id', $nodeId);
        }

        return response()->json($query->get());
    }
}
