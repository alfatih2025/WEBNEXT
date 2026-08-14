# NexaGrow ESP32 - Smart Farming Automation System

**NexaGrow** adalah sistem otomatisasi pertanian cerdas berbasis **ESP32** yang terintegrasi dengan **Arduino Nano**, sensor lingkungan, aktuator, dan platform **IoT MQTT**. Sistem ini dirancang untuk memonitor dan mengontrol penyiraman tanaman secara otomatis maupun manual, dengan dukungan data cuaca real-time dari **BMKG** serta rekomendasi berbasis AI.

---

## Daftar Isi

1. [Gambaran Umum Sistem](#1-gambaran-umum-sistem)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Komponen Hardware](#3-komponen-hardware)
4. [Topologi Jaringan](#4-topologi-jaringan)
5. [Topik MQTT](#5-topik-mqtt)
6. [Komunikasi Serial (ESP32 ⇄ Arduino Nano)](#6-komunikasi-serial-esp32--arduino-nano)
7. [Fitur Utama](#7-fitur-utama)
8. [Penjelasan Kode per Bagian](#8-penjelasan-kode-per-bagian)
9. [Konfigurasi](#9-konfigurasi)
10. [Alur Kerja Sistem](#10-alur-kerja-sistem)
11. [Spesifikasi Teknis](#11-spesifikasi-teknis)
12. [Cara Menggunakan](#12-cara-menggunakan)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Gambaran Umum Sistem

NexaGrow adalah sistem **IoT Smart Farming** yang mengintegrasikan:

| Komponen | Peran |
|----------|-------|
| **ESP32 (DoIT DevKit V1)** | Otak sistem: koneksi WiFi, komunikasi MQTT, logika kontrol otomatis, komunikasi serial dengan Arduino, sinkronisasi NTP/RTC, cache data cuaca BMKG, analitik pemakaian air, manajemen jadwal, dan antrian pesan MQTT offline |
| **Arduino Nano** | Pembacaan sensor langsung (DHT22, soil moisture), kontrol relay pompa & LED, eksekusi jadwal penyiraman lokal, kalkulasi skor penyiraman, backup RTC DS3231 |
| **HiveMQ Cloud** | Broker MQTT cloud (TLS 8883) untuk komunikasi dua arah dengan dashboard web |
| **Web Dashboard (React.js)** | Antarmuka pengguna berbasis web untuk monitoring & kontrol |
| **BMKG API** | Data cuaca real-time untuk rekomendasi penyiraman (cached 6 jam) |
| **NTP Server** | Sinkronisasi waktu otomatis untuk jadwal penyiraman akurat |
| **Preferences (NVS)** | Penyimpanan non-volatile untuk kredensial WiFi, jadwal, dan pengaturan sistem |

### Diagram Blok Sederhana

```
┌─────────────────────────────────────────────────────────┐
│                    INTERNET                              │
│   ┌──────────┐   ┌──────────┐   ┌──────────────────┐   │
│   │ HiveMQ   │   │ BMKG API │   │   NTP Server     │   │
│   │  Cloud   │   │ Cuaca    │   │   (pool.ntp.org) │   │
│   └────┬─────┘   └────┬─────┘   └────────┬─────────┘   │
│        │              │                  │              │
├────────┼──────────────┼──────────────────┼──────────────┤
│        │              │                  │              │
│   ┌────▼──────────────▼──────────────────▼──────────┐   │
│   │                   ESP32                         │   │
│   │  ┌──────────────────────────────────────────┐   │   │
│   │  │  WiFi + MQTT Client (PubSubClient)       │   │   │
│   │  │  Preferences (NVS) - Penyimpanan         │   │   │
│   │  │  ArduinoJson - Parsing & Serialisasi     │   │   │
│   │  │  Logika Otomatis / Jadwal / AI           │   │   │
│   │  │  Cache Cuaca BMKG (6 jam)                │   │   │
│   │  │  Antrian MQTT Offline (max 20 pesan)     │   │   │
│   │  └──────────────────────────────────────────┘   │   │
│   │                      │                           │   │
│   │              Serial2 (TX2=GPIO17, RX2=GPIO16)    │   │
│   │                      │                           │   │
│   │   ┌──────────────────▼──────────────────────┐   │   │
│   │   │           Arduino Nano                  │   │   │
│   │   │  DHT22, Soil Moisture, Relay, LED, RTC  │   │   │
│   │   └─────────────────────────────────────────┘   │   │
│   └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Arsitektur Sistem

### 2.1 Hierarki Komunikasi

```
[Web Dashboard React] ←→ [HiveMQ Cloud (MQTT)] ←→ [ESP32] ←→ [Arduino Nano (Serial2)]
                                                          ↓
                                                   [Preferences/NVS]
                                                   [WiFi/NTP/BMKG]
```

**ESP32** bertindak sebagai **gateway** yang menjembatani:
- **Cloud → Arduino**: Perintah dari web dashboard dikirim via MQTT ke ESP32, lalu diferuskan ke Arduino melalui Serial2.
- **Arduino → Cloud**: Data sensor dari Arduino dikirim via Serial2 ke ESP32, lalu dipublikasikan ke MQTT.
- **ESP32 → Cloud (mandiri)**: Heartbeat, resource monitoring, rekomendasi AI, data cuaca BMKG.

### 2.2 State Machine ESP32

```
                    ┌──────────────┐
                    │    SETUP     │
                    │  Init HW     │
                    │  Load Prefs  │
                    │  WiFi Connect│
                    │  MQTT Connect│
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
              ┌─────│  MAIN LOOP  │─────┐
              │     └──────┬───────┘     │
              │            │             │
     ┌────────▼───┐ ┌─────▼──────┐ ┌────▼────────┐
     │ Read       │ │ Process    │ │ MQTT Loop & │
     │ Serial     │ │ WiFi &     │ │ Queue Send  │
     │ Arduino    │ │ MQTT Conn  │ │             │
     └────────────┘ └────────────┘ └─────────────┘
              │            │             │
     ┌────────▼───┐ ┌─────▼──────┐ ┌────▼────────┐
     │ Auto       │ │ Heartbeat  │ │ Resource    │
     │ Control    │ │ & BMKG    │ │ Monitor     │
     │ Logic      │ │ Publish   │ │ (Heap)      │
     └────────────┘ └────────────┘ └─────────────┘
```

### 2.3 Manajemen Memori & Fault Tolerance

- **Heap Warning**: 50 KB -> publikasi `SYSTEM_RESOURCE` dengan status `warning`
- **Heap Restart**: 40 KB -> restart ESP32 otomatis untuk recovery
- **Antrian MQTT Offline**: 20 pesan maksimum (hanya untuk topik tertentu seperti sensor data, fault, resource)
- **Timeout Arduino**: 15 detik -> retry telemetry 3 kali -> reinit Serial2 jika gagal
- **WiFi Retry**: 30 detik interval, 20 detik timeout per percobaan
- **MQTT Backoff**: Mulai 2 detik, naik exponensial hingga maksimal 60 detik

---

## 3. Komponen Hardware

### 3.1 ESP32 (DoIT DevKit V1)

| Pin | Fungsi | Keterangan |
|-----|--------|------------|
| GPIO 4 | Relay Pompa (Tidak langsung - kontrol via Arduino) | Output, LOW = ON, HIGH = OFF (default) |
| GPIO 2 | LED Indikator Internal | Berkedip jika error sensor / timeout Arduino |
| GPIO 16 | RX2 (Serial ke Arduino) | Menerima data dari Arduino Nano |
| GPIO 17 | TX2 (Serial ke Arduino) | Mengirim perintah ke Arduino Nano |

> **Catatan**: ESP32 tidak mengontrol relay pompa secara langsung. Semua kontrol aktuator (relay, LED) dilakukan oleh Arduino Nano berdasarkan perintah yang diterima via Serial2.

### 3.2 Arduino Nano (Terhubung via Serial2)

| Komponen | Keterangan |
|----------|------------|
| **DHT22** | Sensor suhu & kelembapan udara |
| **Soil Moisture Sensor** | Sensor kelembapan tanah (analog) |
| **Relay 1 channel** | Kontrol pompa air (ON/OFF) |
| **LED** | Indikator status / lampu |
| **RTC DS3231** | Real-time clock backup (sinkronisasi NTP via ESP32) |

### 3.3 Koneksi ESP32 ke Arduino Nano

```
ESP32                              Arduino Nano
+----------+                      +------------+
| GPIO 16  |<---- RX ------------>| TX (D11)   |
| (UART2)  |                      |            |
| GPIO 17  |<---- TX ------------>| RX (D10)   |
| (UART2)  |                      |            |
| GND      |<---- GND ----------->| GND        |
+----------+                      +------------+
```

**Konfigurasi Serial2 di ESP32:**
```cpp
HardwareSerial SerialArduino(2);       // UART2
SerialArduino.begin(115200, SERIAL_8N1, 16, 17);  // baud, config, RX, TX
SerialArduino.setRxBufferSize(2048);    // Buffer penerima 2 KB
SerialArduino.setTimeout(25);           // Timeout baca 25 ms
```

---

## 4. Topologi Jaringan

### 4.1 Koneksi WiFi

- **Mode**: Station (WiFi STA)
- **Retry Interval**: 30 detik
- **Connect Timeout**: 20 detik
- **Fallback**: Jika kredensial tersimpan gagal, fallback ke kredensial default dari `secret.h`
- **Penyimpanan**: Kredensial disimpan di NVS Preferences (`wifi_ssid`, `wifi_pass`)
- **Update via MQTT**: Dapat diubah dari dashboard web melalui topik `sproutai/wifi/cmd`

### 4.2 Koneksi MQTT

| Parameter | Nilai |
|-----------|-------|
| **Broker** | HiveMQ Cloud (TLS) |
| **Port** | 8883 (TLS) |
| **Client ID** | `ESP32SmartFarm-{MAC}` |
| **Keep Alive** | Default PubSubClient |
| **Last Will** | `sproutai/esp32/status` = `OFFLINE` (QoS 1, retain) |
| **Buffer Size** | 2048 bytes |
| **Backoff Strategy** | Exponential: 2s -> 4s -> 8s -> ... -> 60s max |

### 4.3 Koneksi Eksternal

| Layanan | URL / Server | Fungsi |
|---------|-------------|--------|
| **NTP** | `pool.ntp.org`, `time.nist.gov` | Sinkronisasi waktu (UTC+7 / WIB) |
| **BMKG** | `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=...` | Data cuaca real-time, cache 6 jam |
| **HiveMQ** | `{cluster_id}.s1.eu.hivemq.cloud:8883` | Broker MQTT cloud |

---

## 5. Topik MQTT

Sistem menggunakan 25+ topik MQTT dengan prefix `sproutai/`.

### 5.1 Kontrol & Status Aktuator

| Topik | Arah | Format | Keterangan |
|-------|------|--------|------------|
| `sproutai/pompa/cmd` | Web -> ESP32 | `ON` / `OFF` | Perintah nyalakan/matikan pompa |
| `sproutai/pompa/status` | ESP32 -> Web | `ON` / `OFF` | Status pompa terkini |
| `sproutai/lampu/cmd` | Web -> ESP32 | `ON` / `OFF` | Perintah lampu (tidak digunakan) |
| `sproutai/lampu/status` | ESP32 -> Web | `ON` / `OFF` | Status lampu (tidak digunakan) |

### 5.2 Kontrol Mode

| Topik | Arah | Format | Keterangan |
|-------|------|--------|------------|
| `sproutai/mode/cmd` | Web -> ESP32 | `AUTO` / `MANUAL` | Perintah ganti mode |
| `sproutai/mode/status` | ESP32 -> Web | `AUTO` / `MANUAL` | Status mode terkini |

### 5.3 Data Sensor & Status

| Topik | Arah | Format | Keterangan |
|-------|------|--------|------------|
| `sproutai/sensor/soil` | ESP32 -> Web | Float (0-100) | Kelembapan tanah |
| `sproutai/sensor/temp` | ESP32 -> Web | Float (C) | Suhu udara |
| `sproutai/sensor/humidity` | ESP32 -> Web | Float (0-100) | Kelembapan udara |
| `sproutai/sensor/data` | ESP32 -> Web | JSON | Data sensor lengkap + skor |

### 5.4 Sistem & Status

| Topik | Arah | Format | Keterangan |
|-------|------|--------|------------|
| `sproutai/system/status` | ESP32 -> Web | String | Status sistem umum |
| `sproutai/system/fault` | ESP32 -> Web | JSON | Fault sensor DHT22 |
| `sproutai/system/heartbeat` | ESP32 -> Web | JSON | Heartbeat (heap, WiFi RSSI, uptime) |
| `sproutai/system/resource` | ESP32 -> Web | JSON | Resource monitoring (heap, warning) |
| `sproutai/esp32/status` | ESP32 -> Web | String | Status ESP32 (ONLINE/OFFLINE) |

### 5.5 Web & Network

| Topik | Arah | Format | Keterangan |
|-------|------|--------|------------|
| `sproutai/web/status` | ESP32 -> Web | `ONLINE` / `OFFLINE` | Status web dashboard |
| `sproutai/wifi/cmd` | Web -> ESP32 | JSON | Perintah ganti WiFi (ssid, password) |
| `sproutai/wifi/status` | ESP32 -> Web | String/JSON | Status koneksi WiFi |

### 5.6 Jadwal & Pengaturan

| Topik | Arah | Format | Keterangan |
|-------|------|--------|------------|
| `sproutai/schedule/cmd` | Web -> ESP32 | JSON | Perintah jadwal penyiraman |
| `sproutai/schedule/status` | ESP32 -> Web | JSON | Status jadwal terkini |
| `sproutai/settings/cmd` | Web -> ESP32 | JSON | Perubahan pengaturan sistem |
| `sproutai/settings/status` | ESP32 -> Web | JSON | Status pengaturan terkini |

### 5.7 AI & Rekomendasi

| Topik | Arah | Format | Keterangan |
|-------|------|--------|------------|
| `sproutai/ai/action` | Web -> ESP32 | JSON | Aksi langsung dari AI |
| `sproutai/ai/recommendation` | ESP32 -> Web | JSON | Rekomendasi penyiraman AI |

### 5.8 Cuaca & Analitik

| Topik | Arah | Format | Keterangan |
|-------|------|--------|------------|
| `sproutai/weather/data` | ESP32 -> Web | JSON | Data cuaca BMKG (cached) |
| `sproutai/analytics/water` | ESP32 -> Web | JSON | Analitik pemakaian air per event |
| `sproutai/analytics/efficiency` | ESP32 -> Web | JSON | Efisiensi penyiraman |

### 5.9 History

| Topik | Arah | Format | Keterangan |
|-------|------|--------|------------|
| `sproutai/history/upload` | ESP32 -> Web | JSON | Upload data history |

### Contoh Payload JSON

**Data Sensor Lengkap** (`sproutai/sensor/data`):
```json
{
  "device_id": "ESP32_001",
  "sensor_source": "real_dht11",
  "temperature": 28.5,
  "humidity": 72.3,
  "soil_moisture": 45.2,
  "relay_state": false,
  "auto_mode": true,
  "plant_phase": "vegetatif",
  "threshold_kritis": 30.0,
  "threshold_atas": 70.0,
  "threshold_bawah": 45.0,
  "watering_time": "06:00",
  "watering_duration": 5,
  "schedule_enabled": true,
  "score": 65.0,
  "vpd": 1.2,
  "duration_estimate": 5.0,
  "watering_active": false
}
```

**Heartbeat** (`sproutai/system/heartbeat`):
```json
{
  "heap": 185632,
  "wifi": -45,
  "uptime": 3600000
}
```

**Rekomendasi AI** (`sproutai/ai/recommendation`):
```json
{
  "device_id": "ESP32_001",
  "watering_score": 65,
  "recommendation": "5 menit",
  "soil": 45.2,
  "temp": 28.5,
  "humidity": 72.3,
  "uptime_ms": 3600000
}
```

---

## 6. Komunikasi Serial (ESP32 -> Arduino Nano)

### 6.1 Spesifikasi

| Parameter | Nilai |
|-----------|-------|
| **Interface** | UART2 (HardwareSerial) |
| **Baud Rate** | 115200 |
| **Data Bits** | 8 |
| **Parity** | None |
| **Stop Bits** | 1 |
| **RX Pin** | GPIO 16 |
| **TX Pin** | GPIO 17 |
| **Buffer RX** | 2048 bytes |
| **Timeout** | 25 ms |
| **Format** | JSON satu baris per pesan |

### 6.2 Format Pesan

Setiap pesan adalah JSON object dalam satu baris, diakhiri `\n`.

```json
{"type":"...", "action":"...", ...}\n
```

### 6.3 Tipe Pesan dari Arduino ke ESP32

#### Telemetry (Data Sensor Berkala)
```json
{
  "type": "telemetry",
  "device_id": "ESP32_001",
  "sensor_source": "real_dht11",
  "temperature": 28.5,
  "humidity": 72.3,
  "soil_moisture": 45.2,
  "relay_state": false,
  "led_state": false,
  "auto_mode": true,
  "plant_phase": "vegetatif",
  "threshold_kritis": 30.0,
  "threshold_atas": 70.0,
  "threshold_bawah": 45.0,
  "watering_time": "06:00",
  "watering_duration": 5,
  "schedule_enabled": true,
  "score": 65.0,
  "soil_score": 40.0,
  "vpd": 1.2,
  "duration_estimate": 5.0,
  "watering_active": false
}
```

#### ACK (Konfirmasi)
```json
{"type": "ack", "action": "set_pump", "status": "ok"}
{"type": "pref_ack_resp", "action": "settings_saved", "status": "ok"}
{"type": "sync_ack", "action": "sync_thresholds", "status": "ok"}
```

### 6.4 Tipe Pesan dari ESP32 ke Arduino

#### Command: Set Pump
```json
{"type": "cmd", "action": "set_pump", "pump_state": true, "auto_mode": true}
```

#### Command: Set Lamp
```json
{"type": "cmd", "action": "set_lamp", "lamp_state": false, "led_state": false, "auto_mode": true}
```

#### Command: Set Mode
```json
{"type": "cmd", "action": "set_mode", "auto_mode": true}
```

#### Command: Sync State (Lengkap)
```json
{
  "type": "cmd",
  "action": "sync_state",
  "auto_mode": true,
  "plant_phase": "vegetatif",
  "pump_state": false,
  "threshold_kritis": 30.0,
  "threshold_atas": 70.0,
  "threshold_bawah": 45.0,
  "schedule_enabled": true,
  "watering_enabled": true,
  "watering_time": "06:00",
  "watering_duration": 5,
  "location": "33.74.07.1010",
  "weather_location": "33.74.07.1010",
  "rain": 20,
  "weather_rain_chance": 20
}
```

#### Command: Sync Thresholds
```json
{
  "type": "cmd",
  "action": "sync_thresholds",
  "auto_mode": true,
  "plant_phase": "vegetatif",
  "threshold_kritis": 30.0,
  "threshold_atas": 70.0,
  "threshold_bawah": 45.0,
  "schedule_enabled": true,
  "watering_time": "06:00",
  "watering_duration": 5,
  "rain": 20
}
```

#### Command: Request Telemetry
```json
{"type": "cmd", "action": "request_telemetry", "source": "esp32"}
```

#### Command: MQTT Status
```json
{"type": "cmd", "action": "mqtt_status", "status": true}
```

#### Command: Sync RTC (dari NTP)
```json
{
  "type": "cmd",
  "action": "sync_rtc",
  "y": 2024,
  "m": 12,
  "d": 25,
  "h": 14,
  "min": 30,
  "s": 0
}
```

#### Heartbeat ESP32 -> Arduino
```json
{"type": "heartbeat", "uptime": 3600000, "heap": 185632}
```

#### Preference ACK
```json
{
  "type": "pref_ack",
  "action": "settings_saved",
  "watering_time": "06:00",
  "watering_duration": 5,
  "schedule_enabled": true,
  "plant_phase": "vegetatif",
  "threshold_kritis": 30.0,
  "threshold_atas": 70.0,
  "threshold_bawah": 45.0,
  "bmkg_url": "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=33.74.05.1001"
}
```

### 6.5 Protokol Parsing di ESP32

1. Buffer menyimpan data mentah dari Serial2 (hingga 4096 bytes)
2. Cari karakter `{` sebagai awal JSON
3. Hitung brace matching (`{` = +1, `}` = -1) hingga 0
4. Ekstrak substring dari `{` ke `}` sebagai frame JSON lengkap
5. Parse JSON dan proses berdasarkan `type` field
6. Hapus frame yang sudah diproses dari buffer
7. String escape (`\\`) dan boolean non-standar (`TRUE`/`FALSE`, `True`/`False`) dinormalisasi

---

## 7. Fitur Utama

### 7.1 Mode Operasi
- **Mode Otomatis (Auto)**: ESP32 secara otomatis mengontrol pompa berdasarkan:
  - Ambang kelembapan tanah (bawah/atas dinamis dari dashboard)
  - Jadwal penyiraman terjadwal
  - Cooldown 60 detik antar toggle pompa
- **Mode Manual**: Pompa dikontrol penuh oleh perintah dari dashboard web

### 7.2 Jadwal Penyiraman
- Waktu penyiraman (format `HH:MM`)
- Durasi penyiraman (dalam menit)
- Aktif/Nonaktif jadwal
- Disimpan di NVS Preferences (short keys: `w_time`, `w_dur`, `sched`)
- Migrasi otomatis dari legacy keys ke short keys

### 7.3 Kontrol Otomatis Berdasarkan Sensor
- Pompa ON jika kelembapan tanah < ambang bawah
- Pompa OFF jika kelembapan tanah > ambang atas
- Ambang batas dinamis yang dapat diubah dari dashboard

### 7.4 Rekomendasi AI
- Skor penyiraman (0-100) berdasarkan:
  - Kelembapan tanah (bobot 1.15x)
  - Suhu udara (bobot 2.0x)
  - Kelembapan udara (bobot 0.45x)
  - Peluang hujan dari BMKG (-12 poin jika hujan)
- Rekomendasi durasi penyiraman (1-10 menit)
- Dipublikasikan setiap ada perubahan skor atau minimal 60 detik

### 7.5 Integrasi Cuaca BMKG
- Cache data cuaca selama 6 jam (BMKG_CACHE_VALID_MS)
- Data: suhu, kelembapan, kecepatan angin, peluang hujan, kondisi cuaca
- Lokasi dikonfigurasi via dashboard (kode `adm4` BMKG)
- Parsing fleksibel untuk berbagai format respons BMKG (nested `current`, `weather`, `bmkg`, `forecast`)

### 7.6 Analitik & Monitoring
- **Pemakaian Air**: Estimasi liter per event penyiraman (debit pompa 1.5 L/menit)
- **Total Akumulasi**: Akumulasi total pemakaian air
- **Efisiensi**: Rasio air terhadap kelembapan tanah
- **Heartbeat**: Periodik 30 detik (heap, WiFi RSSI, uptime)
- **Resource Monitoring**: Heap warning di 50 KB, restart di 40 KB

### 7.7 Fault Detection & Recovery
- **Sensor DHT22 Fault**: Deteksi nilai NAN, out-of-range (< -10C atau > 80C, < 0% atau > 100%)
- **Timeout Arduino**: 15 detik tanpa data -> retry 3x -> reinit Serial2
- **LED Indikator**: Internal LED (GPIO2) berkedip 500ms jika error sensor / timeout
- **WiFi Fallback**: Otomatis kembali ke kredensial default jika kredensial tersimpan gagal

### 7.8 Antrian MQTT Offline
- Maksimal 20 pesan dalam antrian
- Hanya untuk topik tertentu: sensor data, cuaca, fault, resource, rekomendasi
- Otomatis terkirim saat koneksi MQTT pulih
- FIFO dengan overwrite jika antrian penuh

### 7.9 Sinkronisasi Waktu (NTP -> RTC)
- ESP32 mengambil waktu dari NTP (pool.ntp.org)
- Mengirim data waktu ke Arduino untuk sinkronisasi RTC DS3231
- Timezone: WIB (UTC+7)

---

## 8. Penjelasan Kode per Bagian

### 8.1 Struktur File

```
EspNexaGrow1/
+-- platformio.ini              # Konfigurasi PlatformIO
+-- include/
|   +-- README                  # Readme folder include
|   +-- secret.h                # Kredensial dan konfigurasi rahasia
+-- src/
|   +-- ESP32_revisi_full_nexagrow.cpp  # Kode utama ESP32
+-- README.md                   # Dokumentasi ini
```

### 8.2 Bagian-bagian Kode

| Bagian | Baris (kira-kira) | Deskripsi |
|--------|------------------|-----------|
| **Include & Defines** | 1-30 | Library, konstanta default WiFi, MQTT, pin, topik |
| **Konstanta Sistem** | 30-90 | Pin, baud rate, ambang batas, interval timer |
| **Variabel Global** | 90-200 | Status sistem, data sensor, state machine |
| **Helper Functions** | 200-350 | Utility: perbandingan, parsing, normalisasi JSON |
| **MQTT Publish** | 350-550 | Fungsi publikasi ke MQTT dengan antrian offline |
| **Serial ke Arduino** | 550-750 | Fungsi kirim perintah ke Arduino via Serial2 |
| **Aktuator** | 750-800 | Kontrol pompa dengan logging analitik air |
| **Health & Analytics** | 800-1050 | Skor AI, BMKG, heartbeat, resource monitoring |
| **Snapshot Sensor** | 1050-1150 | Publikasi data sensor ke MQTT (JSON lengkap) |
| **Preferences** | 1150-1400 | Baca/tulis NVS untuk WiFi, jadwal, pengaturan |
| **WiFi Management** | 1400-1700 | Koneksi, retry, fallback, update kredensial |
| **Auto Control** | 1700-1800 | Logika kontrol otomatis pompa |
| **Command Handlers** | 1800-2300 | Handler untuk settings, AI, mode, jadwal, WiFi |
| **Serial Read** | 2300-2550 | Parsing data dari Arduino (brace matching) |
| **MQTT Callback** | 2550-2750 | Handler pesan masuk dari MQTT |
| **MQTT Connect** | 2750-2900 | Koneksi, subscribe, retry backoff |
| **Setup** | 2900-3100 | Inisialisasi hardware, WiFi, MQTT |
| **Loop** | 3100-3200 | Main loop: read serial, WiFi, MQTT, kontrol, heartbeat |

### 8.3 Library yang Digunakan

| Library | Versi | Fungsi |
|---------|-------|--------|
| `WiFi.h` | Built-in ESP32 | Koneksi WiFi |
| `WiFiClientSecure.h` | Built-in ESP32 | Koneksi TLS untuk MQTT |
| `PubSubClient` | ^2.8 | Client MQTT |
| `ArduinoJson` | ^7.2.2 | Parsing & serialisasi JSON |
| `Preferences.h` | Built-in ESP32 | Penyimpanan NVS |
| `HardwareSerial.h` | Built-in ESP32 | Komunikasi UART2 |

---

## 9. Konfigurasi

### 9.1 PlatformIO (`platformio.ini`)

```ini
[platformio]
core_dir = .platformio-core

[env:esp32doit-devkit-v1]
platform = espressif32
board = esp32doit-devkit-v1
upload_port = COM6
framework = arduino
monitor_speed = 115200
upload_speed = 115200
build_flags =
    -DWIFI_SSID=\"${sysenv.WIFI_SSID}\"
    -DWIFI_PASS=\"${sysenv.WIFI_PASS}\"
    -DMQTT_SERVER=\"${sysenv.MQTT_SERVER}\"
    -DMQTT_PORT=${sysenv.MQTT_PORT}
    -DMQTT_USERNAME=\"${sysenv.MQTT_USERNAME}\"
    -DMQTT_PASSWORD=\"${sysenv.MQTT_PASSWORD}\"
lib_deps =
    knolleary/PubSubClient@^2.8
    bblanchon/ArduinoJson@^7.2.2
```

> **Catatan**: Kredensial diambil dari environment variables sistem. Jika tidak diset, fallback ke nilai di `secret.h`.

### 9.2 Secret (`include/secret.h`)

```cpp
#pragma once

#define WIFI_SSID "your_wifi_ssid"
#define WIFI_PASS "your_wifi_password"

#define MQTT_SERVER "your_cluster.s1.eu.hivemq.cloud"
#define MQTT_USERNAME "your_mqtt_username"
#define MQTT_PASSWORD "your_mqtt_password"

#define OPENROUTER_API_KEY "sk-or-v1-..."

#define BMKG_URL "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=33.74.05.1001"
```

### 9.3 Environment Variables (Alternatif untuk CI/CD)

| Variable | Deskripsi |
|----------|-----------|
| `WIFI_SSID` | Nama jaringan WiFi |
| `WIFI_PASS` | Password WiFi |
| `MQTT_SERVER` | Server MQTT (HiveMQ Cloud) |
| `MQTT_PORT` | Port MQTT (8883) |
| `MQTT_USERNAME` | Username MQTT |
| `MQTT_PASSWORD` | Password MQTT |
| `VITE_SUPABASE_URL` | URL Supabase project |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key untuk client-side access |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key untuk backend/API writes |
| `VITE_API_AUTH_TOKEN` | Token internal untuk API route authentication |

> Catatan: `SUPABASE_SERVICE_ROLE_KEY` harus disimpan sebagai secret di environment dan hanya dipakai oleh server/API. Jangan letakkan di file JavaScript/klien yang bisa diakses browser.

### 9.4 NVS Preferences (Runtime)

Data yang disimpan di NVS ESP32:

| Key | Tipe | Deskripsi |
|-----|------|-----------|
| `wifi_ssid` | String | SSID WiFi tersimpan |
| `wifi_pass` | String | Password WiFi tersimpan |
| `w_time` | String | Waktu jadwal penyiraman (HH:MM) |
| `w_dur` | Int | Durasi penyiraman (menit) |
| `sched` | Bool | Jadwal aktif/nonaktif |
| `p_phase` | String | Fase tanaman (vegetatif/generatif) |
| `loc` | String | Kode lokasi BMKG |
| `a_rpt` | Bool | Auto-report aktif |
| `r_time` | String | Waktu laporan otomatis |
| `t_low` | Float | Ambang suhu bawah |
| `t_high` | Float | Ambang suhu atas |
| `h_low` | Float | Ambang kelembapan udara bawah |
| `h_high` | Float | Ambang kelembapan udara atas |
| `s_crit` | Float | Ambang kelembapan tanah kritis |
| `s_low` | Float | Ambang kelembapan tanah bawah |
| `s_high` | Float | Ambang kelembapan tanah atas |
| `bmkg_url` | String | URL API BMKG |

### 9.5 Konstanta yang Dapat Disesuaikan

| Konstanta | Nilai Default | Deskripsi |
|-----------|--------------|-----------|
| `BAUD_SERIAL_ARDUINO` | 115200 | Baud rate komunikasi dengan Arduino |
| `WIFI_RETRY_INTERVAL_MS` | 30000 | Interval retry WiFi (ms) |
| `WIFI_CONNECT_TIMEOUT_MS` | 20000 | Timeout koneksi WiFi (ms) |
| `MQTT_RETRY_INTERVAL_AWAL_MS` | 2000 | Interval awal retry MQTT (ms) |
| `MQTT_RETRY_INTERVAL_MAKS_MS` | 60000 | Interval maksimal retry MQTT (ms) |
| `ARDUINO_TIMEOUT_MS` | 15000 | Timeout data dari Arduino (ms) |
| `HEARTBEAT_INTERVAL_MS` | 30000 | Interval heartbeat (ms) |
| `RESOURCE_INTERVAL_MS` | 30000 | Interval resource monitoring (ms) |
| `BMKG_CACHE_VALID_MS` | 21600000 | Cache data BMKG (6 jam) |
| `HEAP_WARNING_BYTES` | 51200 | Heap warning threshold (50 KB) |
| `HEAP_RESTART_BYTES` | 40000 | Heap restart threshold (40 KB) |
| `DEBIT_POMPA_LITER_PER_MENIT` | 1.5 | Debit pompa untuk estimasi air |
| `MQTT_OFFLINE_QUEUE_SIZE` | 20 | Maksimal antrian MQTT offline |

---

## 10. Alur Kerja Sistem

### 10.1 Setup (Sekali saat boot)

```
1. Inisialisasi Serial monitor (115200 baud)
2. Seed random number generator
3. Konfigurasi NTP (UTC+7)
4. Set pin mode (relay, LED)
5. Matikan relay & LED (safe state)
6. Inisialisasi Serial2 (115200, 8N1, RX=16, TX=17)
7. Kirim test message ke Arduino
8. Muat pengaturan dari NVS Preferences
9. Muat jadwal dari NVS Preferences
10. Muat kredensial WiFi dari NVS Preferences
11. Koneksi WiFi (blocking, timeout 20 detik)
12. Konfigurasi MQTT (TLS, buffer 2048, callback)
13. Koneksi MQTT (non-blocking)
```

### 10.2 Loop (Berulang terus)

```
1. BACA DATA ARDUINO
   +-- Cek Serial2.available()
   +-- Buffer data hingga 4096 bytes
   +-- Cari frame JSON lengkap (brace matching)
   +-- Parse JSON
   +-- Proses telemetry/ack/sync

2. PROSES WIFI
   +-- Cek status koneksi
   +-- Jika terhubung -> laporkan status, sync NTP->RTC
   +-- Jika terputus -> retry dengan backoff
   +-- Fallback ke kredensial default jika perlu

3. PROSES MQTT
   +-- Cek koneksi
   +-- Jika terputus -> reconnect dengan exponential backoff
   +-- Jika terhubung -> subscribe, publish status, kirim antrian
   +-- Loop client (klien.loop())

4. KONTROL OTOMATIS
   +-- Jika mode auto & ada data sensor valid
   +-- Cek kelembapan tanah vs ambang batas
   +-- Cooldown 60 detik
   +-- Kirim perintah pompa ON/OFF ke Arduino

5. HEARTBEAT & RESOURCE
   +-- Heartbeat setiap 30 detik
   +-- Cek heap setiap 30 detik
   +-- Restart jika heap < 40 KB

6. TIMEOUT HANDLING
   +-- Jika 15 detik tanpa data Arduino
   +-- Retry telemetry 3 kali
   +-- Jika gagal terus -> reinit Serial2

7. LED INDICATOR
   +-- Jika error sensor/timeout -> blink 500ms
   +-- Jika normal -> LED mati
```

### 10.3 Diagram Alur Data

```
Arduino Nano                    ESP32                         Cloud/Web
    |                            |                              |
    |--- telemetry (JSON) ------>|                              |
    |                            +--- publikasikan snapshot --->|
    |                            |   (sensor/data, sub-topik)   |
    |                            |                              |
    |                            |<--- pompa/cmd ---------------|
    |<--- set_pump --------------|                              |
    |--- ack ------------------->|                              |
    |                            +--- publikasikan status ---->|
    |                            |                              |
    |                            |<--- mode/cmd ---------------|
    |<--- set_mode --------------|                              |
    |                            |                              |
    |                            |<--- settings/cmd -----------|
    |<--- sync_state -----------|                              |
    |                            +--- settings/status -------->|
    |                            |                              |
    |                            |<--- wifi/cmd ---------------|
    |                            |   (ganti SSID/password)      |
    |                            |                              |
    |                            +--- system/heartbeat -------->|
    |                            +--- system/resource --------->|
    |                            +--- ai/recommendation ------->|
    |                            +--- weather/data ------------>|
    |                            +--- analytics/water --------->|
    |                            +--- analytics/efficiency ---->|
    |                            |                              |
    |<--- heartbeat (ESP->Nano) -|                              |
    |<--- sync_rtc (NTP->Arduino)-|                              |
```

---

## 11. Spesifikasi Teknis

### 11.1 Pin Mapping Lengkap

| Perangkat | Pin ESP32 | Fungsi |
|-----------|-----------|--------|
| Relay Pompa | GPIO 4 | Kontrol (tidak langsung, via Arduino) |
| LED Internal | GPIO 2 | Indikator error |
| Serial2 RX | GPIO 16 | Terima data dari Arduino |
| Serial2 TX | GPIO 17 | Kirim data ke Arduino |

### 11.2 Timing & Interval

| Event | Interval | Keterangan |
|-------|----------|------------|
| Heartbeat | 30 detik | Status ESP32 ke MQTT |
| Resource Monitor | 30 detik | Cek heap + publikasi |
| WiFi Retry | 30 detik | Jika koneksi putus |
| MQTT Retry (awal) | 2 detik | Exponential backoff |
| MQTT Retry (maks) | 60 detik | Backoff maksimal |
| Arduino Timeout | 15 detik | Tanpa data dari Arduino |
| LED Blink Error | 500 ms | Indikasi fault |
| Cooldown Auto | 60 detik | Anti race condition toggle pompa |
| Cache BMKG | 6 jam | Cache data cuaca |

### 11.3 Batasan Sistem

| Parameter | Nilai |
|-----------|-------|
| Buffer Serial RX | 2048 bytes |
| Buffer Parsing Maks | 4096 bytes |
| MQTT Buffer | 2048 bytes |
| Antrian MQTT Offline | 20 pesan |
| Panjang Topik Queue | 96 bytes |
| Panjang Payload Queue | 1024 bytes |
| Heap Warning | 50 KB |
| Heap Restart | 40 KB |

### 11.4 Daftar Topik MQTT (Lengkap)

```
sproutai/pompa/cmd
sproutai/pompa/status
sproutai/lampu/cmd
sproutai/lampu/status
sproutai/mode/cmd
sproutai/mode/status
sproutai/sensor/soil
sproutai/sensor/temp
sproutai/sensor/humidity
sproutai/sensor/data
sproutai/system/status
sproutai/system/fault
sproutai/system/heartbeat
sproutai/system/resource
sproutai/web/status
sproutai/wifi/cmd
sproutai/wifi/status
sproutai/schedule/cmd
sproutai/schedule/status
sproutai/settings/cmd
sproutai/settings/status
sproutai/esp32/status
sproutai/weather/data
sproutai/ai/action
sproutai/ai/recommendation
sproutai/analytics/water
sproutai/analytics/efficiency
sproutai/history/upload
```

---

## 12. Cara Menggunakan

### 12.1 Prasyarat

1. **Hardware**:
   - ESP32 DoIT DevKit V1
   - Arduino Nano
   - Sensor DHT22
   - Soil Moisture Sensor (analog)
   - Relay 1 channel
   - RTC DS3231 (optional)
   - Power supply 5V

2. **Software**:
   - [PlatformIO](https://platformio.org/) (VS Code extension)
   - [Git](https://git-scm.com/) (optional)

3. **Akun**:
   - [HiveMQ Cloud](https://www.hivemq.com/mqtt-cloud-broker/) (MQTT Broker)
   - [BMKG API](https://data.bmkg.go.id/) (Data cuaca, gratis)

### 12.2 Setup Awal

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd EspNexaGrow1
   ```

2. **Konfigurasi Secret**
   Edit `include/secret.h`:
   ```cpp
   #define WIFI_SSID "NamaWiFi"
   #define WIFI_PASS "PasswordWiFi"
   #define MQTT_SERVER "cluster.s1.eu.hivemq.cloud"
   #define MQTT_USERNAME "NexaGrow"
   #define MQTT_PASSWORD "PasswordMQTT"
   #define BMKG_URL "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=33.74.05.1001"
   ```

3. **Wiring Hardware**
   Sesuai diagram di [Bagian 3.3](#33-koneksi-esp32-ke-arduino-nano).

4. **Upload Firmware**
   ```bash
   # Melalui PlatformIO
   PlatformIO: Upload

   # Atau CLI
   pio run --target upload
   ```

5. **Monitor Serial**
   ```bash
   pio device monitor
   ```
   Atau gunakan Serial Monitor di PlatformIO.

### 12.3 Operasi Normal

Setelah boot, ESP32 akan:
1. Menghubungkan WiFi (default atau tersimpan)
2. Menghubungkan ke HiveMQ Cloud
3. Mulai menerima data sensor dari Arduino
4. Mempublikasikan data ke MQTT setiap ada perubahan signifikan

**Dashboard Web** dapat digunakan untuk:
- Monitor suhu, kelembapan udara, kelembapan tanah
- Kontrol pompa ON/OFF (mode manual)
- Ganti mode Auto/Manual
- Atur jadwal penyiraman
- Konfigurasi ambang batas sensor
- Lihat rekomendasi AI
- Ganti kredensial WiFi
- Lihat data cuaca BMKG

### 12.4 Update OTA / Konfigurasi

**Mengganti WiFi via MQTT:**
```json
// Publish ke: sproutai/wifi/cmd
{"ssid": "WiFiBaru", "password": "PasswordBaru"}
```

**Mengatur Jadwal via MQTT:**
```json
// Publish ke: sproutai/schedule/cmd
{
  "watering_time": "06:00",
  "watering_duration": 10,
  "schedule_enabled": true
}
```

**Mengubah Pengaturan via MQTT:**
```json
// Publish ke: sproutai/settings/cmd
{
  "plant_phase": "generatif",
  "location": "33.74.05.1001",
  "temp_threshold_low": 20.0,
  "temp_threshold_high": 35.0,
  "humidity_threshold_low": 50.0,
  "humidity_threshold_high": 90.0,
  "soil_threshold_low": 40.0,
  "soil_threshold_high": 65.0,
  "soil_threshold_critical": 25.0,
  "watering_time": "06:00",
  "watering_duration": 10,
  "watering_enabled": true,
  "auto_report": false,
  "report_time": "08:00",
  "bmkg_url": "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=33.74.05.1001"
}
```

---

## 13. Troubleshooting

### 13.1 ESP32 Tidak Terhubung WiFi

| Kemungkinan | Solusi |
|-------------|--------|
| SSID/Password salah | Cek `secret.h` atau kirim kredensial baru via MQTT `sproutai/wifi/cmd` |
| Sinyal WiFi lemah | Dekatkan ESP32 ke router atau gunakan WiFi extender |
| WiFi 5GHz tidak didukung | Pastikan jaringan menggunakan 2.4GHz |
| MAC address terblokir | Tambahkan MAC address ke whitelist router |

### 13.2 Tidak Ada Data dari Arduino

| Kemungkinan | Solusi |
|-------------|--------|
| Baud rate tidak cocok | Pastikan ESP32 dan Arduino sama-sama 115200 baud |
| Kabel Serial terbalik | RX ESP32 (GPIO16) ke TX Arduino, TX ESP32 (GPIO17) ke RX Arduino |
| Ground tidak terhubung | Pastikan GND ESP32 dan Arduino terhubung |
| Arduino tidak menyala | Cek power supply Arduino |
| Buffer overflow | Cek panjang JSON dari Arduino, maksimal 2048 bytes per frame |

### 13.3 MQTT Tidak Terhubung

| Kemungkinan | Solusi |
|-------------|--------|
| Kredensial MQTT salah | Cek `MQTT_USERNAME` dan `MQTT_PASSWORD` di `secret.h` |
| Server tidak reachable | Pastikan `MQTT_SERVER` benar dan ESP32 punya akses internet |
| Port TLS salah | Pastikan port 8883 (bukan 1883) |
| Cluster HiveMQ penuh | Cek dashboard HiveMQ untuk status cluster |
| Certificate issue | `klienEsp.setInsecure()` digunakan, pastikan tidak ada firewall memblokir |

### 13.4 Data Sensor Tidak Akurat

| Kemungkinan | Solusi |
|-------------|--------|
| DHT22 rusak | Ganti sensor DHT22 |
| Kabel sensor longgar | Periksa koneksi kabel |
| Soil moisture kering | Kalibrasi ulang sensor (baca nilai ADC kering & basah) |
| Interferensi listrik | Gunakan kabel shielded dan jauhkan dari sumber noise |

### 13.5 Pompa Tidak Menyala

| Kemungkinan | Solusi |
|-------------|--------|
| Mode Manual | Ganti ke mode AUTO di dashboard |
| Ambang batas salah | Cek konfigurasi threshold (soil_threshold_low / soil_threshold_high) |
| Cooldown aktif | Tunggu 60 detik setelah toggle terakhir |
| Relay rusak | Cek relay Arduino dengan multimeter |
| Arduino tidak merespon | Cek serial monitor ESP32 untuk pesan timeout |

### 13.6 ESP32 Restart Loop

| Kemungkinan | Solusi |
|-------------|--------|
| Heap memory rendah | Kurangi penggunaan JSON dinamis, tingkatkan interval resource monitoring |
| WiFi reconnect loop | Cek kestabilan jaringan, setel SSID yang benar |
| MQTT reconnect loop | Cek kredensial MQTT dan koneksi internet |
| Power supply tidak stabil | Gunakan power supply 5V 2A minimal |

### 13.7 Error Code pada Serial Monitor

| Pesan Error | Arti | Solusi |
|-------------|------|--------|
| `[ARDUINO] Buffer overflow` | Buffer JSON terlalu besar | Kurangi ukuran JSON dari Arduino |
| `[ARDUINO] No '{' found and buffer too large` | Data korup dari Arduino | Reset Arduino, cek baud rate |
| `[MQTT] Gagal, kode status=X` | Gagal konek MQTT | Cek kode status PubSubClient (-4=timeout, -3=lost, -2=fail, -1=disconnect) |
| `[WIFI] Gagal terkoneksi` | WiFi tidak terhubung | Cek SSID/password, sinyal WiFi |
| `[ARDUINO] Percobaan pemulihan komunikasi` | ESP32 reinit Serial2 | Cek kabel, reset Arduino |
| `[PREF] Legacy keys found` | Migrasi NVS dari key lama | Normal, tidak perlu tindakan |
| `heap low` / `restart` | Heap memory kritis | Optimasi penggunaan memori |

### 13.8 LED Indikator Berkedip

| Pola Kedip | Arti |
|-----------|------|
| LED mati | Sistem normal, tidak ada error |
| LED berkedip 500ms | Ada fault sensor DHT22 atau timeout komunikasi Arduino |

### 13.9 Debugging via Serial Monitor

Aktifkan monitor serial untuk melihat log real-time:
```bash
pio device monitor --baud 115200
```

Log level yang tersedia:
- `[SISTEM]` - Status sistem umum
- `[WIFI]` - Status dan event WiFi
- `[MQTT]` - Koneksi dan publikasi MQTT
- `[ARDUINO]` - Komunikasi dengan Arduino
- `[SERIAL->ARDUINO]` - Data yang dikirim ke Arduino
- `[RAW->ESP32]` - Data mentah dari Arduino
- `[BMKG]` - Data cuaca BMKG
- `[AI]` - Rekomendasi AI
- `[PREF]` - Operasi NVS Preferences
- `[SETTINGS]` - Perubahan pengaturan
- `[JADWAL]` - Update jadwal
- `[MODE]` - Perubahan mode
- `[OTOMATIS]` - Logika kontrol otomatis
- `[RELAY]` - Status relay/pompa

---

## Kontribusi

Silakan buka *issue* atau *pull request* untuk saran perbaikan atau fitur baru.

📄 License
Project ini bersifat Open Source dan dapat digunakan untuk pembelajaran, penelitian, maupun pengembangan lebih lanjut.

👨‍💻 Author
Habibullah Naja Alfatih Wibowo

AI • IoT • Embedded Systems • Software Developer

GitHub: https://github.com/alfatih2025 Jika repository ini bermanfaat, jangan lupa memberikan ⭐ pada repository GitHub.
#   N e x a G r o w N E X T  
 