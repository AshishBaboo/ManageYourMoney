import { supabase } from '../lib/supabase'
import { Budget } from '../types'

export const budgetService = {
  async getBudgets(userId: string, month?: string): Promise<Budget[]> {
    let query = supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)

    if (month) {
      query = query.eq('month', month)
    }

    const { data, error } = await query.order('month', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getBudget(id: string): Promise<Budget> {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async createBudget(userId: string, budget: Omit<Budget, 'id'>): Promise<Budget> {
    const { data, error } = await supabase
      .from('budgets')
      .insert([{ user_id: userId, ...budget }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
    const { data, error } = await supabase
      .from('budgets')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteBudget(id: string): Promise<void> {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
