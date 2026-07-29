import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import { applyTheme } from './theme'
import { setCurrency } from './currency'

// Pull saved theme/currency from the users row so preferences follow the
// account onto any device. Silently no-ops if migration 3 isn't applied.
export async function syncPrefsFromDb(userId: string): Promise<void> {
  try {
    const { data } = await supabase.from('users').select('theme,currency').eq('id', userId).single()
    if (data?.theme === 'dark' || data?.theme === 'light') applyTheme(data.theme)
    if (data?.currency) setCurrency(data.currency)
  } catch {
    // column may not exist yet — localStorage still works
  }
}

export async function savePrefToDb(userId: string, patch: { theme?: string; currency?: string }): Promise<void> {
  try {
    await supabase.from('users').update(patch).eq('id', userId)
  } catch {
    // non-fatal
  }
}

// Persist a new order: writes sort_order = index*10 for the given ids
export async function saveOrder(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id, i) =>
    supabase.from('categories').update({ sort_order: (i + 1) * 10 }).eq('id', id)
  ))
}

// The starred account (or the first one) — pre-selected in transaction forms
export function defaultAccountId<T extends { id: string; is_default?: boolean | null }>(accounts: T[]): string {
  return accounts.find(a => a.is_default)?.id || accounts[0]?.id || ''
}

export function bySortOrder<T extends { sort_order?: number | null; created_at?: string }>(a: T, b: T): number {
  const sa = a.sort_order ?? 999999
  const sb = b.sort_order ?? 999999
  if (sa !== sb) return sa - sb
  return (a.created_at || '').localeCompare(b.created_at || '')
}

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
