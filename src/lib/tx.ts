import { supabase } from './supabase'
import { formatDate, formatDateTime } from './dateFormat'

// occurred_at for a chosen date: now if today, else noon of that day
export function occurredAtFor(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return dateStr === today ? new Date().toISOString() : `${dateStr}T12:00:00`
}

// Insert that tolerates a DB without migration 3 (occurred_at column)
export async function insertTransaction(payload: Record<string, unknown>) {
  let { data, error } = await supabase.from('transactions').insert(payload).select()
  if (error && /occurred_at/i.test(error.message)) {
    const { occurred_at: _drop, ...rest } = payload
    ;({ data, error } = await supabase.from('transactions').insert(rest).select())
  }
  if (error) throw error
  return data![0]
}

export async function updateTransaction(id: string, patch: Record<string, unknown>) {
  let { error } = await supabase.from('transactions').update(patch).eq('id', id)
  if (error && /occurred_at/i.test(error.message)) {
    const { occurred_at: _drop, ...rest } = patch
    ;({ error } = await supabase.from('transactions').update(rest).eq('id', id))
  }
  if (error) throw error
}

export function txTime(t: { occurred_at?: string | null; date: string }): number {
  return new Date(t.occurred_at || `${t.date}T12:00:00`).getTime()
}

export function formatTxDate(t: { occurred_at?: string | null; date: string }): string {
  return t.occurred_at ? formatDateTime(t.occurred_at) : formatDate(t.date)
}

export function sortTx<T extends { occurred_at?: string | null; date: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => txTime(b) - txTime(a))
}
