import supabase from '../src/lib/apiHelpers/_supabase.js';
import { requireApiAuth } from '../src/lib/apiHelpers/_auth.js';

async function sendEmailNotification({ recipientEmail, type, message, severity }) {
  const apiKey = (process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || '').trim();
  const fromEmail = (process.env.ALERT_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || '').trim();

  if (!apiKey || !fromEmail || !recipientEmail) {
    return { sent: false, skipped: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: recipientEmail,
      subject: `[NexaGrow] ${severity === 'danger' ? 'Kondisi Kritis' : 'Notifikasi'} - ${type}`,
      text: message,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || `Email API gagal (${response.status})`);
  }

  return { sent: true, id: payload?.id || null };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { unread = 'false' } = req.query;
      let query = supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (unread === 'true') {
        query = query.eq('read', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      if (!requireApiAuth(req, res)) return;

      const body = req.body || {};
      const action = body.action || 'create';

      if (action === 'mark_read') {
        const { id } = body;

        if (id) {
          const { data, error } = await supabase
            .from('alerts')
            .update({ read: true })
            .eq('id', id)
            .select()
            .single();
          if (error) throw error;
          return res.status(200).json(data);
        }

        const { data, error } = await supabase
          .from('alerts')
          .update({ read: true })
          .eq('read', false)
          .select();
        if (error) throw error;
        return res.status(200).json({ markedAsRead: data?.length || 0 });
      }

      if (action !== 'create') {
        return res.status(400).json({ error: 'Invalid action' });
      }

      const {
        type,
        message,
        severity = 'info',
        read = false,
        send_email = false,
        recipient_email = '',
      } = body;

      const { data, error } = await supabase
        .from('alerts')
        .insert({
          type,
          message,
          severity,
          read,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      let emailResult = { sent: false, skipped: true };
      if (send_email && recipient_email) {
        try {
          emailResult = await sendEmailNotification({
            recipientEmail: String(recipient_email).trim(),
            type: String(type || 'notifikasi'),
            message: String(message || ''),
            severity,
          });
        } catch (emailError) {
          emailResult = {
            sent: false,
            error: emailError instanceof Error ? emailError.message : 'Email error',
          };
        }
      }

      return res.status(201).json({ ...data, email: emailResult });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Alerts API error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
