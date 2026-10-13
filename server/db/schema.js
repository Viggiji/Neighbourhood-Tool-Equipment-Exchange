const { createClient } = require('@supabase/supabase-js');

let supabase;

function cleanSupabaseUrl(raw) {
  let u = (raw || '').trim().replace(/\/+$/, '');
  // If user pasted dashboard URL: https://supabase.com/dashboard/project/<ref>/settings/api
  const dashMatch = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashMatch) {
    return `https://${dashMatch[1].toLowerCase()}.supabase.co`;
  }
  // If user pasted with /rest/v1 or /auth/v1 or other path on .supabase.co
  const coMatch = u.match(/https?:\/\/([a-z0-9_-]+)\.supabase\.co/i);
  if (coMatch) {
    return `https://${coMatch[1].toLowerCase()}.supabase.co`;
  }
  return u;
}

function getDb() {
  if (!supabase) {
    const rawUrl = process.env.SUPABASE_URL;
    const key    = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!rawUrl || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    const url = cleanSupabaseUrl(rawUrl);

    supabase = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return supabase;
}

module.exports = { getDb, cleanSupabaseUrl };
