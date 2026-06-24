// api/_supabase.js
// Server-side Supabase client using the SERVICE ROLE key.
// This file is never sent to the browser — it only runs inside /api routes.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.warn('[PharmaSync] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Verifies the bearer token sent by the browser and returns the user + profile (with role).
// Every write-capable API route should call this first.
export async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return { user: null, profile: null };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { user: null, profile: null };

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  return { user: data.user, profile };
}

export function isAdminProfile(profile) {
  return !!profile && profile.role === 'admin';
}
