<?php

return [
    'host'     => env('MQTT_HOST', 'a4e9379a555f47669c90f4c69b75eeda.s1.eu.hivemq.cloud'),
    'port'     => env('MQTT_PORT', 8883),
    'username' => env('MQTT_USERNAME', 'NexaGrowv2'),
    'password' => env('MQTT_PASSWORD', 'NexaGrow12345'),
];

// Explicit runtime expectation for this project:
// backend PHP MQTT publishing must use the NexaGrowv2 broker credentials.
// To change broker details, update MQTT_HOST/PORT/USERNAME/PASSWORD in backend/.env.
