// api/clear-audit-log.js
// POST /api/clear-audit-log — admin only.
import { supabaseAdmin, getUserFromRequest, isAdminProfile } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { user, profile } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  if (!isAdminProfile(profile)) return res.status(403).json({ ok: false, error: 'Admin access required' });

  try {
    const { error } = await supabaseAdmin.from('audit_log').delete().neq('id', 0);
    if (error) throw error;
    res.status(200).json({ ok: true, cleared: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
