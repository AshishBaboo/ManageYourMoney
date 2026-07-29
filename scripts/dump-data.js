#!/usr/bin/env node
// Dump a user's data to diagnose display issues
// node scripts/dump-data.js <email> <password>
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uctmoxfalxyczrttyqto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjdG1veGZhbHh5Y3pydHR5cXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTkwMDUsImV4cCI6MjEwMDgzNTAwNX0.TesC6oDwR4bndWvqD7aV9VyJzgq-4j_jbMRfT6moiOY'
);

(async () => {
  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email: process.argv[2], password: process.argv[3],
  });
  if (error) { console.error('login failed:', error.message); process.exit(1); }
  const uid = auth.user.id;

  const { data: cats } = await supabase.from('categories').select('*').eq('user_id', uid);
  console.log('CATEGORIES:');
  for (const c of cats || []) {
    console.log(`  ${c.id.slice(0, 8)} | ${c.name} | type=${c.type} | parent=${c.parent_id ? c.parent_id.slice(0, 8) : 'TOP'} | limit=${c.budget_limit}`);
  }

  const { data: buds } = await supabase.from('budgets').select('*').eq('user_id', uid);
  console.log('\nBUDGETS:');
  for (const b of buds || []) {
    console.log(`  cat=${b.category_id.slice(0, 8)} | month=${b.month} | limit=${b.limit_amount}`);
  }

  const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', uid).order('date');
  console.log('\nTRANSACTIONS:');
  for (const t of txs || []) {
    console.log(`  ${t.date} | ${t.type} | ${t.amount} | "${t.description}" | cat=${t.category_id ? t.category_id.slice(0, 8) : 'none'} | acc=${t.account_id ? t.account_id.slice(0, 8) : 'none'}`);
  }

  const { data: accs } = await supabase.from('accounts').select('*').eq('user_id', uid);
  console.log('\nACCOUNTS:');
  for (const a of accs || []) {
    console.log(`  ${a.id.slice(0, 8)} | ${a.name} | ${a.type} | balance=${a.balance}`);
  }
  process.exit(0);
})();
