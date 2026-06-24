// api/save-price-edits.js
// POST /api/save-price-edits — admin only. Body: { priceEdits: { SKU: price, ... } }
import { supabaseAdmin, getUserFromRequest, isAdminProfile } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { user, profile } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  if (!isAdminProfile(profile)) return res.status(403).json({ ok: false, error: 'Admin access required' });

  const { priceEdits } = req.body || {};
  if (!priceEdits || typeof priceEdits !== 'object') {
    return res.status(400).json({ ok: false, error: 'Missing priceEdits object' });
  }

  try {
    const { data: current } = await supabaseAdmin.from('price_edits').select('sku, price');
    const snapshot = {};
    (current || []).forEach(r => { snapshot[r.sku] = r.price; });
    await supabaseAdmin.from('versions').insert({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'priceEdits',
      snapshot,
      saved_by: profile.email,
      note: 'auto-before-save',
    });

    await supabaseAdmin.from('price_edits').delete().neq('sku', '');
    const rows = Object.entries(priceEdits).map(([sku, price]) => ({
      sku, price: Number(price), updated_by: profile.email,
    }));
    if (rows.length) {
      const { error: insertErr } = await supabaseAdmin.from('price_edits').insert(rows);
      if (insertErr) throw insertErr;
    }

    res.status(200).json({ ok: true, saved: rows.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
