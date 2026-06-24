// api/reject-request.js
// POST /api/reject-request — admin only. Body: { requestId }
import { supabaseAdmin, getUserFromRequest, isAdminProfile } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { user, profile } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  if (!isAdminProfile(profile)) return res.status(403).json({ ok: false, error: 'Admin access required' });

  const { requestId } = req.body || {};
  if (!requestId) return res.status(400).json({ ok: false, error: 'Missing requestId' });

  try {
    const { error } = await supabaseAdmin.from('requests').update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: profile.email,
    }).eq('id', requestId).eq('status', 'pending');
    if (error) throw error;

    res.status(200).json({ ok: true, rejected: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
