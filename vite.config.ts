import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// @ts-expect-error - internal helper
import { getOpenRouterStatus, sendOpenRouterMessage } from './src/lib/apiHelpers/_openrouter.js';

async function readBody(req: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function apiDevPlugin() {
  return {
    name: 'api-dev-routes',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          next();
          return;
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        const urlObj = new URL(req.url, 'http://localhost');
        const pathname = urlObj.pathname;
        let apiName = pathname.replace(/^\/api\//, '').split('/')[0];

        if (apiName === 'sensor-data') {
          apiName = 'sensor';
        }

        if (apiName === 'openrouter') {
          try {
            if (req.method === 'GET') {
              const status = await getOpenRouterStatus(req.headers.origin);
              res.statusCode = status.ok ? 200 : 503;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(status));
              return;
            }

            if (req.method === 'POST') {
              const body = await readBody(req);
              const result = await sendOpenRouterMessage({
                message: body.message,
                history: Array.isArray(body.history) ? body.history : [],
                sensorContext: body.sensorContext ?? null,
                origin: req.headers.origin,
              });

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
              return;
            }
          } catch (error: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown OpenRouter error',
              }),
            );
            return;
          }
        }

        try {
          const query: Record<string, string> = {};
          urlObj.searchParams.forEach((val, key) => {
            query[key] = val;
          });
          req.query = query;

          if (req.method !== 'GET' && req.method !== 'HEAD') {
            req.body = await readBody(req);
          } else {
            req.body = {};
          }

          if (!res.status) {
            res.status = (code: number) => {
              res.statusCode = code;
              return res;
            };
          }
          if (!res.json) {
            res.json = (data: any) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
              return res;
            };
          }

          const apiModule = await import(`./api/${apiName}.js`);
          if (apiModule && typeof apiModule.default === 'function') {
            await apiModule.default(req, res);
            return;
          }
        } catch (e: any) {
          console.warn(`[API Dev Plugin] Could not handle ${req.url}:`, e?.message);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: e?.message || 'Internal Server Error' }));
          return;
        }

        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `API route /api/${apiName} not found` }));
        return;
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  const plugins: any[] = [react(), tailwindcss()];

  return {
    plugins,
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: false,
      allowedHosts: true,
    },
  };
});
