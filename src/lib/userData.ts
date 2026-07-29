import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

// Make sure the public.users row exists (FK target for all data tables).
// Idempotent; safe to call on every login.
export async function ensureUserRow(user: User): Promise<void> {
  try {
    await supabase.from('users').upsert(
      {
        id: user.id,
        email: user.email,
        full_name: (user.user_metadata?.full_name as string) || null,
      },
      { onConflict: 'id' }
    )
  } catch {
    // non-fatal: the signup trigger normally handles this
  }
}

export function displayName(user: User | null): string {
  if (!user) return 'User'
  const name = (user.user_metadata?.full_name as string) || ''
  return name.trim() || user.email?.split('@')[0] || 'User'
}

export function initials(user: User | null): string {
  const name = displayName(user)
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] || 'U'
  const second = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] || '')
  return (first + second).toUpperCase()
}
