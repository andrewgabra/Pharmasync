// api/submit-request.js
// POST /api/submit-request — any logged-in user (staff or admin).
// Body: { requestAction, label, payload }
import { supabaseAdmin, getUserFromRequest } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { user, profile } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });

  const { requestAction, label, payload } = req.body || {};
  if (!requestAction) return res.status(400).json({ ok: false, error: 'Missing requestAction' });

  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const { error } = await supabaseAdmin.from('requests').insert({
      id,
      action: requestAction,
      label: label || requestAction,
      payload: payload || {},
      requested_by: profile?.email || user.email,
      status: 'pending',
    });
    if (error) throw error;

    res.status(200).json({ ok: true, id, submitted: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
