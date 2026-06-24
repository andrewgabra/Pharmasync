// api/approve-request.js
// POST /api/approve-request — admin only. Body: { requestId }
// Applies the requested change exactly as the equivalent direct admin action would,
// then marks the request approved and logs it to the audit trail.
import { supabaseAdmin, getUserFromRequest, isAdminProfile } from './_supabase.js';

async function applyDiscounts(discounts, email) {
  const { data: current } = await supabaseAdmin.from('discounts').select('sku, pct');
  const snapshot = {};
  (current || []).forEach(r => { snapshot[r.sku] = String(r.pct); });
  await supabaseAdmin.from('versions').insert({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'discounts', snapshot, saved_by: email, note: 'auto-before-approve',
  });
  await supabaseAdmin.from('discounts').delete().neq('sku', '');
  const rows = Object.entries(discounts).map(([sku, pct]) => ({ sku, pct: Number(pct) || 0, updated_by: email }));
  if (rows.length) await supabaseAdmin.from('discounts').insert(rows);
  return { saved: rows.length };
}

async function applyPriceEdits(priceEdits, email) {
  const { data: current } = await supabaseAdmin.from('price_edits').select('sku, price');
  const snapshot = {};
  (current || []).forEach(r => { snapshot[r.sku] = r.price; });
  await supabaseAdmin.from('versions').insert({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'priceEdits', snapshot, saved_by: email, note: 'auto-before-approve',
  });
  await supabaseAdmin.from('price_edits').delete().neq('sku', '');
  const rows = Object.entries(priceEdits).map(([sku, price]) => ({ sku, price: Number(price), updated_by: email }));
  if (rows.length) await supabaseAdmin.from('price_edits').insert(rows);
  return { saved: rows.length };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { user, profile } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  if (!isAdminProfile(profile)) return res.status(403).json({ ok: false, error: 'Admin access required' });

  const { requestId } = req.body || {};
  if (!requestId) return res.status(400).json({ ok: false, error: 'Missing requestId' });

  try {
    const { data: reqRow, error: rErr } = await supabaseAdmin
      .from('requests').select('*').eq('id', requestId).single();
    if (rErr || !reqRow) return res.status(404).json({ ok: false, error: 'Request not found' });
    if (reqRow.status !== 'pending') {
      return res.status(400).json({ ok: false, error: `Request already ${reqRow.status}` });
    }

    let result = {};
    const adminEmail = profile.email;
    const requestedBy = reqRow.requested_by;

    if (reqRow.action === 'clearDiscounts') {
      result = await applyDiscounts({}, `${requestedBy} (approved by ${adminEmail})`);
    } else if (reqRow.action === 'saveDiscounts') {
      result = await applyDiscounts(reqRow.payload?.discounts || {}, `${requestedBy} (approved by ${adminEmail})`);
    } else if (reqRow.action === 'clearPriceEdits') {
      result = await applyPriceEdits({}, `${requestedBy} (approved by ${adminEmail})`);
    } else if (reqRow.action === 'savePriceEdits') {
      result = await applyPriceEdits(reqRow.payload?.priceEdits || {}, `${requestedBy} (approved by ${adminEmail})`);
    } else {
      return res.status(400).json({ ok: false, error: `Unknown request action: ${reqRow.action}` });
    }

    await supabaseAdmin.from('requests').update({
      status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: adminEmail,
    }).eq('id', requestId);

    await supabaseAdmin.from('audit_log').insert({
      type: 'request-approved',
      sku: reqRow.label || reqRow.action,
      old_val: '',
      new_val: `approved by ${adminEmail}`,
      email: requestedBy,
    });

    res.status(200).json({ ok: true, approved: true, action: reqRow.action, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
