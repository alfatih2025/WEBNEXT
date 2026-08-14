import express from 'express';
import path from 'path';

// Statically import all API routes for esbuild compatibility
import sensorApi from './api/sensor.js';
import alertsApi from './api/alerts.js';
import chatApi from './api/chat.js';
import controlApi from './api/control.js';
import deviceStatusApi from './api/device-status.js';
import exportApi from './api/export.js';
import logsApi from './api/logs.js';
import openrouterApi from './api/openrouter.js';
import settingsApi from './api/settings.js';
import weatherLocationsApi from './api/weather-locations.js';
import weatherApi from './api/weather.js';
import { startMqttWorker } from './api/mqtt-worker.js';

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Start background MQTT worker for listening to ESP32 direct MQTT publishes
  startMqttWorker();

  app.use(express.json());

  // Handle CORS
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Helper to adapt Express req/res
  const apiHandler = (apiFn) => async (req, res) => {
    try {
      if (typeof apiFn === 'function') {
        // Provide res.status and res.json helpers if missing
        if (!res.status) {
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
        }
        if (!res.json) {
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(data);
          };
        }
        await apiFn(req, res);
      } else {
        res.status(404).json({ error: `API route not found or has no default export` });
      }
    } catch (e) {
      console.error(`Error in API:`, e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  // API Routes
  app.all('/api/sensor', apiHandler(sensorApi));
  app.all('/api/sensor-data', apiHandler(sensorApi)); // Alias for old endpoint
  app.all('/api/alerts', apiHandler(alertsApi));
  app.all('/api/chat', apiHandler(chatApi));
  app.all('/api/control', apiHandler(controlApi));
  app.all('/api/device-status', apiHandler(deviceStatusApi));
  app.all('/api/export', apiHandler(exportApi));
  app.all('/api/logs', apiHandler(logsApi));
  app.all('/api/openrouter', apiHandler(openrouterApi));
  app.all('/api/settings', apiHandler(settingsApi));
  app.all('/api/weather-locations', apiHandler(weatherLocationsApi));
  app.all('/api/weather', apiHandler(weatherApi));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
