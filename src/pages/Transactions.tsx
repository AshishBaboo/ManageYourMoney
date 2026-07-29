import { useEffect, useMemo, useState } from 'react'
import { Search, ArrowUpRight, ArrowDownLeft, Plus, X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, currencySymbol } from '../lib/currency'
import { ui } from '../lib/ui'
import { Toast, useNotify } from '../components/Toast'
import AutocompleteInput from '../components/AutocompleteInput'

interface Account { id: string; name: string; balance: number }
interface Category { id: string; name: string; type: string; icon: string | null }
interface Tx {
  id: string
  description: string
  amount: number
  type: 'income' | 'expense'
  date: string
  account_id: string | null
  category_id: string | null
}

export default function Transactions(): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({
    description: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    categoryId: '',
    accountId: '',
    date: new Date().toISOString().slice(0, 10),
  })
  const { notice, notify } = useNotify()

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [acc, cat, tx] = await Promise.all([
        supabase.from('accounts').select('id,name,balance').eq('user_id', user.id).order('created_at'),
        supabase.from('categories').select('id,name,type,icon').eq('user_id', user.id).order('name'),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(200),
      ])
      if (acc.error) throw acc.error
      setAccounts((acc.data || []).map(a => ({ ...a, balance: Number(a.balance) })))
      setCategories(cat.data || [])
      setTransactions((tx.data || []).map(t => ({ ...t, amount: Number(t.amount) })))
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
      const { data, error } = await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: form.accountId,
        category_id: form.categoryId || null,
        description: form.description.trim(),
        amount,
        type: form.type,
        date: form.date,
      }).select()
      if (error) throw error

      // update account balance
      const acc = accById[form.accountId]
      if (acc) {
        const newBalance = acc.balance + (form.type === 'income' ? amount : -amount)
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', acc.id)
        setAccounts(accounts.map(a => a.id === acc.id ? { ...a, balance: newBalance } : a))
      }

      setTransactions([{ ...data[0], amount: Number(data[0].amount) }, ...transactions])
      setForm(f => ({ ...f, description: '', amount: '' }))
      setShowAddForm(false)
      notify('Transaction added')
    } catch (e: any) {
      notify(e.message || 'Failed to add transaction', false)
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

  if (loading) return <div className={ui.page}><p className={ui.empty}>Loading transactions...</p></div>

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
                  <select className={ui.select} value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value as 'income' | 'expense', categoryId: '' })}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div>
                  <label className={ui.label}>Account</label>
                  <select className={ui.select} value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })}>
                    <option value="">Select</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={ui.label}>Category</label>
                  <select className={ui.select} value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                    <option value="">None</option>
                    {formCategories.map(c => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
                  </select>
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
                      {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {cat ? ` • ${cat.icon ? `${cat.icon} ` : ''}${cat.name}` : ''}
                      {acc ? ` • ${acc.name}` : ''}
                    </p>
                  </div>
                  <p className={`text-xs font-semibold whitespace-nowrap mx-2 ${
                    tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
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
