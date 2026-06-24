// api/versions.js
// GET /api/versions?type=discounts|priceEdits — admin only.
import { supabaseAdmin, getUserFromRequest, isAdminProfile } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { user, profile } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  if (!isAdminProfile(profile)) return res.status(403).json({ ok: false, error: 'Admin access required' });

  const { type } = req.query;

  try {
    let query = supabaseAdmin.from('versions').select('id, ts, type, saved_by, note').order('ts', { ascending: false }).limit(30);
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({
      ok: true,
      versions: (data || []).map(v => ({
        id: v.id, ts: v.ts, type: v.type, savedBy: v.saved_by, note: v.note,
      })),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
