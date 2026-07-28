import { supabase } from '../lib/supabase'
import { Account } from '../types'

export const accountService = {
  async getAccounts(userId: string): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getAccount(id: string): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async createAccount(userId: string, account: Omit<Account, 'id'>): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .insert([{ user_id: userId, ...account }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteAccount(id: string): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
