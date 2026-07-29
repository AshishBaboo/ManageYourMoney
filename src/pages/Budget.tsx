import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, AlertCircle, X, Trash2, Pencil } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { supabase } from '../lib/supabase'
import { formatCurrency, currencySymbol } from '../lib/currency'
import { ui } from '../lib/ui'
import { Toast, useNotify } from '../components/Toast'

interface Category { id: string; name: string; type: string; icon: string | null; budget_limit: number | null }
interface BudgetRow { id: string; category_id: string; month: string; limit_amount: number }
interface Tx { id: string; category_id: string | null; amount: number; type: string; date: string }

export default function Budget(): JSX.Element {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCat, setShowAddCat] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', type: 'expense', icon: '', limit: '' })
  const [editingLimit, setEditingLimit] = useState<{ categoryId: string; value: string } | null>(null)
  const { notice, notify } = useNotify()

  const monthStr = format(currentMonth, 'yyyy-MM')

  useEffect(() => { load() }, [monthStr])

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [cat, bud, tx] = await Promise.all([
        supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
        supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', monthStr),
        supabase.from('transactions').select('id,category_id,amount,type,date')
          .eq('user_id', user.id)
          .gte('date', `${monthStr}-01`)
          .lte('date', `${monthStr}-31`),
      ])
      if (cat.error) throw cat.error
      setCategories((cat.data || []).map(c => ({ ...c, budget_limit: c.budget_limit == null ? null : Number(c.budget_limit) })))
      setBudgets((bud.data || []).map(b => ({ ...b, limit_amount: Number(b.limit_amount) })))
      setTransactions((tx.data || []).map(t => ({ ...t, amount: Number(t.amount) })))
    } catch (e: any) {
      notify(e.message || 'Failed to load budget', false)
    } finally {
      setLoading(false)
    }
  }

  const addCategory = async () => {
    if (!catForm.name.trim()) return notify('Enter a category name', false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('categories').insert({
        user_id: user.id,
        name: catForm.name.trim(),
        type: catForm.type,
        icon: catForm.icon.trim() || null,
        budget_limit: parseFloat(catForm.limit) || null,
      }).select()
      if (error) throw error
      setCategories([...categories, { ...data[0], budget_limit: data[0].budget_limit == null ? null : Number(data[0].budget_limit) }])
      setCatForm({ name: '', type: 'expense', icon: '', limit: '' })
      setShowAddCat(false)
      notify('Category added')
    } catch (e: any) {
      notify(e.message || 'Failed to add category', false)
    }
  }

  const deleteCategory = async (id: string) => {
    try {
      const { error, count } = await supabase.from('categories').delete({ count: 'exact' }).eq('id', id)
      if (error) throw error
      if (!count) throw new Error('Delete blocked — run supabase-setup.sql')
      setCategories(categories.filter(c => c.id !== id))
      notify('Category deleted')
    } catch (e: any) {
      notify(e.message || 'Failed to delete', false)
    }
  }

  const saveLimit = async () => {
    if (!editingLimit) return
    const value = parseFloat(editingLimit.value)
    if (!value || value <= 0) return notify('Enter a valid limit', false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const existing = budgets.find(b => b.category_id === editingLimit.categoryId)
      if (existing) {
        const { error } = await supabase.from('budgets').update({ limit_amount: value }).eq('id', existing.id)
        if (error) throw error
        setBudgets(budgets.map(b => b.id === existing.id ? { ...b, limit_amount: value } : b))
      } else {
        const { data, error } = await supabase.from('budgets').insert({
          user_id: user.id,
          category_id: editingLimit.categoryId,
          month: monthStr,
          limit_amount: value,
        }).select()
        if (error) throw error
        setBudgets([...budgets, { ...data[0], limit_amount: Number(data[0].limit_amount) }])
      }
      setEditingLimit(null)
      notify(`Budget set for ${format(currentMonth, 'MMMM')}`)
    } catch (e: any) {
      notify(e.message || 'Failed to save budget', false)
    }
  }

  const expenseCategories = categories.filter(c => c.type === 'expense')
  const incomeCategories = categories.filter(c => c.type === 'income')

  const rows = expenseCategories.map(category => {
    const budget = budgets.find(b => b.category_id === category.id)
    const spent = transactions
      .filter(t => t.category_id === category.id && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    const limit = budget?.limit_amount ?? category.budget_limit ?? 0
    const percentage = limit > 0 ? (spent / limit) * 100 : 0
    return { category, spent, limit, percentage, isOver: limit > 0 && spent > limit }
  })

  const totalBudget = rows.reduce((s, r) => s + r.limit, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
  const overall = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
  const overCategories = rows.filter(r => r.isOver)

  if (loading) return <div className={ui.page}><p className={ui.empty}>Loading budget...</p></div>

  return (
    <div className={ui.page}>
      <Toast notice={notice} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className={ui.h1}>Budget</h1>
          <p className={ui.sub}>Categories and monthly limits</p>
        </div>
        <button onClick={() => setShowAddCat(!showAddCat)} className={ui.btnPrimary}>
          <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> New Category</span>
        </button>
      </div>

      {/* Month selector */}
      <div className={`${ui.card} flex items-center justify-between py-2`}>
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Previous month" className={ui.iconBtn}>
          <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
        <h2 className={ui.h2}>{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Next month" className={ui.iconBtn}>
          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Add category form */}
      {showAddCat && (
        <div className={ui.card}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={ui.h2}>New Category</h2>
            <button onClick={() => setShowAddCat(false)} className={ui.iconBtn}><X className="w-3.5 h-3.5 text-gray-500" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className={ui.label}>Name</label>
              <input className={ui.input} placeholder="e.g. Groceries" value={catForm.name}
                onChange={e => setCatForm({ ...catForm, name: e.target.value })} />
            </div>
            <div>
              <label className={ui.label}>Type</label>
              <select className={ui.select} value={catForm.type} onChange={e => setCatForm({ ...catForm, type: e.target.value })}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className={ui.label}>Emoji (optional)</label>
              <input className={ui.input} placeholder="🛒" value={catForm.icon}
                onChange={e => setCatForm({ ...catForm, icon: e.target.value })} />
            </div>
            <div>
              <label className={ui.label}>Monthly Limit ({currencySymbol()})</label>
              <input className={ui.input} type="number" placeholder="0" value={catForm.limit}
                onChange={e => setCatForm({ ...catForm, limit: e.target.value })} />
            </div>
          </div>
          <button onClick={addCategory} className={`${ui.btnPrimary} mt-2 w-full md:w-auto`}>Save Category</button>
        </div>
      )}

      {/* Overall summary */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-3 text-white">
        <div className="grid grid-cols-4 gap-2">
          <div>
            <p className="text-[11px] text-blue-100">Budget</p>
            <p className="text-sm font-semibold">{formatCurrency(totalBudget)}</p>
          </div>
          <div>
            <p className="text-[11px] text-blue-100">Spent</p>
            <p className="text-sm font-semibold">{formatCurrency(totalSpent)}</p>
          </div>
          <div>
            <p className="text-[11px] text-blue-100">Remaining</p>
            <p className={`text-sm font-semibold ${totalBudget - totalSpent < 0 ? 'text-red-300' : 'text-green-300'}`}>
              {formatCurrency(totalBudget - totalSpent)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-blue-100">Usage</p>
            <p className="text-sm font-semibold">{overall.toFixed(0)}%</p>
          </div>
        </div>
        <div className="mt-2 w-full bg-white/20 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${overall > 90 ? 'bg-red-400' : overall > 75 ? 'bg-yellow-400' : 'bg-green-400'}`}
            style={{ width: `${Math.min(overall, 100)}%` }}
          />
        </div>
      </div>

      {/* Over-budget alerts */}
      {overCategories.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-900 rounded-lg p-2.5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <div className="text-xs text-red-800 dark:text-red-300">
            <span className="font-semibold">Over budget: </span>
            {overCategories.map(r => `${r.category.name} (+${formatCurrency(r.spent - r.limit)})`).join(', ')}
          </div>
        </div>
      )}

      {/* Expense categories with budgets */}
      <div className={ui.card}>
        <h2 className={`${ui.h2} mb-2`}>Expense Categories</h2>
        {rows.length === 0 ? (
          <p className={ui.empty}>No expense categories yet — create one to start budgeting.</p>
        ) : (
          <div className="space-y-2.5">
            {rows.map(({ category, spent, limit, percentage, isOver }) => (
              <div key={category.id} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {category.icon && <span className="text-sm">{category.icon}</span>}
                    <p className={`${ui.strong} truncate`}>{category.name}</p>
                    {isOver && <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">OVER</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <p className={ui.sub}>
                      {formatCurrency(spent)} / {limit > 0 ? formatCurrency(limit) : 'no limit'}
                    </p>
                    <button
                      onClick={() => setEditingLimit({ categoryId: category.id, value: limit ? String(limit) : '' })}
                      aria-label={`Edit budget for ${category.name}`}
                      className={ui.iconBtn}
                    >
                      <Pencil className="w-3 h-3 text-gray-500" />
                    </button>
                    <button onClick={() => deleteCategory(category.id)} aria-label={`Delete ${category.name}`} className={ui.iconBtnDanger}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className={ui.progressTrack}>
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      percentage > 100 ? 'bg-red-500' : percentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                {editingLimit?.categoryId === category.id && (
                  <div className="flex gap-1.5 mt-1.5">
                    <input
                      className={ui.input}
                      type="number"
                      placeholder={`Limit for ${format(currentMonth, 'MMMM')}`}
                      value={editingLimit.value}
                      onChange={e => setEditingLimit({ ...editingLimit, value: e.target.value })}
                      autoFocus
                    />
                    <button onClick={saveLimit} className={ui.btnPrimary}>Set</button>
                    <button onClick={() => setEditingLimit(null)} className={ui.btnSecondary}>Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Income categories */}
      <div className={ui.card}>
        <h2 className={`${ui.h2} mb-2`}>Income Categories</h2>
        {incomeCategories.length === 0 ? (
          <p className={ui.empty}>No income categories yet.</p>
        ) : (
          <div className="space-y-1.5">
            {incomeCategories.map(category => {
              const earned = transactions
                .filter(t => t.category_id === category.id && t.type === 'income')
                .reduce((s, t) => s + t.amount, 0)
              return (
                <div key={category.id} className={ui.row}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {category.icon && <span className="text-sm">{category.icon}</span>}
                    <p className={`${ui.strong} truncate`}>{category.name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400">+{formatCurrency(earned)}</p>
                    <button onClick={() => deleteCategory(category.id)} aria-label={`Delete ${category.name}`} className={ui.iconBtnDanger}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
