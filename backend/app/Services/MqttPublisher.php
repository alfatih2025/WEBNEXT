<?php

namespace App\Services;

use PhpMqtt\Client\MqttClient;
use PhpMqtt\Client\ConnectionSettings;
use Illuminate\Support\Facades\Log;

class MqttPublisher
{
    /**
     * Publish sensor data to HiveMQ MQTT broker.
     * This runs server-side so the ESP32 doesn't need TLS.
     */
    public static function publish(string $topic, array $data): bool
    {
        $server   = config('mqtt.host');
        $port     = config('mqtt.port');
        $username = config('mqtt.username');
        $password = config('mqtt.password');

        try {
            $connectionSettings = (new ConnectionSettings)
                ->setUsername($username)
                ->setPassword($password)
                ->setUseTls(true)
                ->setTlsSelfSignedAllowed(true)
                ->setConnectTimeout(5)
                ->setSocketTimeout(5);

            $mqtt = new MqttClient($server, $port, 'laravel-nexagrow-' . uniqid());
            $mqtt->connect($connectionSettings);

            $payload = json_encode($data);
            $mqtt->publish($topic, $payload, 0);

            $mqtt->disconnect();

            Log::info("[MQTT] Published to {$topic}: {$payload}");
            return true;

        } catch (\Exception $e) {
            Log::error("[MQTT] Publish failed: " . $e->getMessage());
            return false;
        }
    }
}
