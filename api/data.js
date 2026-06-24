// api/data.js
// GET /api/data — returns discounts, price edits, recent audit log, and
// pending-request count. Readable by any logged-in user (staff or admin).
import { supabaseAdmin, getUserFromRequest } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { user } = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });

  try {
    const [discRes, peRes, auditRes, pendingRes] = await Promise.all([
      supabaseAdmin.from('discounts').select('sku, pct'),
      supabaseAdmin.from('price_edits').select('sku, price'),
      supabaseAdmin.from('audit_log').select('*').order('ts', { ascending: false }).limit(300),
      supabaseAdmin.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);

    const discounts = {};
    (discRes.data || []).forEach(r => { discounts[r.sku] = String(r.pct); });

    const priceEdits = {};
    (peRes.data || []).forEach(r => { priceEdits[r.sku] = r.price; });

    const auditLog = (auditRes.data || []).map(r => ({
      ts: new Date(r.ts).getTime(),
      type: r.type,
      sku: r.sku,
      oldVal: r.old_val,
      newVal: r.new_val,
      email: r.email,
    }));

    res.status(200).json({
      ok: true,
      discounts,
      priceEdits,
      auditLog,
      pendingRequestCount: pendingRes.count || 0,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
