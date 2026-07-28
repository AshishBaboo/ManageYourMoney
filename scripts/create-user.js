#!/usr/bin/env node
/**
 * Create a user in Supabase Auth
 * Run: node scripts/create-user.js <email> <password> <fullName>
 *
 * Example:
 *   node scripts/create-user.js nandinit887@gmail.com "Notsecure@3010" "Nandini T"
 */

import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
const password = process.argv[3];
const fullName = process.argv[4] || 'User';

if (!email || !password) {
  console.error('Usage: node scripts/create-user.js <email> <password> [fullName]');
  process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uctmoxfalxyczrttyqto.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjdG1veGZhbHh5Y3pydHR5cXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNTkwMDUsImV4cCI6MjEwMDgzNTAwNX0.TesC6oDwR4bndWvqD7aV9VyJzgq-4j_jbMRfT6moiOY';

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    console.log(`Creating user: ${email}...`);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (error) {
      console.error('Error creating user:', error.message);
      process.exit(1);
    }

    console.log('✓ User created successfully!');
    console.log(`  Email: ${email}`);
    console.log(`  Name: ${fullName}`);
    console.log(`  User ID: ${data.user?.id}`);

    if (data.user?.email_confirmed_at) {
      console.log('  ✓ Email confirmed');
    } else {
      console.log('  ⚠ Confirmation email will be sent');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
