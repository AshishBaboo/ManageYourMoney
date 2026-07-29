import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ArrowUpRight, ArrowDownLeft, Plus, X, Trash2, ChevronLeft, ChevronRight, Pencil, Check } from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { supabase } from '../lib/supabase'
import { formatCurrency, currencySymbol } from '../lib/currency'
import { ui } from '../lib/ui'
import { Toast, useNotify } from '../components/Toast'
import Loader from '../components/Loader'
import AutocompleteInput from '../components/AutocompleteInput'
import Select from '../components/Select'
import { insertTransaction, updateTransaction, occurredAtFor, formatTxDate, sortTx } from '../lib/tx'
import { defaultAccountId } from '../lib/userData'

interface Account { id: string; name: string; balance: number }
interface Category { id: string; name: string; type: string; icon: string | null; parent_id?: string | null }
interface Tx {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  date: string
  account_id: string | null
  category_id: string | null
  occurred_at?: string | null
}

export default function Transactions(): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [urlParams] = useSearchParams()
  const [showAddForm, setShowAddForm] = useState(urlParams.get('add') === '1')
  const [editingTx, setEditingTx] = useState<{ id: string; description: string; amount: string; date: string } | null>(null)
  const [form, setForm] = useState({
    description: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    categoryId: '',
    accountId: '',
    date: new Date().toISOString().slice(0, 10),
  })
  // Month-scoped, always opens on the current month
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const monthStr = format(currentMonth, 'yyyy-MM')
  const { notice, notify } = useNotify()

  useEffect(() => { load() }, [monthStr])

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [acc, cat, tx] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
        supabase.from('transactions').select('*').eq('user_id', user.id)
          .gte('date', `${monthStr}-01`).lte('date', `${monthStr}-31`)
          .order('date', { ascending: false }),
      ])
      if (acc.error) throw acc.error
      const accList = (acc.data || []).map(a => ({ ...a, balance: Number(a.balance) }))
      setAccounts(accList)
      setCategories(cat.data || [])
      setTransactions(sortTx((tx.data || []).map(t => ({ ...t, amount: Number(t.amount) }))))
      // favorite (starred) account pre-selected
      setForm(f => f.accountId ? f : { ...f, accountId: defaultAccountId(accList) })
    } catch (e: any) {
      notify(e.message || 'Failed to load', false)
    } finally {
      setLoading(false)
    }
  }

  const catById = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])
  const accById = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts])

  // Autocomplete: your own transaction history, most recent first
  const suggestions = useMemo(
    () => [...new Set(transactions.map(t => t.description))],
    [transactions]
  )

  // When picking a remembered name, auto-fill its last-used category and type
  const onDescriptionChange = (value: string) => {
    const prev = transactions.find(t => t.description === value)
    if (prev) {
      setForm(f => ({
        ...f,
        description: value,
        type: prev.type,
        categoryId: prev.category_id || f.categoryId,
        accountId: prev.account_id || f.accountId,
      }))
    } else {
      setForm(f => ({ ...f, description: value }))
    }
  }

  const addTransaction = async () => {
    const amount = parseFloat(form.amount)
    if (!form.description.trim()) return notify('Enter a description', false)
    if (!amount || amount <= 0) return notify('Enter a valid amount', false)
    if (!form.accountId) return notify('Select an account (create one in Accounts first)', false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const created = await insertTransaction({
        user_id: user.id,
        account_id: form.accountId,
        category_id: form.categoryId || null,
        description: form.description.trim(),
        amount,
        type: form.type,
        date: form.date,
        occurred_at: occurredAtFor(form.date),
      })

      // update account balance
      const acc = accById[form.accountId]
      if (acc) {
        const newBalance = acc.balance + (form.type === 'income' ? amount : -amount)
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', acc.id)
        setAccounts(accounts.map(a => a.id === acc.id ? { ...a, balance: newBalance } : a))
      }

      setTransactions(sortTx([{ ...created, amount: Number(created.amount) }, ...transactions]))
      setForm(f => ({ ...f, description: '', amount: '' }))
      setShowAddForm(false)
      notify('Transaction added')
    } catch (e: any) {
      notify(e.message || 'Failed to add transaction', false)
    }
  }

  const saveTxEdit = async () => {
    if (!editingTx) return
    const amount = parseFloat(editingTx.amount)
    if (!amount || amount <= 0) return notify('Enter a valid amount', false)
    const old = transactions.find(t => t.id === editingTx.id)
    if (!old) return
    try {
      await updateTransaction(editingTx.id, {
        description: editingTx.description.trim() || old.description,
        amount,
        date: editingTx.date,
        occurred_at: editingTx.date === old.date ? undefined : occurredAtFor(editingTx.date),
      })
      if (old.account_id && amount !== old.amount) {
        const acc = accById[old.account_id]
        if (acc) {
          const delta = (old.type === 'income' ? 1 : -1) * (amount - old.amount)
          await supabase.from('accounts').update({ balance: acc.balance + delta }).eq('id', acc.id)
          setAccounts(accounts.map(a => a.id === acc.id ? { ...a, balance: a.balance + delta } : a))
        }
      }
      setTransactions(sortTx(transactions.map(t => t.id === editingTx.id
        ? { ...t, description: editingTx.description.trim() || t.description, amount, date: editingTx.date }
        : t)))
      setEditingTx(null)
      notify('Transaction updated')
    } catch (e: any) {
      notify(e.message || 'Failed to update', false)
    }
  }

  const deleteTransaction = async (tx: Tx) => {
    try {
      const { error, count } = await supabase.from('transactions').delete({ count: 'exact' }).eq('id', tx.id)
      if (error) throw error
      if (!count) throw new Error('Delete blocked — run supabase-setup.sql')

      // revert account balance
      const acc = tx.account_id ? accById[tx.account_id] : null
      if (acc) {
        const newBalance = acc.balance + (tx.type === 'income' ? -tx.amount : tx.amount)
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', acc.id)
        setAccounts(accounts.map(a => a.id === acc.id ? { ...a, balance: newBalance } : a))
      }

      setTransactions(transactions.filter(t => t.id !== tx.id))
      notify('Transaction deleted')
    } catch (e: any) {
      notify(e.message || 'Failed to delete', false)
    }
  }

  const filtered = transactions.filter(tx => {
    const cat = tx.category_id ? catById[tx.category_id] : null
    const matchesSearch =
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cat?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || tx.type === filterType
    return matchesSearch && matchesType
  })

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const formCategories = categories.filter(c => c.type === form.type)

  if (loading) return <div className={ui.page}><Loader label="Loading transactions..." /></div>

  return (
    <div className={ui.page}>
      <Toast notice={notice} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className={ui.h1}>Transactions</h1>
          <p className={ui.sub}>All your income and expenses</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className={ui.btnPrimary}>
          <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> Add</span>
        </button>
      </div>

      {/* Month selector — always opens on the current month */}
      <div className={`${ui.card} !py-2 flex items-center justify-between`}>
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Previous month" className={ui.iconBtn}>
          <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
        <h2 className={ui.h2}>{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Next month" className={ui.iconBtn}>
          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className={ui.card}>
          <p className={ui.sub}>Income</p>
          <p className="text-sm font-semibold text-green-600 dark:text-green-400">+{formatCurrency(totalIncome)}</p>
        </div>
        <div className={ui.card}>
          <p className={ui.sub}>Expenses</p>
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">-{formatCurrency(totalExpense)}</p>
        </div>
        <div className={ui.card}>
          <p className={ui.sub}>Net</p>
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(totalIncome - totalExpense)}</p>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className={`${ui.card} border-l-4 border-l-blue-600`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={ui.h2}>New Transaction</h2>
            <button onClick={() => setShowAddForm(false)} className={ui.iconBtn}><X className="w-3.5 h-3.5 text-gray-500" /></button>
          </div>

          {accounts.length === 0 ? (
            <p className={ui.empty}>Create an account first (Accounts page) — transactions need one.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <div>
                  <label className={ui.label}>Type</label>
                  <Select
                    value={form.type}
                    onChange={v => setForm({ ...form, type: v as 'income' | 'expense', categoryId: '' })}
                    options={[
                      { value: 'expense', label: 'Expense' },
                      { value: 'income', label: 'Income' },
                    ]}
                  />
                </div>
                <div>
                  <label className={ui.label}>Account</label>
                  <Select
                    value={form.accountId}
                    onChange={v => setForm({ ...form, accountId: v })}
                    placeholder="Select account"
                    options={accounts.map(a => ({ value: a.id, label: a.name }))}
                  />
                </div>
                <div>
                  <label className={ui.label}>Category</label>
                  <Select
                    value={form.categoryId}
                    onChange={v => setForm({ ...form, categoryId: v })}
                    placeholder="None"
                    options={[
                      { value: '', label: 'None' },
                      ...formCategories.filter(c => !c.parent_id).flatMap(c => {
                        const subs = formCategories.filter(s => s.parent_id === c.id)
                        return subs.length > 0
                          ? [
                              { value: c.id, label: `${c.name} (general)`, group: c.name },
                              ...subs.map(s => ({ value: s.id, label: s.name, group: c.name })),
                            ]
                          : [{ value: c.id, label: `${c.icon ? `${c.icon} ` : ''}${c.name}` }]
                      }),
                    ]}
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className={ui.label}>Description</label>
                  <AutocompleteInput
                    value={form.description}
                    onChange={onDescriptionChange}
                    suggestions={suggestions}
                    placeholder="e.g. Grocery - DMart"
                  />
                </div>
                <div>
                  <label className={ui.label}>Amount ({currencySymbol()})</label>
                  <input className={ui.input} type="number" step="0.01" placeholder="0" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <label className={ui.label}>Date</label>
                  <input className={ui.input} type="date" value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={addTransaction} className={ui.btnPrimary}>Save Transaction</button>
                <button onClick={() => setShowAddForm(false)} className={ui.btnSecondary}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Search + filter */}
      <div className={ui.card}>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`${ui.input} pl-8`}
            />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'income', 'expense'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition ${
                  filterType === t
                    ? t === 'income' ? 'bg-green-600 text-white' : t === 'expense' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className={ui.card}>
        {filtered.length === 0 ? (
          <p className={ui.empty}>
            {transactions.length === 0 ? 'No transactions yet — add your first one above.' : 'No transactions match your filter.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(tx => {
              const cat = tx.category_id ? catById[tx.category_id] : null
              const acc = tx.account_id ? accById[tx.account_id] : null
              if (editingTx?.id === tx.id) {
                return (
                  <div key={tx.id} className="p-2 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20 space-y-1.5">
                    <input className={ui.input} value={editingTx.description} placeholder="Description"
                      onChange={e => setEditingTx({ ...editingTx, description: e.target.value })} autoFocus />
                    <div className="flex gap-1.5">
                      <input className={ui.input} type="number" value={editingTx.amount} placeholder="Amount"
                        onChange={e => setEditingTx({ ...editingTx, amount: e.target.value })} />
                      <input className={ui.input} type="date" value={editingTx.date}
                        onChange={e => setEditingTx({ ...editingTx, date: e.target.value })} />
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={saveTxEdit} className={ui.btnPrimary}>
                        <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Save</span>
                      </button>
                      <button onClick={() => setEditingTx(null)} className={ui.btnSecondary}>Cancel</button>
                    </div>
                  </div>
                )
              }
              return (
                <div key={tx.id} className={ui.row}>
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mr-2 ${
                    tx.type === 'income' ? 'bg-green-50 dark:bg-green-900/40' : 'bg-red-50 dark:bg-red-900/40'
                  }`}>
                    {tx.type === 'income'
                      ? <ArrowDownLeft className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                      : <ArrowUpRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`${ui.strong} truncate`}>{tx.description}</p>
                    <p className={ui.sub}>
                      {formatTxDate(tx)}
                      {cat ? ` • ${cat.icon ? `${cat.icon} ` : ''}${cat.name}` : ''}
                      {acc ? ` • ${acc.name}` : ''}
                    </p>
                  </div>
                  <p className={`text-xs font-semibold whitespace-nowrap mx-1.5 ${
                    tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                  <button
                    onClick={() => setEditingTx({ id: tx.id, description: tx.description, amount: String(tx.amount), date: tx.date })}
                    aria-label="Edit transaction" className={ui.iconBtn}
                  >
                    <Pencil className="w-3 h-3 text-gray-500" />
                  </button>
                  <button onClick={() => deleteTransaction(tx)} aria-label="Delete transaction" className={ui.iconBtnDanger}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
