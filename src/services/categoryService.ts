import { supabase } from '../lib/supabase'
import { Category } from '../types'

export const categoryService = {
  async getCategories(userId: string, type?: 'income' | 'expense'): Promise<Category[]> {
    let query = supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query.order('name', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getCategory(id: string): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  async createCategory(userId: string, category: Omit<Category, 'id'>): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .insert([{ user_id: userId, ...category }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}
