import { supabase } from '../lib/supabase'
import { Transaction } from '../types'

export const transactionService = {
  async getTransactions(userId: string, month?: string): Promise<Transaction[]> {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)

    if (month) {
      // Filter by month (YYYY-MM)
      const startDate = `${month}-01`
      const endDate = `${month}-31`
      query = query.gte('date', startDate).lte('date', endDate)
    }

    const { data, error } = await query.order('date', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getTransaction(id: string): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async createTransaction(userId: string, transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert([{ user_id: userId, ...transaction }])
      .select()
      .single()

    if (error) throw error

    // Add to suggestions if it's a new transaction name
    if (transaction.description) {
      await transactionService.addSuggestion(userId, transaction.description, transaction.category)
    }

    return data
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Transaction suggestions (autocomplete)
  async getSuggestions(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('transaction_suggestions')
      .select('transaction_name')
      .eq('user_id', userId)
      .order('usage_count', { ascending: false })
      .limit(50)

    if (error) throw error
    return data?.map(item => item.transaction_name) || []
  },

  async addSuggestion(userId: string, transactionName: string, categoryId: string): Promise<void> {
    try {
      // Check if suggestion already exists
      const { data: existing } = await supabase
        .from('transaction_suggestions')
        .select('id, usage_count')
        .eq('user_id', userId)
        .eq('transaction_name', transactionName)
        .single()

      if (existing) {
        // Update usage count
        await supabase
          .from('transaction_suggestions')
          .update({ usage_count: existing.usage_count + 1 })
          .eq('id', existing.id)
      } else {
        // Create new suggestion
        await supabase
          .from('transaction_suggestions')
          .insert([{
            user_id: userId,
            transaction_name: transactionName,
            category_id: categoryId
          }])
      }
    } catch (error) {
      // Silently fail for suggestions - not critical
      console.error('Error adding suggestion:', error)
    }
  }
}
