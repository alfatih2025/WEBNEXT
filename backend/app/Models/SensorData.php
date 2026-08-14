<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SensorData extends Model
{
    use HasFactory;

    protected $table = 'sensor_data';

    protected $fillable = [
        'node_id',
        'temperature',
        'humidity',
        'soil_moisture',
    ];

    protected $casts = [
        'node_id'       => 'integer',
        'temperature'   => 'float',
        'humidity'      => 'float',
        'soil_moisture' => 'float',
    ];
}
