import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Plus, Pencil, Trash2, Check, X, ArrowUp, ArrowDown,
} from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { supabase } from '../lib/supabase'
import { formatCurrency, currencySymbol } from '../lib/currency'
import { ui } from '../lib/ui'
import { Toast, useNotify } from '../components/Toast'
import Loader from '../components/Loader'
import AutocompleteInput from '../components/AutocompleteInput'
import Select from '../components/Select'
import { useConfirm } from '../components/ConfirmDialog'
import { insertTransaction, updateTransaction, occurredAtFor, formatTxDate, sortTx } from '../lib/tx'
import { saveOrder, bySortOrder, defaultAccountId } from '../lib/userData'

interface Category {
  id: string; name: string; type: 'income' | 'expense'; icon: string | null; color: string | null
  budget_limit: number | null; parent_id: string | null; sort_order?: number | null; created_at?: string
}
interface BudgetRow { id: string; category_id: string; month: string; limit_amount: number }
interface Tx { id: string; category_id: string | null; account_id: string | null; description: string; amount: number; type: string; date: string; occurred_at?: string | null }
interface Account { id: string; name: string; balance: number }

export default function CategoryDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const monthStr = searchParams.get('m') || format(new Date(), 'yyyy-MM')
  const currentMonth = new Date(`${monthStr}-01T00:00:00`)

  const [category, setCategory] = useState<Category | null>(null)
  const [subs, setSubs] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [txs, setTxs] = useState<Tx[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const { notice, notify } = useNotify()
  const { confirm, confirmDialog } = useConfirm()

  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [subForm, setSubForm] = useState<{ name: string; amount: string } | null>(null)
  const [editingLimit, setEditingLimit] = useState<{ categoryId: string; value: string } | null>(null)
  const [quickAdd, setQuickAdd] = useState<{ categoryId: string; amount: string; description: string; accountId: string; date: string } | null>(null)
  const [editingTx, setEditingTx] = useState<{ id: string; description: string; amount: string; date: string } | null>(null)

  useEffect(() => { load() }, [id, monthStr])

  const load = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !id) return
      const [catRes, allCats, bud, acc, sug] = await Promise.all([
        supabase.from('categories').select('*').eq('id', id).single(),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', monthStr),
        supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('transactions').select('description').eq('user_id', user.id).order('date', { ascending: false }).limit(200),
      ])
      if (catRes.error) throw catRes.error
      const cat = { ...catRes.data, budget_limit: catRes.data.budget_limit == null ? null : Number(catRes.data.budget_limit) }
      setCategory(cat)
      const children = (allCats.data || [])
        .filter((c: any) => c.parent_id === id)
        .map((c: any) => ({ ...c, budget_limit: c.budget_limit == null ? null : Number(c.budget_limit) }))
        .sort(bySortOrder)
      setSubs(children)
      setBudgets((bud.data || []).map((b: any) => ({ ...b, limit_amount: Number(b.limit_amount) })))
      setAccounts((acc.data || []).map((a: any) => ({ ...a, balance: Number(a.balance) })))
      setSuggestions([...new Set((sug.data || []).map((s: any) => s.description as string))])

      const ids = [id, ...children.map((c: Category) => c.id)]
      const { data: txData, error: txErr } = await supabase.from('transactions').select('*')
        .eq('user_id', user.id).in('category_id', ids)
        .gte('date', `${monthStr}-01`).lte('date', `${monthStr}-31`)
      if (txErr) throw txErr
      setTxs(sortTx((txData || []).map((t: any) => ({ ...t, amount: Number(t.amount) }))))
    } catch (e: any) {
      notify(e.message || 'Failed to load', false)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className={ui.page}><Loader label="Loading category..." /></div>
  if (!category) return <div className={ui.page}><p className={ui.empty}>Category not found.</p></div>

  const isIncome = category.type === 'income'
  // amounts are strictly per-month: only this month's budget rows count
  const limitFor = (catId: string, _fallback: number | null) =>
    budgets.find(b => b.category_id === catId)?.limit_amount ?? 0
  const spentFor = (catId: string) => txs.filter(t => t.category_id === catId).reduce((s, t) => s + t.amount, 0)

  const ownLimit = limitFor(category.id, category.budget_limit)
  const subLimitSum = subs.reduce((s, c) => s + limitFor(c.id, c.budget_limit), 0)
  const totalLimit = ownLimit > 0 ? ownLimit : subLimitSum
  const subSpentSum = subs.reduce((s, c) => s + spentFor(c.id), 0)
  const totalSpent = spentFor(category.id) + subSpentSum
  const pct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0
  const generalTx = txs.filter(t => t.category_id === category.id)

  const setMonth = (d: Date) => setSearchParams({ m: format(d, 'yyyy-MM') })

  // ---------- actions ----------
  const saveRename = async () => {
    if (!renaming || !renaming.name.trim()) return
    const { error } = await supabase.from('categories').update({ name: renaming.name.trim() }).eq('id', renaming.id)
    if (error) return notify(error.message, false)
    if (renaming.id === category.id) setCategory({ ...category, name: renaming.name.trim() })
    else setSubs(subs.map(s => s.id === renaming.id ? { ...s, name: renaming.name.trim() } : s))
    setRenaming(null)
    notify('Renamed')
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

  const addSub = async () => {
    if (!subForm || !subForm.name.trim()) return notify('Enter a name', false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('categories').insert({
        user_id: user.id, name: subForm.name.trim(), type: category.type, parent_id: category.id,
        budget_limit: parseFloat(subForm.amount) || null,
        sort_order: (subs.length + 1) * 10,
      }).select()
      if (error) throw error
      const created = { ...data[0], budget_limit: data[0].budget_limit == null ? null : Number(data[0].budget_limit) }
      setSubs([...subs, created])
      const amt = parseFloat(subForm.amount) || 0
      const { data: b } = await supabase.from('budgets').insert({
        user_id: user.id, category_id: created.id, month: monthStr, limit_amount: amt,
      }).select()
      if (b) setBudgets(prev => [...prev, { ...b[0], limit_amount: Number(b[0].limit_amount) }])
      setSubForm(null)
      notify('Subcategory added')
    } catch (e: any) {
      notify(e.message || 'Failed to add', false)
    }
  }

  const deleteSub = async (subId: string) => {
    const sub = subs.find(s => s.id === subId)
    if (!(await confirm(`Delete subcategory "${sub?.name}"? Removed from all months; its transactions stay.`))) return
    const { error, count } = await supabase.from('categories').delete({ count: 'exact' }).eq('id', subId)
    if (error || !count) return notify(error?.message || 'Delete failed', false)
    setSubs(subs.filter(s => s.id !== subId))
    notify('Deleted')
  }

  const moveSub = async (index: number, dir: -1 | 1) => {
    const to = index + dir
    if (to < 0 || to >= subs.length) return
    const next = [...subs]
    const [item] = next.splice(index, 1)
    next.splice(to, 0, item)
    setSubs(next)
    try {
      await saveOrder(next.map(s => s.id))
      notify('Order saved')
    } catch {
      notify('Failed to save order', false)
    }
  }

  const openQuickAdd = (categoryId: string) => setQuickAdd({
    categoryId, amount: '', description: '',
    accountId: defaultAccountId(accounts),
    date: new Date().toISOString().slice(0, 10),
  })

  const saveQuickAdd = async () => {
    if (!quickAdd) return
    const amount = parseFloat(quickAdd.amount)
    if (!amount || amount <= 0) return notify('Enter an amount', false)
    const node = quickAdd.categoryId === category.id ? category : subs.find(s => s.id === quickAdd.categoryId)
    if (!node) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const description = quickAdd.description.trim() || node.name
      const created = await insertTransaction({
        user_id: user.id,
        account_id: quickAdd.accountId || null,
        category_id: node.id,
        description, amount,
        type: category.type,
        date: quickAdd.date,
        occurred_at: occurredAtFor(quickAdd.date),
      })
      const acc = accounts.find(a => a.id === quickAdd.accountId)
      if (acc) {
        const newBalance = acc.balance + (category.type === 'income' ? amount : -amount)
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', acc.id)
        setAccounts(accounts.map(a => a.id === acc.id ? { ...a, balance: newBalance } : a))
      }
      setTxs(sortTx([{ ...created, amount: Number(created.amount) }, ...txs]))
      setQuickAdd(null)
      notify(`Added to ${node.name}`)
    } catch (e: any) {
      notify(e.message || 'Failed to add', false)
    }
  }

  const saveTxEdit = async () => {
    if (!editingTx) return
    const amount = parseFloat(editingTx.amount)
    if (!amount || amount <= 0) return notify('Enter a valid amount', false)
    const old = txs.find(t => t.id === editingTx.id)
    if (!old) return
    try {
      await updateTransaction(editingTx.id, {
        description: editingTx.description.trim() || old.description,
        amount,
        date: editingTx.date,
        occurred_at: editingTx.date === old.date ? undefined : occurredAtFor(editingTx.date),
      })
      // adjust account balance by the delta
      if (old.account_id && amount !== old.amount) {
        const acc = accounts.find(a => a.id === old.account_id)
        if (acc) {
          const delta = (category.type === 'income' ? 1 : -1) * (amount - old.amount)
          await supabase.from('accounts').update({ balance: acc.balance + delta }).eq('id', acc.id)
          setAccounts(accounts.map(a => a.id === acc.id ? { ...a, balance: a.balance + delta } : a))
        }
      }
      setTxs(sortTx(txs.map(t => t.id === editingTx.id
        ? { ...t, description: editingTx.description.trim() || t.description, amount, date: editingTx.date }
        : t)))
      setEditingTx(null)
      notify('Transaction updated')
    } catch (e: any) {
      notify(e.message || 'Failed to update', false)
    }
  }

  const deleteTx = async (tx: Tx) => {
    if (!(await confirm(`Delete "${tx.description}" (${formatCurrency(tx.amount)})? The account balance will be adjusted back.`))) return
    const { error, count } = await supabase.from('transactions').delete({ count: 'exact' }).eq('id', tx.id)
    if (error || !count) return notify(error?.message || 'Delete failed', false)
    if (tx.account_id) {
      const acc = accounts.find(a => a.id === tx.account_id)
      if (acc) {
        const newBalance = acc.balance + (tx.type === 'income' ? -tx.amount : tx.amount)
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', acc.id)
        setAccounts(accounts.map(a => a.id === acc.id ? { ...a, balance: newBalance } : a))
      }
    }
    setTxs(txs.filter(t => t.id !== tx.id))
    notify('Transaction deleted')
  }

  // ---------- small renderers ----------
  // Plain render functions, NOT nested components — component definitions inside
  // the page remount on every keystroke and steal input focus (esp. on mobile)
  const renderTxRow = (tx: Tx) => editingTx?.id === tx.id ? (
    <div className="p-2 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20 space-y-1.5">
      <input className={ui.input} value={editingTx.description} placeholder="Description"
        onChange={e => setEditingTx({ ...editingTx, description: e.target.value })} />
      <div className="flex gap-1.5">
        <input className={ui.input} type="number" value={editingTx.amount} placeholder="Amount"
          onChange={e => setEditingTx({ ...editingTx, amount: e.target.value })} />
        <input className={ui.input} type="date" value={editingTx.date}
          onChange={e => setEditingTx({ ...editingTx, date: e.target.value })} />
      </div>
      <div className="flex gap-1.5">
        <button onClick={saveTxEdit} className={ui.btnPrimary}><span className="flex items-center gap-1"><Check className="w-3 h-3" /> Save</span></button>
        <button onClick={() => setEditingTx(null)} className={ui.btnSecondary}>Cancel</button>
      </div>
    </div>
  ) : (
    <div className={ui.row}>
      <div className="flex-1 min-w-0">
        <p className={`${ui.strong} truncate`}>{tx.description}</p>
        <p className={ui.sub}>{formatTxDate(tx)}</p>
      </div>
      <p className={`text-xs font-semibold mx-1.5 whitespace-nowrap ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {formatCurrency(tx.amount)}
      </p>
      <button onClick={() => setEditingTx({ id: tx.id, description: tx.description, amount: String(tx.amount), date: tx.date })} aria-label="Edit transaction" className={ui.iconBtn}>
        <Pencil className="w-3 h-3 text-gray-500" />
      </button>
      <button onClick={() => deleteTx(tx)} aria-label="Delete transaction" className={ui.iconBtnDanger}>
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )

  const renderQuickAdd = (nodeId: string, nodeName: string) => quickAdd?.categoryId === nodeId ? (
    <div className="mt-1.5 p-2 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20 space-y-1.5">
      <div className="flex gap-1.5">
        <input className={ui.input} type="number" placeholder={`Amount (${currencySymbol()})`} value={quickAdd.amount}
          onChange={e => setQuickAdd({ ...quickAdd, amount: e.target.value })} autoFocus />
        <input className={ui.input} type="date" value={quickAdd.date}
          onChange={e => setQuickAdd({ ...quickAdd, date: e.target.value })} />
      </div>
      <div className="flex gap-1.5">
        <div className="flex-1">
          <AutocompleteInput value={quickAdd.description}
            onChange={v => setQuickAdd(q => q ? { ...q, description: v } : q)}
            suggestions={suggestions} placeholder={`Description (default "${nodeName}")`} />
        </div>
        {accounts.length > 0 && (
          <Select
            className="w-28"
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

  return (
    <div className={ui.page}>
      <Toast notice={notice} />
      {confirmDialog}

      {/* Header with back */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/budget')} aria-label="Back to budget" className={ui.iconBtn}>
          <ArrowLeft className="w-4 h-4 text-gray-700 dark:text-gray-200" />
        </button>
        {renaming?.id === category.id ? (
          <div className="flex-1 flex gap-1.5">
            <input className={ui.input} value={renaming.name} onChange={e => setRenaming({ ...renaming, name: e.target.value })} autoFocus />
            <button onClick={saveRename} className={ui.btnPrimary}><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setRenaming(null)} className={ui.btnSecondary}><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <>
            <h1 className={`${ui.h1} flex-1 truncate`}>{category.icon ? `${category.icon} ` : ''}{category.name}</h1>
            <button onClick={() => setRenaming({ id: category.id, name: category.name })} aria-label="Rename category" className={ui.iconBtn}>
              <Pencil className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </>
        )}
      </div>

      {/* Month nav */}
      <div className={`${ui.card} !py-2 flex items-center justify-between`}>
        <button onClick={() => setMonth(subMonths(currentMonth, 1))} aria-label="Previous month" className={ui.iconBtn}>
          <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
        <h2 className={ui.h2}>{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setMonth(addMonths(currentMonth, 1))} aria-label="Next month" className={ui.iconBtn}>
          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Summary tiles */}
      <div className={`${ui.card} !p-3`}>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-md border border-amber-200 dark:border-amber-900">
            <p className={ui.sub}>{isIncome ? 'Total earned' : 'Spending'}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(totalSpent)}</p>
          </div>
          <div className="p-2 rounded-md border border-sky-200 dark:border-sky-900">
            <p className={ui.sub}>{isIncome ? 'Goal to reach' : 'Actual Budgeted'}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(totalLimit)}</p>
          </div>
          <div className="p-2 rounded-md border border-amber-200 dark:border-amber-900">
            <p className={ui.sub}>Remaining {isIncome ? 'to earn' : 'to spend'}</p>
            <p className={`text-sm font-semibold ${totalLimit - totalSpent < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
              {formatCurrency(totalLimit - totalSpent)}
            </p>
          </div>
          <div className="p-2 rounded-md border border-sky-200 dark:border-sky-900">
            <p className={ui.sub}>Total Subcategories</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(subSpentSum)}</p>
          </div>
        </div>
        <div className={`mt-2 relative ${ui.progressTrack} !h-3.5 overflow-hidden`}>
          <div className={`h-3.5 rounded-full ${isIncome ? 'bg-violet-500' : pct > 100 ? 'bg-red-500' : pct > 75 ? 'bg-orange-400' : 'bg-green-500'}`}
            style={{ width: `${Math.min(pct, 100)}%` }} />
          <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-semibold ${pct > 40 ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
            {pct.toFixed(2)}%
          </span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <button onClick={() => setSubForm(subForm ? null : { name: '', amount: '' })} className={ui.btnSecondary}>
            <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> Subcategory</span>
          </button>
          <button onClick={() => setEditingLimit({ categoryId: category.id, value: ownLimit ? String(ownLimit) : '' })} className={ui.btnSecondary}>
            <span className="flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit {isIncome ? 'goal' : 'budget'}</span>
          </button>
          <button onClick={() => openQuickAdd(category.id)} className={ui.btnPrimary}>
            <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> Add</span>
          </button>
        </div>
        {editingLimit?.categoryId === category.id && (
          <div className="flex gap-1.5 mt-1.5">
            <input className={ui.input} type="number" value={editingLimit.value} autoFocus
              placeholder={`${isIncome ? 'Goal' : 'Budget'} for ${format(currentMonth, 'MMMM')}`}
              onChange={e => setEditingLimit({ ...editingLimit, value: e.target.value })} />
            <button onClick={saveLimit} className={ui.btnPrimary}>Set</button>
            <button onClick={() => setEditingLimit(null)} className={ui.btnSecondary}>Cancel</button>
          </div>
        )}
        {renderQuickAdd(category.id, category.name)}
        {subForm && (
          <div className="flex gap-1.5 mt-1.5">
            <input className={ui.input} placeholder="Subcategory name" value={subForm.name}
              onChange={e => setSubForm({ ...subForm, name: e.target.value })} autoFocus />
            <input className={`${ui.input} !w-28`} type="number" placeholder={`${currencySymbol()} amount`} value={subForm.amount}
              onChange={e => setSubForm({ ...subForm, amount: e.target.value })} />
            <button onClick={addSub} className={ui.btnPrimary}>Add</button>
          </div>
        )}
      </div>

      {/* Subcategories with their transactions */}
      {subs.map((sub, idx) => {
        const sSpent = spentFor(sub.id)
        const sLimit = limitFor(sub.id, sub.budget_limit)
        const sPct = sLimit > 0 ? (sSpent / sLimit) * 100 : 0
        const sTx = txs.filter(t => t.category_id === sub.id)
        const isOpen = expanded.has(sub.id)
        return (
          <div key={sub.id} className={`${ui.card} !p-2.5`}>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(sub.id) ? n.delete(sub.id) : n.add(sub.id); return n })}
                aria-label={`Toggle ${sub.name}`} className={ui.iconBtn}
              >
                <ChevronDown className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              <div className="flex-1 min-w-0">
                {renaming?.id === sub.id ? (
                  <div className="flex gap-1.5">
                    <input className={ui.input} value={renaming.name} onChange={e => setRenaming({ ...renaming, name: e.target.value })} autoFocus />
                    <button onClick={saveRename} className={ui.btnPrimary}><Check className="w-3 h-3" /></button>
                    <button onClick={() => setRenaming(null)} className={ui.btnSecondary}><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <>
                    <p className={`${ui.strong} truncate`}>{sub.name}</p>
                    <p className={`text-[10px] ${sPct > 100 ? 'text-red-500 font-semibold' : 'text-blue-600 dark:text-blue-400'}`}>
                      {formatCurrency(sSpent)}{sLimit > 0 ? ` of ${formatCurrency(sLimit)} ${isIncome ? 'reached' : 'spent'} • ${formatCurrency(Math.abs(sLimit - sSpent))} ${sLimit - sSpent < 0 ? 'over' : isIncome ? 'away' : 'remaining'}` : ` • no ${isIncome ? 'goal' : 'budget'} set`}
                    </p>
                  </>
                )}
              </div>
              <button onClick={() => moveSub(idx, -1)} aria-label={`Move ${sub.name} up`} className={ui.iconBtn} disabled={idx === 0}>
                <ArrowUp className={`w-3 h-3 ${idx === 0 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-500'}`} />
              </button>
              <button onClick={() => moveSub(idx, 1)} aria-label={`Move ${sub.name} down`} className={ui.iconBtn} disabled={idx === subs.length - 1}>
                <ArrowDown className={`w-3 h-3 ${idx === subs.length - 1 ? 'text-gray-300 dark:text-gray-600' : 'text-gray-500'}`} />
              </button>
              <button onClick={() => openQuickAdd(sub.id)} aria-label={`Add to ${sub.name}`} className={`${ui.iconBtn} text-blue-600 dark:text-blue-400`}>
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setRenaming({ id: sub.id, name: sub.name })} aria-label={`Rename ${sub.name}`} className={ui.iconBtn}>
                <Pencil className="w-3 h-3 text-gray-500" />
              </button>
              <button onClick={() => setEditingLimit({ categoryId: sub.id, value: sLimit ? String(sLimit) : '' })} aria-label={`Edit amount for ${sub.name}`} className={ui.iconBtn}>
                <span className="text-[10px] font-semibold text-gray-500">{currencySymbol()}</span>
              </button>
              <button onClick={() => deleteSub(sub.id)} aria-label={`Delete ${sub.name}`} className={ui.iconBtnDanger}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {sLimit > 0 && (
              <div className={`mt-1.5 relative ${ui.progressTrack} !h-2.5 overflow-hidden`}>
                <div className={`h-2.5 rounded-full ${isIncome ? 'bg-violet-500' : sPct > 100 ? 'bg-red-500' : sPct > 75 ? 'bg-orange-400' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(sPct, 100)}%` }} />
                <span className={`absolute inset-0 flex items-center justify-center text-[8px] font-semibold ${sPct > 40 ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                  {sPct.toFixed(2)}%
                </span>
              </div>
            )}

            {editingLimit?.categoryId === sub.id && (
              <div className="flex gap-1.5 mt-1.5">
                <input className={ui.input} type="number" value={editingLimit.value} autoFocus
                  placeholder={`Amount for ${format(currentMonth, 'MMMM')}`}
                  onChange={e => setEditingLimit({ ...editingLimit, value: e.target.value })} />
                <button onClick={saveLimit} className={ui.btnPrimary}>Set</button>
                <button onClick={() => setEditingLimit(null)} className={ui.btnSecondary}>Cancel</button>
              </div>
            )}
            {renderQuickAdd(sub.id, sub.name)}

            {isOpen && (
              <div className="mt-1.5 space-y-1">
                {sTx.length === 0
                  ? <p className={ui.empty}>No transactions this month</p>
                  : sTx.map(tx => <div key={tx.id}>{renderTxRow(tx)}</div>)}
              </div>
            )}
          </div>
        )
      })}

      {/* Transactions directly on the category */}
      {generalTx.length > 0 && (
        <div className={ui.card}>
          <h2 className={`${ui.h2} mb-1.5`}>General ({category.name})</h2>
          <div className="space-y-1">
            {generalTx.map(tx => <div key={tx.id}>{renderTxRow(tx)}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}
