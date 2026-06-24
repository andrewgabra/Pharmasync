// api/restore-version.js
// POST /api/restore-version — admin only. Body: { versionId }
import { supabaseAdmin, getUserFromRequest, isAdminProfile } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { user, profile } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  if (!isAdminProfile(profile)) return res.status(403).json({ ok: false, error: 'Admin access required' });

  const { versionId } = req.body || {};
  if (!versionId) return res.status(400).json({ ok: false, error: 'Missing versionId' });

  try {
    const { data: version, error: vErr } = await supabaseAdmin
      .from('versions').select('*').eq('id', versionId).single();
    if (vErr || !version) return res.status(404).json({ ok: false, error: 'Version not found' });

    const { type, snapshot } = version;
    const restoreNote = `${profile.email} (restored)`;

    if (type === 'discounts') {
      await supabaseAdmin.from('discounts').delete().neq('sku', '');
      const rows = Object.entries(snapshot).map(([sku, pct]) => ({ sku, pct: Number(pct) || 0, updated_by: restoreNote }));
      if (rows.length) await supabaseAdmin.from('discounts').insert(rows);
    } else if (type === 'priceEdits') {
      await supabaseAdmin.from('price_edits').delete().neq('sku', '');
      const rows = Object.entries(snapshot).map(([sku, price]) => ({ sku, price: Number(price), updated_by: restoreNote }));
      if (rows.length) await supabaseAdmin.from('price_edits').insert(rows);
    }

    await supabaseAdmin.from('audit_log').insert({
      type: `restore-${type}`,
      sku: 'ALL',
      old_val: '',
      new_val: `restored from ${version.ts}`,
      email: profile.email,
    });

    res.status(200).json({ ok: true, restored: type, from: version.ts });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
