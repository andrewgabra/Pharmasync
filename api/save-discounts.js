// api/save-discounts.js
// POST /api/save-discounts — admin only. Body: { discounts: { SKU: pct, ... } }
// Snapshots the current table to `versions` before overwriting, then replaces
// the discounts table with the new full set.
import { supabaseAdmin, getUserFromRequest, isAdminProfile } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { user, profile } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  if (!isAdminProfile(profile)) return res.status(403).json({ ok: false, error: 'Admin access required' });

  const { discounts } = req.body || {};
  if (!discounts || typeof discounts !== 'object') {
    return res.status(400).json({ ok: false, error: 'Missing discounts object' });
  }

  try {
    // 1. Snapshot current state for version history
    const { data: current } = await supabaseAdmin.from('discounts').select('sku, pct');
    const snapshot = {};
    (current || []).forEach(r => { snapshot[r.sku] = String(r.pct); });
    await supabaseAdmin.from('versions').insert({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'discounts',
      snapshot,
      saved_by: profile.email,
      note: 'auto-before-save',
    });

    // 2. Replace the table with the new full set
    await supabaseAdmin.from('discounts').delete().neq('sku', '');
    const rows = Object.entries(discounts).map(([sku, pct]) => ({
      sku, pct: Number(pct) || 0, updated_by: profile.email,
    }));
    if (rows.length) {
      const { error: insertErr } = await supabaseAdmin.from('discounts').insert(rows);
      if (insertErr) throw insertErr;
    }

    res.status(200).json({ ok: true, saved: rows.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
