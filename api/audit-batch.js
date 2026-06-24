// api/audit-batch.js
// POST /api/audit-batch — admin only. Body: { entries: [{ts, type, sku, oldPrice/oldDisc, newPrice/newDisc, email}, ...] }
import { supabaseAdmin, getUserFromRequest, isAdminProfile } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { user, profile } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  if (!isAdminProfile(profile)) return res.status(403).json({ ok: false, error: 'Admin access required' });

  const { entries } = req.body || {};
  if (!Array.isArray(entries) || !entries.length) {
    return res.status(200).json({ ok: true, added: 0 });
  }

  try {
    const rows = entries.map(e => ({
      ts: new Date(e.ts || Date.now()).toISOString(),
      type: e.type || '',
      sku: e.sku || '',
      old_val: e.oldPrice !== undefined ? String(e.oldPrice) : (e.oldDisc !== undefined ? `${e.oldDisc}%` : ''),
      new_val: e.newPrice !== undefined ? String(e.newPrice) : (e.newDisc !== undefined ? `${e.newDisc}%` : ''),
      email: e.email || profile.email || 'system',
    }));
    const { error } = await supabaseAdmin.from('audit_log').insert(rows);
    if (error) throw error;

    res.status(200).json({ ok: true, added: rows.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
