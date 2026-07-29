import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, X, Trash2, Pencil, Copy, AlertCircle, ArrowUp, ArrowDown,
} from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { supabase } from '../lib/supabase'
import { formatCurrency, currencySymbol } from '../lib/currency'
import { ui } from '../lib/ui'
import { Toast, useNotify } from '../components/Toast'
import Loader from '../components/Loader'
import AutocompleteInput from '../components/AutocompleteInput'
import Select from '../components/Select'
import { insertTransaction, occurredAtFor } from '../lib/tx'
import { saveOrder, bySortOrder, defaultAccountId } from '../lib/userData'

interface Category {
  id: string
  name: string
  type: 'income' | 'expense'
  icon: string | null
  color: string | null
  budget_limit: number | null
  parent_id: string | null
  sort_order?: number | null
  created_at?: string
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
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const navigate = useNavigate()

  const toggleSection = (key: string) =>
    setCollapsedSections(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const moveCat = async (list: Category[], index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= list.length) return
    const next = [...list]
    const [item] = next.splice(index, 1)
    next.splice(to, 0, item)
    // optimistic local order
    const orderMap = new Map(next.map((c, i) => [c.id, (i + 1) * 10]))
    setCategories(categories.map(c => orderMap.has(c.id) ? { ...c, sort_order: orderMap.get(c.id)! } : c))
    try {
      await saveOrder(next.map(c => c.id))
      notify('Order saved')
    } catch {
      notify('Failed to save order (run supabase-migration-3)', false)
    }
  }

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
        supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
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
  const tops = (type: 'income' | 'expense') => categories.filter(c => c.type === type && !c.parent_id).sort(bySortOrder)
  const childrenOf = (id: string) => categories.filter(c => c.parent_id === id).sort(bySortOrder)

  const directAmount = (id: string) =>
    monthTx.filter(t => t.category_id === id).reduce((s, t) => s + t.amount, 0)
  const rolledAmount = (cat: Category) =>
    directAmount(cat.id) + childrenOf(cat.id).reduce((s, ch) => s + directAmount(ch.id), 0)

  // Month amounts come ONLY from this month's budget rows — never from a
  // global default, so a budget exists only where the user created it.
  const limitFor = (cat: Category) => budgets.find(x => x.category_id === cat.id)?.limit_amount ?? 0
  const hasRow = (cat: Category) => budgets.some(b => b.category_id === cat.id)
  const inThisMonth = (cat: Category) =>
    hasRow(cat) || childrenOf(cat.id).some(hasRow) || rolledAmount(cat) > 0
  // A parent's budget = its own limit, else the sum of child limits
  const rolledLimit = (cat: Category) => {
    const own = limitFor(cat)
    if (own > 0) return own
    return childrenOf(cat.id).reduce((s, ch) => s + limitFor(ch), 0)
  }

  // Only categories that are part of THIS month's budget (or have spend) appear
  const expenseTops = tops('expense').filter(inThisMonth)
  const incomeTops = tops('income').filter(inThisMonth)
  // categories that exist but aren't part of this month — can be re-added
  const dormantTops = [...tops('income'), ...tops('expense')].filter(c => !inThisMonth(c))

  const addExistingToMonth = async (categoryId: string) => {
    if (!categoryId) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('budgets').insert({
        user_id: user.id, category_id: categoryId, month: monthStr, limit_amount: 0,
      }).select()
      if (error) throw error
      setBudgets(prev => [...prev, { ...data[0], limit_amount: Number(data[0].limit_amount) }])
      setBudgetMonths(prev => [...new Set([monthStr, ...prev])].sort().reverse())
      const cat = categories.find(c => c.id === categoryId)
      notify(`${cat?.name || 'Category'} added to ${format(currentMonth, 'MMMM')} — set its amount with the pencil`)
    } catch (e: any) {
      notify(e.message || 'Failed to add', false)
    }
  }
  const totalBudgeted = expenseTops.reduce((s, c) => s + rolledLimit(c), 0)
  const totalSpent = expenseTops.reduce((s, c) => s + rolledAmount(c), 0)
  const incomeEarned = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const incomeGoal = incomeTops.reduce((s, c) => s + rolledLimit(c), 0)
  const overCats = expenseTops.filter(c => rolledLimit(c) > 0 && rolledAmount(c) > rolledLimit(c))

  const monthHasBudget = budgets.length > 0 || monthTx.length > 0

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
      // always create THIS month's budget row (amount may be 0) — budgets are strictly per-month
      const amt = parseFloat(amount) || 0
      const { data: b, error: be } = await supabase.from('budgets').insert({
        user_id: user.id, category_id: created.id, month: monthStr, limit_amount: amt,
      }).select()
      if (!be && b) setBudgets(prev => [...prev, { ...b[0], limit_amount: Number(b[0].limit_amount) }])
      setBudgetMonths(prev => [...new Set([monthStr, ...prev])].sort().reverse())
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

  // ----- delete this month's budget (rows only — categories & transactions stay) -----
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const deleteMonthBudget = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error, count } = await supabase.from('budgets')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .eq('month', monthStr)
      if (error) throw error
      setBudgets([])
      setBudgetMonths(prev => prev.filter(m => m !== monthStr))
      setConfirmingDelete(false)
      notify(`${format(currentMonth, 'MMMM yyyy')} budget deleted (${count} amounts removed)`)
    } catch (e: any) {
      notify(e.message || 'Failed to delete budget', false)
    }
  }

  // ----- clone a month's budget into another month -----
  const [cloneForm, setCloneForm] = useState<{
    from: string; to: string; income: boolean; expense: boolean; subs: boolean; busy: boolean
  } | null>(null)

  const openClone = () => {
    const from = budgets.length > 0 ? monthStr : (budgetMonths[0] || monthStr)
    const to = format(addMonths(new Date(`${from}-01T00:00:00`), 1), 'yyyy-MM')
    setCloneForm({ from, to, income: true, expense: true, subs: true, busy: false })
  }

  const runClone = async () => {
    if (!cloneForm) return
    if (cloneForm.from === cloneForm.to) return notify('Pick a different target month', false)
    setCloneForm({ ...cloneForm, busy: true })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [srcRes, existingRes] = await Promise.all([
        supabase.from('budgets').select('category_id,limit_amount').eq('user_id', user.id).eq('month', cloneForm.from),
        supabase.from('budgets').select('category_id').eq('user_id', user.id).eq('month', cloneForm.to),
      ])
      if (srcRes.error) throw srcRes.error
      const src = srcRes.data || []
      if (!src.length) throw new Error(`No budget found in ${cloneForm.from}`)
      const already = new Set((existingRes.data || []).map(r => r.category_id))
      const catById = new Map(categories.map(c => [c.id, c]))

      const rows = src.filter(r => {
        const cat = catById.get(r.category_id)
        if (!cat) return false
        if (already.has(r.category_id)) return false
        if (cat.parent_id && !cloneForm.subs) return false
        const topType = cat.parent_id ? catById.get(cat.parent_id)?.type : cat.type
        if (topType === 'income' && !cloneForm.income) return false
        if (topType === 'expense' && !cloneForm.expense) return false
        return true
      }).map(r => ({ user_id: user.id, category_id: r.category_id, month: cloneForm.to, limit_amount: r.limit_amount }))

      if (!rows.length) throw new Error('Nothing selected to copy')
      const { error: insErr } = await supabase.from('budgets').insert(rows)
      if (insErr) throw insErr
      setBudgetMonths(prev => [...new Set([cloneForm.to, ...prev])].sort().reverse())
      setCloneForm(null)
      notify(`Budget created for ${format(new Date(`${cloneForm.to}-01T00:00:00`), 'MMMM yyyy')} (${rows.length} amounts copied)`)
      if (cloneForm.to === monthStr) await load()
      else setCurrentMonth(new Date(`${cloneForm.to}-01T00:00:00`))
    } catch (e: any) {
      setCloneForm(prev => prev ? { ...prev, busy: false } : prev)
      notify(e.message || 'Clone failed', false)
    }
  }

  const openQuickAdd = (categoryId: string) => {
    setQuickAdd({
      categoryId,
      amount: '',
      description: '',
      accountId: defaultAccountId(accounts),
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
      const data = [await insertTransaction({
        user_id: user.id,
        account_id: quickAdd.accountId || null,
        category_id: node.id,
        description,
        amount,
        type: node.type,
        date: quickAdd.date,
        occurred_at: occurredAtFor(quickAdd.date),
      })]
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
          <Select
            className="w-32"
            value={quickAdd.accountId}
            onChange={v => setQuickAdd({ ...quickAdd, accountId: v })}
            placeholder="No account"
            options={[{ value: '', label: 'No account' }, ...accounts.map(a => ({ value: a.id, label: a.name }))]}
          />
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

  const CategoryCard = ({ cat, index, list }: { cat: Category; index: number; list: Category[] }) => {
    const children = childrenOf(cat.id)
    const spent = rolledAmount(cat)
    const limit = rolledLimit(cat)
    const pct = limit > 0 ? (spent / limit) * 100 : 0
    const isOpen = expanded.has(cat.id)
    const isIncome = cat.type === 'income'
    const left = limit - spent

    return (
      <div className={`${ui.card} !p-2`}>
        {/* row 1: avatar, name, spent/limit, quick add */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(`/budget/c/${cat.id}?m=${monthStr}`)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
            aria-label={`Open ${cat.name}`}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
              style={{ backgroundColor: colorFor(cat) }}
            >
              {cat.icon || cat.name[0].toUpperCase()}
            </div>
            <p className={`${ui.strong} truncate flex-1`}>{cat.name}</p>
            <p className="text-[11px] whitespace-nowrap text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(spent)}</span>
              {limit > 0 ? ` / ${formatCurrency(limit)}` : ''} {isIncome ? 'earned' : ''}
            </p>
          </button>
          <button onClick={() => openQuickAdd(cat.id)} aria-label={`Add to ${cat.name}`} className={`${ui.iconBtn} !p-1 text-blue-600 dark:text-blue-400`}>
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* row 2: progress bar with % inside */}
        <div className={`mt-1 relative ${ui.progressTrack} !h-2.5 overflow-hidden`}>
          <div
            className={`h-2.5 rounded-full transition-all ${isIncome ? 'bg-violet-500' : barColor(pct)}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
          <span className={`absolute inset-0 flex items-center justify-center text-[8px] font-semibold ${pct > 40 ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
            {pct.toFixed(1)}%
          </span>
        </div>

        <QuickAddPanel node={cat} />
        <LimitEditor node={cat} />

        {/* row 3: subcats toggle, left amount, actions — one thin line */}
        <div className="mt-1 flex items-center gap-1 text-[10px]">
          <button
            onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n })}
            className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            {children.length} sub{children.length === 1 ? '' : 's'}
          </button>
          <span className={`ml-1.5 font-medium ${
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
          </span>
          <span className="flex-1" />
          <button onClick={() => moveCat(list, index, -1)} aria-label={`Move ${cat.name} up`} className={`${ui.iconBtn} !p-1`} disabled={index === 0}>
            <ArrowUp className={`w-3 h-3 ${index === 0 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-500'}`} />
          </button>
          <button onClick={() => moveCat(list, index, 1)} aria-label={`Move ${cat.name} down`} className={`${ui.iconBtn} !p-1`} disabled={index === list.length - 1}>
            <ArrowDown className={`w-3 h-3 ${index === list.length - 1 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-500'}`} />
          </button>
          <button onClick={() => setEditingLimit({ categoryId: cat.id, value: limitFor(cat) ? String(limitFor(cat)) : '' })} aria-label={`Edit amount for ${cat.name}`} className={`${ui.iconBtn} !p-1`}>
            <Pencil className="w-3 h-3 text-gray-500" />
          </button>
          <button onClick={() => deleteCategory(cat.id)} aria-label={`Delete ${cat.name}`} className={`${ui.iconBtnDanger} !p-1`}>
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

  if (loading) return <div className={ui.page}><Loader label="Loading budget..." /></div>

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
      {monthHasBudget && (
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
      )}

      {/* No budget for this month yet */}
      {!monthHasBudget && (
        <div className={`${ui.card} text-center py-5`}>
          <p className={`${ui.strong} mb-1`}>No budget for {format(currentMonth, 'MMMM yyyy')}</p>
          <p className={`${ui.sub} mb-3`}>Budgets exist only for months you create. Copy an existing budget or start fresh.</p>
          <div className="flex justify-center gap-2">
            {budgetMonths.length > 0 && (
              <button onClick={openClone} className={ui.btnPrimary}>
                <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> Copy existing budget</span>
              </button>
            )}
            <button onClick={() => setShowAddCat(true)} className={ui.btnSecondary}>
              <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> Start fresh</span>
            </button>
          </div>
        </div>
      )}

      {/* Clone dialog */}
      {cloneForm && (
        <div className={`${ui.card} border-l-4 border-l-blue-600`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={ui.h2}>Copy budget to a new month</h2>
            <button onClick={() => setCloneForm(null)} className={ui.iconBtn}><X className="w-3.5 h-3.5 text-gray-500" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className={ui.label}>Copy from</label>
              <Select
                value={cloneForm.from}
                onChange={from => setCloneForm({ ...cloneForm, from, to: format(addMonths(new Date(`${from}-01T00:00:00`), 1), 'yyyy-MM') })}
                options={[...new Set([monthStr, ...budgetMonths])].sort().reverse().map(m => ({
                  value: m,
                  label: format(new Date(`${m}-01T00:00:00`), 'MMMM yyyy'),
                }))}
              />
            </div>
            <div>
              <label className={ui.label}>Create for</label>
              <input className={ui.input} type="month" value={cloneForm.to}
                onChange={e => setCloneForm({ ...cloneForm, to: e.target.value })} />
              <p className={`${ui.sub} mt-0.5`}>
                {format(new Date(`${cloneForm.to}-01T00:00:00`), 'dd MMM')} – {format(new Date(new Date(`${cloneForm.to}-01T00:00:00`).getFullYear(), new Date(`${cloneForm.to}-01T00:00:00`).getMonth() + 1, 0), 'dd MMM yyyy')}
              </p>
            </div>
          </div>
          <div className="space-y-1 mb-2">
            {([
              ['income', 'Copy income categories & goals'],
              ['expense', 'Copy expense categories & budgets'],
              ['subs', 'Include subcategories & their amounts'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 accent-blue-600"
                  checked={cloneForm[key]}
                  onChange={e => setCloneForm({ ...cloneForm, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
          <button onClick={runClone} disabled={cloneForm.busy} className={ui.btnPrimary}>
            {cloneForm.busy ? 'Creating...' : `Create ${format(new Date(`${cloneForm.to}-01T00:00:00`), 'MMMM')} budget`}
          </button>
        </div>
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

      {/* New category / clone / delete month */}
      {monthHasBudget && (
        <div className="flex items-center justify-between">
          <h2 className={ui.h2}>Categories</h2>
          <div className="flex gap-1.5">
            {budgets.length > 0 && (
              <button
                onClick={() => setConfirmingDelete(true)}
                aria-label={`Delete ${format(currentMonth, 'MMMM')} budget`}
                title="Delete this month's budget"
                className={ui.btnDanger}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
            <button onClick={openClone} className={ui.btnSecondary}>
              <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> Clone month</span>
            </button>
            <button onClick={() => setShowAddCat(!showAddCat)} className={ui.btnPrimary}>
              <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> New Category</span>
            </button>
          </div>
        </div>
      )}

      {/* Re-add an existing (dormant) category to this month */}
      {dormantTops.length > 0 && (
        <div className={`${ui.card} flex items-center gap-2 !py-2`}>
          <p className={`${ui.sub} shrink-0`}>Add existing category:</p>
          <Select
            className="flex-1"
            value=""
            onChange={addExistingToMonth}
            placeholder={`${dormantTops.length} not in ${format(currentMonth, 'MMMM')}`}
            options={dormantTops.map(c => ({
              value: c.id,
              label: `${c.icon ? `${c.icon} ` : ''}${c.name}`,
              group: c.type === 'income' ? 'Income' : 'Expenses',
            }))}
          />
        </div>
      )}

      {/* Confirm month-budget deletion */}
      {confirmingDelete && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-900 rounded-lg p-2.5">
          <p className="text-xs text-red-800 dark:text-red-300 mb-2">
            Delete the <span className="font-semibold">{format(currentMonth, 'MMMM yyyy')}</span> budget?
            All budgeted amounts for this month are removed. Your categories and transactions are NOT deleted.
          </p>
          <div className="flex gap-1.5">
            <button onClick={deleteMonthBudget} className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 transition">
              Yes, delete {format(currentMonth, 'MMMM')} budget
            </button>
            <button onClick={() => setConfirmingDelete(false)} className={ui.btnSecondary}>Cancel</button>
          </div>
        </div>
      )}

      {showAddCat && (
        <div className={ui.card}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={ui.h2}>New Category</h2>
            <button onClick={() => setShowAddCat(false)} className={ui.iconBtn}><X className="w-3.5 h-3.5 text-gray-500" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <input className={ui.input} placeholder="Name (e.g. House Expenses)" value={catForm.name}
              onChange={e => setCatForm({ ...catForm, name: e.target.value })} autoFocus />
            <Select
              value={catForm.type}
              onChange={v => setCatForm({ ...catForm, type: v as 'income' | 'expense' })}
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
            />
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
              <button onClick={() => toggleSection('income')} className="w-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                <h2 className={ui.h2}>Income</h2>
                <span className={ui.sub}>({incomeTops.length})</span>
                <span className="flex-1" />
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${collapsedSections.has('income') ? '' : 'rotate-180'}`} />
              </button>
              {!collapsedSections.has('income') && (
                <div className="space-y-2">
                  {incomeTops.map((cat, i) => <CategoryCard key={cat.id} cat={cat} index={i} list={incomeTops} />)}
                </div>
              )}
            </>
          )}
          {expenseTops.length > 0 && (
            <>
              <button onClick={() => toggleSection('expense')} className="w-full flex items-center gap-1.5 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <h2 className={ui.h2}>Expenses</h2>
                <span className={ui.sub}>({expenseTops.length})</span>
                <span className="flex-1" />
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${collapsedSections.has('expense') ? '' : 'rotate-180'}`} />
              </button>
              {!collapsedSections.has('expense') && (
                <div className="space-y-2">
                  {expenseTops.map((cat, i) => <CategoryCard key={cat.id} cat={cat} index={i} list={expenseTops} />)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
