import { requireApiAuth } from '../src/lib/apiHelpers/_auth.js';
import {
  buildFormulaReference,
  isArduinoFormulaRequest,
  getOpenRouterStatus,
  sendOpenRouterMessage,
} from '../src/lib/apiHelpers/_openrouter.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!requireApiAuth(req, res)) return;

  if (req.method === 'GET') {
    const status = await getOpenRouterStatus(req.headers.origin);
    return res.status(status.ok ? 200 : 503).json(status);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, history = [], sensorContext = null } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (isArduinoFormulaRequest(message)) {
      const formulaContent = [
        '## Rumus Arduino NexaGrow',
        '',
        buildFormulaReference(),
      ].join('\n');
      return res.status(200).json({
        content: formulaContent,
        model: 'local-formula-response',
        checkedAt: new Date().toISOString(),
      });
    }

    const result = await sendOpenRouterMessage({
      message,
      history,
      sensorContext,
      origin: req.headers.origin,
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown OpenRouter error',
    });
  }
}
