import { supabase } from '../lib/supabase'
import { SavingsGoal } from '../types'

export const goalService = {
  async getGoals(userId: string): Promise<SavingsGoal[]> {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', userId)
      .order('deadline', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getGoal(id: string): Promise<SavingsGoal> {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async createGoal(userId: string, goal: Omit<SavingsGoal, 'id'>): Promise<SavingsGoal> {
    const { data, error } = await supabase
      .from('savings_goals')
      .insert([{ user_id: userId, ...goal }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const { data, error } = await supabase
      .from('savings_goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteGoal(id: string): Promise<void> {
    const { error } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
