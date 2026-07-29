#!/usr/bin/env node
/**
 * Audit the DB as a real user: what data exists, what operations actually work.
 * Run: node scripts/audit-db.js <email> <password>
 */
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
const password = process.argv[3];

const supabase = createClient(
  'https://uctmoxfalxyczrttyqto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjdG1veGZhbHh5Y3pydHR5cXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTkwMDUsImV4cCI6MjEwMDgzNTAwNX0.TesC6oDwR4bndWvqD7aV9VyJzgq-4j_jbMRfT6moiOY'
);

const TABLES = ['users', 'accounts', 'categories', 'budgets', 'transactions', 'savings_goals', 'transaction_suggestions'];

(async () => {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) { console.error('LOGIN FAILED:', authErr.message); process.exit(1); }
  const uid = auth.user.id;
  console.log(`Logged in: ${email}`);
  console.log(`User ID: ${uid}`);
  console.log(`Metadata:`, JSON.stringify(auth.user.user_metadata));
  console.log('');

  // 1. Dump all rows visible in every table
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select('*');
    if (error) {
      console.log(`[${t}] SELECT ERROR: ${error.message}`);
    } else {
      console.log(`[${t}] ${data.length} rows visible`);
      for (const row of data) {
        const label = row.name || row.description || row.transaction_name || row.email || row.month || row.id;
        console.log(`   - ${label} | ${JSON.stringify(row).slice(0, 160)}`);
      }
    }
  }
  console.log('');

  // 2. Does my users row exist? (FK target for everything)
  const { data: me } = await supabase.from('users').select('*').eq('id', uid);
  console.log(`users row for me exists: ${me && me.length > 0}`);

  // 2b. If missing, can I insert it?
  if (!me || me.length === 0) {
    const { error: insErr } = await supabase.from('users').insert({ id: uid, email, full_name: auth.user.user_metadata?.full_name || 'User' });
    console.log(insErr ? `users INSERT failed: ${insErr.message}` : 'users INSERT succeeded');
  }

  // 3. Test account insert with VALID type
  const { data: accIns, error: accErr } = await supabase.from('accounts')
    .insert({ user_id: uid, name: '__audit_test__', type: 'savings', balance: 1 }).select();
  console.log(accErr ? `accounts INSERT (type=savings) failed: ${accErr.message}` : `accounts INSERT (type=savings) succeeded: ${accIns[0].id}`);

  // 4. Test account insert with INVALID type 'Bank' (what the Dashboard currently sends)
  const { error: bankErr } = await supabase.from('accounts')
    .insert({ user_id: uid, name: '__audit_bank__', type: 'Bank', balance: 1 }).select();
  console.log(bankErr ? `accounts INSERT (type=Bank) failed: ${bankErr.message}` : `accounts INSERT (type=Bank) SUCCEEDED (unexpected)`);

  // 5. Test DELETE (checks whether DELETE policies exist)
  if (accIns && accIns[0]) {
    const { error: delErr, count } = await supabase.from('accounts').delete({ count: 'exact' }).eq('id', accIns[0].id);
    console.log(delErr ? `accounts DELETE failed: ${delErr.message}` : `accounts DELETE affected ${count} rows ${count === 0 ? '(RLS BLOCKS DELETE — no policy!)' : '(works)'}`);
  }

  // 6. Clean up any leftover audit rows from previous runs (best effort)
  await supabase.from('accounts').delete().like('name', '__audit%');

  process.exit(0);
})();
