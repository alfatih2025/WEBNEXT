import supabase from '../src/lib/apiHelpers/_supabase.js';
import { requireApiAuth } from '../src/lib/apiHelpers/_auth.js';

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
  const stringValue = String(value);
  return /[",\n\r]/.test(stringValue)
    ? `"${stringValue.replace(/"/g, '""')}"`
    : stringValue;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      if (!requireApiAuth(req, res)) return;

      const { type = 'sensor', format = 'csv', start, end } = req.query;

      let data = [];
      let error = null;

      if (type === 'sensor') {
        let query = supabase
          .from('sensor_data')
          .select('*')
          .order('created_at', { ascending: false });

        if (start) query = query.gte('created_at', start);
        if (end) query = query.lte('created_at', end);

        const result = await query.limit(1000);
        data = result.data || [];
        error = result.error;
      } else if (type === 'logs') {
        const result = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);
        data = result.data || [];
        error = result.error;
      } else if (type === 'control') {
        const result = await supabase
          .from('control_logs')
          .select('*')
          .order('executed_at', { ascending: false })
          .limit(1000);
        data = result.data || [];
        error = result.error;
      }

      if (error) throw error;

      if (format === 'csv') {
        const headers = Object.keys(data[0] || {});
        const rows = data.map((row) => headers.map((key) => csvEscape(row[key])).join(','));
        const csv = [headers.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_export_${new Date().toISOString().split('T')[0]}.csv"`);
        return res.status(200).send(csv);
      }

      return res.status(200).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Export API error:', err);
    res.status(500).json({ error: err.message });
  }
}
