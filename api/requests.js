// api/requests.js
// GET /api/requests?status=pending — admin only.
import { supabaseAdmin, getUserFromRequest, isAdminProfile } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { user, profile } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  if (!isAdminProfile(profile)) return res.status(403).json({ ok: false, error: 'Admin access required' });

  const { status } = req.query;

  try {
    let query = supabaseAdmin.from('requests').select('*').order('ts', { ascending: false }).limit(100);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({
      ok: true,
      requests: (data || []).map(r => ({
        id: r.id, ts: r.ts, action: r.action, label: r.label,
        payload: r.payload, requestedBy: r.requested_by, status: r.status,
        reviewedAt: r.reviewed_at, reviewedBy: r.reviewed_by,
      })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
