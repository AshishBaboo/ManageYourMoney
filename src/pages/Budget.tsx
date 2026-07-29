import { useEffect, useState } from 'react'
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, X, Trash2, Pencil, Copy, AlertCircle,
} from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { supabase } from '../lib/supabase'
import { formatCurrency, currencySymbol } from '../lib/currency'
import { ui } from '../lib/ui'
import { Toast, useNotify } from '../components/Toast'
import AutocompleteInput from '../components/AutocompleteInput'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  icon: string | null
  color: string | null
  budget_limit: number | null
  parent_id: string | null
}
interface BudgetRow { id: string; category_id: string; month: string; limit_amount: number }
interface Tx { id: string; category_id: string | null; account_id: string | null; description: string; amount: number; type: string; date: string }
interface Account { id: string; name: string; balance: number }

const PALETTE = ['#22c55e', '#3b82f6', '#f97316', '#ec4899', '#ef4444', '#8b5cf6', '#14b8a6', '#eab308', '#6366f1', '#84cc16']
const colorFor = (c: Category) => c.color || PALETTE[[...c.name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % PALETTE.length]
const barColor = (pct: number) => (pct > 100 ? 'bg-red-500' : pct > 75 ? 'bg-orange-400' : 'bg-green-500')

export default function Budget(): JSX.Element {
  // Always opens on the CURRENT month — that's the budget that matters day-to-day
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [monthTx, setMonthTx] = useState<Tx[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [budgetMonths, setBudgetMonths] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const { notice, notify } = useNotify()

  const [showAddCat, setShowAddCat] = useState(false)
  const [catForm, setCatForm] = useState({ name: '', type: 'expense' as 'income' | 'expense', amount: '' })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [subForm, setSubForm] = useState<{ parentId: string; name: string; amount: string } | null>(null)
  const [editingLimit, setEditingLimit] = useState<{ categoryId: string; value: string } | null>(null)
  const [quickAdd, setQuickAdd] = useState<{ categoryId: string; amount: string; description: string; accountId: string; date: string } | null>(null)
  const [showMonthList, setShowMonthList] = useState(false)

  const monthStr = format(currentMonth, 'yyyy-MM')

  useEffect(() => { load() }, [monthStr])

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [cat, bud, tx, acc, sug, allBud] = await Promise.all([
        supabase.from('categories').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', monthStr),
        supabase.from('transactions').select('id,category_id,account_id,description,amount,type,date')
          .eq('user_id', user.id).gte('date', `${monthStr}-01`).lte('date', `${monthStr}-31`),
        supabase.from('accounts').select('id,name,balance').eq('user_id', user.id).order('created_at'),
        supabase.from('transactions').select('description').eq('user_id', user.id).order('date', { ascending: false }).limit(200),
        supabase.from('budgets').select('month').eq('user_id', user.id),
      ])
      if (cat.error) throw cat.error
      setCategories((cat.data || []).map(c => ({ ...c, budget_limit: c.budget_limit == null ? null : Number(c.budget_limit) })))
      setBudgets((bud.data || []).map(b => ({ ...b, limit_amount: Number(b.limit_amount) })))
      setMonthTx((tx.data || []).map(t => ({ ...t, amount: Number(t.amount) })))
      setAccounts((acc.data || []).map(a => ({ ...a, balance: Number(a.balance) })))
      setSuggestions([...new Set((sug.data || []).map(s => s.description))])
      setBudgetMonths([...new Set((allBud.data || []).map(b => b.month))].sort().reverse())
    } catch (e: any) {
      notify(e.message || 'Failed to load budget', false)
    } finally {
      setLoading(false)
    }
  }

  // ----- tree + rollups -----
  const tops = (type: 'income' | 'expense') => categories.filter(c => c.type === type && !c.parent_id)
  const childrenOf = (id: string) => categories.filter(c => c.parent_id === id)

  const directAmount = (id: string) =>
    monthTx.filter(t => t.category_id === id).reduce((s, t) => s + t.amount, 0)
  const rolledAmount = (cat: Category) =>
    directAmount(cat.id) + childrenOf(cat.id).reduce((s, ch) => s + directAmount(ch.id), 0)

  const limitFor = (cat: Category) => {
    const b = budgets.find(x => x.category_id === cat.id)
    return b?.limit_amount ?? cat.budget_limit ?? 0
  }
  // A parent's budget = its own limit, else the sum of child limits
  const rolledLimit = (cat: Category) => {
    const own = limitFor(cat)
    if (own > 0) return own
    return childrenOf(cat.id).reduce((s, ch) => s + limitFor(ch), 0)
  }

  const expenseTops = tops('expense')
  const incomeTops = tops('income')
  const totalBudgeted = expenseTops.reduce((s, c) => s + rolledLimit(c), 0)
  const totalSpent = expenseTops.reduce((s, c) => s + rolledAmount(c), 0)
  const incomeEarned = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const incomeGoal = incomeTops.reduce((s, c) => s + rolledLimit(c), 0)
  const overCats = expenseTops.filter(c => rolledLimit(c) > 0 && rolledAmount(c) > rolledLimit(c))

  const prevMonthStr = format(subMonths(currentMonth, 1), 'yyyy-MM')
  const monthHasBudget = budgets.length > 0
  const canCopyPrev = !monthHasBudget && budgetMonths.includes(prevMonthStr)

  // ----- actions -----
  const addCategory = async (parentId: string | null, name: string, type: 'income' | 'expense', amount: string) => {
    if (!name.trim()) return notify('Enter a name', false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const payload: Record<string, unknown> = {
        user_id: user.id,
        name: name.trim(),
        type,
        color: PALETTE[categories.length % PALETTE.length],
        budget_limit: parseFloat(amount) || null,
      }
      if (parentId) payload.parent_id = parentId
      const { data, error } = await supabase.from('categories').insert(payload).select()
      if (error) throw error
      const created = { ...data[0], budget_limit: data[0].budget_limit == null ? null : Number(data[0].budget_limit) }
      setCategories(prev => [...prev, created])
      // also create this month's budget row so the amount is month-scoped from day one
      const amt = parseFloat(amount)
      if (amt > 0) {
        const { data: b, error: be } = await supabase.from('budgets').insert({
          user_id: user.id, category_id: created.id, month: monthStr, limit_amount: amt,
        }).select()
        if (!be && b) setBudgets(prev => [...prev, { ...b[0], limit_amount: Number(b[0].limit_amount) }])
      }
      if (parentId) setExpanded(prev => new Set(prev).add(parentId))
      notify(`${parentId ? 'Subcategory' : 'Category'} added`)
      return true
    } catch (e: any) {
      notify(e.message || 'Failed to add', false)
      return false
    }
  }

  const deleteCategory = async (id: string) => {
    try {
      const { error, count } = await supabase.from('categories').delete({ count: 'exact' }).eq('id', id)
      if (error) throw error
      if (!count) throw new Error('Delete failed')
      setCategories(prev => prev.filter(c => c.id !== id && c.parent_id !== id))
      notify('Deleted')
    } catch (e: any) {
      notify(e.message || 'Failed to delete', false)
    }
  }

  const saveLimit = async () => {
    if (!editingLimit) return
    const value = parseFloat(editingLimit.value)
    if (!value || value <= 0) return notify('Enter a valid amount', false)
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
          user_id: user.id, category_id: editingLimit.categoryId, month: monthStr, limit_amount: value,
        }).select()
        if (error) throw error
        setBudgets([...budgets, { ...data[0], limit_amount: Number(data[0].limit_amount) }])
      }
      setEditingLimit(null)
      notify(`Amount set for ${format(currentMonth, 'MMMM')}`)
    } catch (e: any) {
      notify(e.message || 'Failed to save', false)
    }
  }

  const copyPreviousMonth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prev, error } = await supabase.from('budgets').select('category_id,limit_amount')
        .eq('user_id', user.id).eq('month', prevMonthStr)
      if (error) throw error
      if (!prev?.length) return notify('Nothing to copy from last month', false)
      const rows = prev.map(p => ({ user_id: user.id, category_id: p.category_id, month: monthStr, limit_amount: p.limit_amount }))
      const { data: inserted, error: insErr } = await supabase.from('budgets').insert(rows).select()
      if (insErr) throw insErr
      setBudgets((inserted || []).map(b => ({ ...b, limit_amount: Number(b.limit_amount) })))
      setBudgetMonths(prev2 => [...new Set([monthStr, ...prev2])].sort().reverse())
      notify(`Copied ${prev.length} budget amounts from ${format(subMonths(currentMonth, 1), 'MMMM')}`)
    } catch (e: any) {
      notify(e.message || 'Copy failed', false)
    }
  }

  const openQuickAdd = (categoryId: string) => {
    setQuickAdd({
      categoryId,
      amount: '',
      description: '',
      accountId: accounts[0]?.id || '',
      date: new Date().toISOString().slice(0, 10),
    })
  }

  const saveQuickAdd = async () => {
    if (!quickAdd) return
    const amount = parseFloat(quickAdd.amount)
    if (!amount || amount <= 0) return notify('Enter an amount', false)
    const node = categories.find(c => c.id === quickAdd.categoryId)
    if (!node) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const description = quickAdd.description.trim() || node.name
      const { data, error } = await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: quickAdd.accountId || null,
        category_id: node.id,
        description,
        amount,
        type: node.type,
        date: quickAdd.date,
      }).select()
      if (error) throw error
      // sync account balance
      const acc = accounts.find(a => a.id === quickAdd.accountId)
      if (acc) {
        const newBalance = acc.balance + (node.type === 'income' ? amount : -amount)
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', acc.id)
        setAccounts(accounts.map(a => a.id === acc.id ? { ...a, balance: newBalance } : a))
      }
      setMonthTx([{ ...data[0], amount: Number(data[0].amount) }, ...monthTx])
      setSuggestions(prev => [...new Set([description, ...prev])])
      setQuickAdd(null)
      notify(`${node.type === 'income' ? 'Income' : 'Expense'} added to ${node.name}`)
    } catch (e: any) {
      notify(e.message || 'Failed to add', false)
    }
  }

  // ----- render helpers -----
  const QuickAddPanel = ({ node }: { node: Category }) => quickAdd?.categoryId === node.id ? (
    <div className="mt-1.5 p-2 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20 space-y-1.5">
      <div className="flex gap-1.5">
        <input
          className={ui.input}
          type="number"
          placeholder={`Amount (${currencySymbol()})`}
          value={quickAdd.amount}
          onChange={e => setQuickAdd({ ...quickAdd, amount: e.target.value })}
          autoFocus
        />
        <input
          className={ui.input}
          type="date"
          value={quickAdd.date}
          onChange={e => setQuickAdd({ ...quickAdd, date: e.target.value })}
        />
      </div>
      <div className="flex gap-1.5">
        <div className="flex-1">
          <AutocompleteInput
            value={quickAdd.description}
            onChange={v => setQuickAdd(q => q ? { ...q, description: v } : q)}
            suggestions={suggestions}
            placeholder={`Description (optional, default "${node.name}")`}
          />
        </div>
        {accounts.length > 0 && (
          <select
            className={`${ui.select} w-32`}
            value={quickAdd.accountId}
            onChange={e => setQuickAdd({ ...quickAdd, accountId: e.target.value })}
          >
            <option value="">No account</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>
      <div className="flex gap-1.5">
        <button onClick={saveQuickAdd} className={ui.btnPrimary}>Save</button>
        <button onClick={() => setQuickAdd(null)} className={ui.btnSecondary}>Cancel</button>
      </div>
    </div>
  ) : null

  const LimitEditor = ({ node }: { node: Category }) => editingLimit?.categoryId === node.id ? (
    <div className="flex gap-1.5 mt-1.5">
      <input
        className={ui.input}
        type="number"
        placeholder={`${node.type === 'income' ? 'Goal' : 'Budget'} for ${format(currentMonth, 'MMMM')}`}
        value={editingLimit.value}
        onChange={e => setEditingLimit({ ...editingLimit, value: e.target.value })}
        autoFocus
      />
      <button onClick={saveLimit} className={ui.btnPrimary}>Set</button>
      <button onClick={() => setEditingLimit(null)} className={ui.btnSecondary}>Cancel</button>
    </div>
  ) : null

  const CategoryCard = ({ cat }: { cat: Category }) => {
    const children = childrenOf(cat.id)
    const spent = rolledAmount(cat)
    const limit = rolledLimit(cat)
    const pct = limit > 0 ? (spent / limit) * 100 : 0
    const isOpen = expanded.has(cat.id)
    const isIncome = cat.type === 'income'
    const left = limit - spent

    return (
      <div className={`${ui.card} !p-2.5`}>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
            style={{ backgroundColor: colorFor(cat) }}
          >
            {cat.icon || cat.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className={`${ui.strong} truncate`}>{cat.name}</p>
              <p className={ui.sub}>{isIncome ? 'Goal' : 'Budgeted'} <span className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(limit)}</span></p>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {formatCurrency(spent)} <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">{isIncome ? 'earned' : 'spent'}</span>
            </p>
          </div>
          <button onClick={() => openQuickAdd(cat.id)} aria-label={`Add to ${cat.name}`} className={`${ui.iconBtn} !p-2 text-blue-600 dark:text-blue-400`}>
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* progress — % inside the bar, colored Left callout */}
        <div className="mt-1.5">
          <div className={`relative ${ui.progressTrack} !h-3.5 overflow-hidden`}>
            <div
              className={`h-3.5 rounded-full transition-all ${isIncome ? 'bg-violet-500' : barColor(pct)}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
            <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-semibold ${pct > 40 ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
              {pct.toFixed(2)}%
            </span>
          </div>
          <p className={`mt-0.5 text-[10px] font-medium ${
            limit <= 0 ? 'text-gray-400 dark:text-gray-500'
            : left < 0 ? (isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-500')
            : pct > 75 ? 'text-orange-500'
            : 'text-green-600 dark:text-green-400'
          }`}>
            {limit > 0
              ? left < 0
                ? `${isIncome ? '+' : '-'}${formatCurrency(Math.abs(left))} ${isIncome ? 'over goal 🎉' : 'over'}`
                : `${formatCurrency(left)} Left`
              : 'No amount set'}
          </p>
        </div>

        <QuickAddPanel node={cat} />
        <LimitEditor node={cat} />

        {/* actions row */}
        <div className="mt-1.5 flex items-center gap-1 text-[11px]">
          <button
            onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n })}
            className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            {children.length} subcategor{children.length === 1 ? 'y' : 'ies'}
          </button>
          <span className="flex-1" />
          <button onClick={() => setEditingLimit({ categoryId: cat.id, value: limitFor(cat) ? String(limitFor(cat)) : '' })} aria-label={`Edit amount for ${cat.name}`} className={ui.iconBtn}>
            <Pencil className="w-3 h-3 text-gray-500" />
          </button>
          <button onClick={() => deleteCategory(cat.id)} aria-label={`Delete ${cat.name}`} className={ui.iconBtnDanger}>
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* subcategories */}
        {isOpen && (
          <div className="mt-1.5 pl-3 border-l-2 border-gray-100 dark:border-gray-700 space-y-1.5">
            {children.map(sub => {
              const sSpent = directAmount(sub.id)
              const sLimit = limitFor(sub)
              const sPct = sLimit > 0 ? (sSpent / sLimit) * 100 : 0
              return (
                <div key={sub.id} className="py-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className={`${ui.strong} flex-1 truncate`}>{sub.name}</p>
                    <p className={ui.sub}>{formatCurrency(sSpent)}{sLimit > 0 ? ` / ${formatCurrency(sLimit)}` : ''}</p>
                    <button onClick={() => openQuickAdd(sub.id)} aria-label={`Add to ${sub.name}`} className={`${ui.iconBtn} text-blue-600 dark:text-blue-400`}>
                      <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={() => setEditingLimit({ categoryId: sub.id, value: sLimit ? String(sLimit) : '' })} aria-label={`Edit amount for ${sub.name}`} className={ui.iconBtn}>
                      <Pencil className="w-2.5 h-2.5 text-gray-500" />
                    </button>
                    <button onClick={() => deleteCategory(sub.id)} aria-label={`Delete ${sub.name}`} className={ui.iconBtnDanger}>
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  {sLimit > 0 && (
                    <div className={`mt-1 ${ui.progressTrack}`}>
                      <div className={`h-1.5 rounded-full ${cat.type === 'income' ? 'bg-violet-400' : barColor(sPct)}`} style={{ width: `${Math.min(sPct, 100)}%` }} />
                    </div>
                  )}
                  <QuickAddPanel node={sub} />
                  <LimitEditor node={sub} />
                </div>
              )
            })}

            {subForm?.parentId === cat.id ? (
              <div className="flex gap-1.5">
                <input className={ui.input} placeholder="Subcategory name" value={subForm.name}
                  onChange={e => setSubForm({ ...subForm, name: e.target.value })} autoFocus />
                <input className={`${ui.input} !w-24`} type="number" placeholder={currencySymbol()} value={subForm.amount}
                  onChange={e => setSubForm({ ...subForm, amount: e.target.value })} />
                <button
                  onClick={async () => { if (await addCategory(cat.id, subForm.name, cat.type, subForm.amount)) setSubForm(null) }}
                  className={ui.btnPrimary}
                >Add</button>
                <button onClick={() => setSubForm(null)} className={ui.btnSecondary}>✕</button>
              </div>
            ) : (
              <button onClick={() => setSubForm({ parentId: cat.id, name: '', amount: '' })} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
                <Plus className="w-3 h-3" /> Add subcategory
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className={ui.page}><p className={ui.empty}>Loading budget...</p></div>

  return (
    <div className={ui.page}>
      <Toast notice={notice} />

      {/* Month header — tap the month name to see all budget months */}
      <div className={`${ui.card} !py-2 relative`}>
        <div className="flex items-center justify-between">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Previous month" className={ui.iconBtn}>
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <button onClick={() => setShowMonthList(!showMonthList)} className="flex items-center gap-1">
            <h1 className={ui.h2}>{format(currentMonth, 'MMMM yyyy')}</h1>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showMonthList ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Next month" className={ui.iconBtn}>
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        {showMonthList && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30 py-1 max-h-56 overflow-auto">
            <button
              onClick={() => { setCurrentMonth(new Date()); setShowMonthList(false) }}
              className="w-full text-left px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Today — {format(new Date(), 'MMMM yyyy')}
            </button>
            {budgetMonths.map(m => (
              <button
                key={m}
                onClick={() => { setCurrentMonth(new Date(`${m}-01T00:00:00`)); setShowMonthList(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 ${m === monthStr ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}
              >
                {format(new Date(`${m}-01T00:00:00`), 'MMMM yyyy')}
              </button>
            ))}
            {budgetMonths.length === 0 && <p className="px-3 py-1.5 text-xs text-gray-500">No budgets yet</p>}
          </div>
        )}
      </div>

      {/* Overview — iSaveMoney style: income, provisional balance, budgeted, remaining, saving donut */}
      <div className={`${ui.card} !p-3`}>
        <div className="flex gap-3">
          <div className="flex-1 min-w-0 space-y-2.5">
            <div>
              <p className={ui.sub}>Total Income</p>
              <p className="text-base font-semibold text-green-600 dark:text-green-400">{formatCurrency(incomeEarned)}</p>
              {incomeGoal > 0 && (
                <div className={`mt-1 ${ui.progressTrack}`}>
                  <div className="h-1.5 rounded-full bg-green-500" style={{ width: `${Math.min((incomeEarned / incomeGoal) * 100, 100)}%` }} />
                </div>
              )}
              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                Provisional Balance <span className="font-semibold">{formatCurrency(incomeEarned - totalBudgeted)}</span>
              </p>
            </div>
            <div>
              <p className={ui.sub}>Total Budgeted</p>
              <p className="text-base font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(totalBudgeted)}</p>
              {totalBudgeted > 0 && (
                <div className={`mt-1 relative ${ui.progressTrack} !h-2 overflow-hidden`}>
                  <div
                    className={`h-2 rounded-full ${totalSpent / totalBudgeted > 1 ? 'bg-red-500' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min((totalSpent / totalBudgeted) * 100, 100)}%` }}
                  />
                </div>
              )}
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                Remaining to spend <span className="font-semibold">{formatCurrency(totalBudgeted - totalSpent)}</span>
              </p>
            </div>
          </div>

          {/* Saving donut */}
          <div className="flex flex-col items-center justify-center shrink-0 w-28">
            <p className="text-[10px] text-violet-600 dark:text-violet-400">Saving</p>
            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-1">{formatCurrency(incomeEarned - totalSpent)}</p>
            {(() => {
              const spentPct = incomeEarned > 0 ? Math.min((totalSpent / incomeEarned) * 100, 100) : 0
              return (
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-gray-200 dark:stroke-gray-600" strokeWidth="3.4" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#8b5cf6" strokeWidth="3.4"
                      strokeDasharray={`${100 - spentPct} ${spentPct}`} strokeLinecap="round" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22c55e" strokeWidth="3.4"
                      strokeDasharray={`${spentPct} ${100 - spentPct}`} strokeDashoffset={-(100 - spentPct)} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[8px] text-gray-500 dark:text-gray-400 leading-none">Income spent</span>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {incomeEarned > 0 ? Math.round((totalSpent / incomeEarned) * 100) : 0}%
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Copy last month */}
      {canCopyPrev && (
        <button onClick={copyPreviousMonth} className={`${ui.card} w-full flex items-center justify-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20`}>
          <Copy className="w-3.5 h-3.5" /> Copy {format(subMonths(currentMonth, 1), 'MMMM')}'s budget into {format(currentMonth, 'MMMM')}
        </button>
      )}

      {/* Over budget alert */}
      {overCats.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-900 rounded-lg p-2.5 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <div className="text-xs text-red-800 dark:text-red-300">
            <span className="font-semibold">Over budget: </span>
            {overCats.map(c => `${c.name} (+${formatCurrency(rolledAmount(c) - rolledLimit(c))})`).join(', ')}
          </div>
        </div>
      )}

      {/* New category */}
      <div className="flex items-center justify-between">
        <h2 className={ui.h2}>Categories</h2>
        <button onClick={() => setShowAddCat(!showAddCat)} className={ui.btnPrimary}>
          <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> New Category</span>
        </button>
      </div>

      {showAddCat && (
        <div className={ui.card}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={ui.h2}>New Category</h2>
            <button onClick={() => setShowAddCat(false)} className={ui.iconBtn}><X className="w-3.5 h-3.5 text-gray-500" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <input className={ui.input} placeholder="Name (e.g. House Expenses)" value={catForm.name}
              onChange={e => setCatForm({ ...catForm, name: e.target.value })} autoFocus />
            <select className={ui.select} value={catForm.type} onChange={e => setCatForm({ ...catForm, type: e.target.value as any })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <input className={ui.input} type="number" placeholder={`${catForm.type === 'income' ? 'Goal' : 'Budget'} for ${format(currentMonth, 'MMM')} (${currencySymbol()})`} value={catForm.amount}
              onChange={e => setCatForm({ ...catForm, amount: e.target.value })} />
          </div>
          <button
            onClick={async () => {
              if (await addCategory(null, catForm.name, catForm.type, catForm.amount)) {
                setCatForm({ name: '', type: 'expense', amount: '' })
                setShowAddCat(false)
              }
            }}
            className={`${ui.btnPrimary} mt-2 w-full md:w-auto`}
          >
            Save Category
          </button>
        </div>
      )}

      {/* Income always on top, Expenses below */}
      {expenseTops.length === 0 && incomeTops.length === 0 ? (
        <div className={ui.card}>
          <p className={ui.empty}>No categories yet. Create categories and subcategories once — every month reuses them, so adding an expense takes seconds.</p>
        </div>
      ) : (
        <>
          {incomeTops.length > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                <h2 className={ui.h2}>Income</h2>
              </div>
              <div className="space-y-2">
                {incomeTops.map(cat => <CategoryCard key={cat.id} cat={cat} />)}
              </div>
            </>
          )}
          {expenseTops.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <h2 className={ui.h2}>Expenses</h2>
              </div>
              <div className="space-y-2">
                {expenseTops.map(cat => <CategoryCard key={cat.id} cat={cat} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
