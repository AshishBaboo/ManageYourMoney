#!/usr/bin/env node
// Delete all budget rows for a given month (the month's "budget")
// node scripts/delete-month-budget.js <email> <password> <YYYY-MM>
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uctmoxfalxyczrttyqto.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjdG1veGZhbHh5Y3pydHR5cXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTkwMDUsImV4cCI6MjEwMDgzNTAwNX0.TesC6oDwR4bndWvqD7aV9VyJzgq-4j_jbMRfT6moiOY'
);

const [email, password, month] = process.argv.slice(2);
if (!/^\d{4}-\d{2}$/.test(month || '')) { console.error('Month must be YYYY-MM'); process.exit(1); }

(async () => {
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { console.error('login failed:', error.message); process.exit(1); }
  const { error: delErr, count } = await supabase.from('budgets')
    .delete({ count: 'exact' })
    .eq('user_id', auth.user.id)
    .eq('month', month);
  if (delErr) { console.error('delete failed:', delErr.message); process.exit(1); }
  console.log(`Deleted ${count} budget row(s) for ${month}`);
  process.exit(0);
})();
