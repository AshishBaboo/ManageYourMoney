import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/currency'
import { ui } from '../lib/ui'
import { Toast, useNotify } from '../components/Toast'
import Loader from '../components/Loader'
import Select from '../components/Select'
import { useConfirm } from '../components/ConfirmDialog'
import { useBusy } from '../lib/useBusy'

interface Account { id: string; name: string; type: string; balance: number }
interface Tx { id: string; description: string; amount: number; type: string; date: string; account_id: string | null }
interface BudgetRow { id: string; category_id: string; limit_amount: number }
interface Category { id: string; name: string; icon: string | null }

export default function Dashboard(): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [monthTx, setMonthTx] = useState<Tx[] & { category_id?: string | null }[]>([])
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBalance, setNewAccountBalance] = useState('')
  const [newAccountType, setNewAccountType] = useState('savings')
  const [loading, setLoading] = useState(true)
  const { notice, notify } = useNotify()
  const { confirm, confirmDialog } = useConfirm()
  const { busy, run } = useBusy()

  const monthStr = format(new Date(), 'yyyy-MM')

  useEffect(() => { loadUserData() }, [])

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [acc, tx, bud, cat, mtx] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(8),
        supabase.from('budgets').select('*').eq('user_id', user.id).eq('month', monthStr),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('transactions').select('id,description,amount,type,date,account_id,category_id')
          .eq('user_id', user.id).gte('date', `${monthStr}-01`).lte('date', `${monthStr}-31`),
      ])
      if (acc.error) throw acc.error
      setAccounts((acc.data || []).map(a => ({ ...a, balance: Number(a.balance) })))
      setTransactions((tx.data || []).map(t => ({ ...t, amount: Number(t.amount) })))
      setBudgets((bud.data || []).map(b => ({ ...b, limit_amount: Number(b.limit_amount) })))
      setCategories(cat.data || [])
      setMonthTx((mtx.data || []).map(t => ({ ...t, amount: Number(t.amount) })))
    } catch (e: any) {
      notify(e.message || 'Failed to load data', false)
    } finally {
      setLoading(false)
    }
  }

  const addAccount = async () => {
    if (!newAccountName.trim()) return notify('Enter an account name', false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('accounts').insert({
        user_id: user.id,
        name: newAccountName.trim(),
        balance: parseFloat(newAccountBalance) || 0,
        type: newAccountType,
      }).select()
      if (error) throw error
      setAccounts([...accounts, { ...data[0], balance: Number(data[0].balance) }])
      setNewAccountName('')
      setNewAccountBalance('')
      notify('Account added')
    } catch (e: any) {
      notify(e.message || 'Failed to add account', false)
    }
  }

  const deleteAccount = async (id: string) => {
    const acc = accounts.find(a => a.id === id)
    if (!(await confirm(`Delete account "${acc?.name}"?`))) return
    try {
      const { error, count } = await supabase.from('accounts').delete({ count: 'exact' }).eq('id', id)
      if (error) throw error
      if (!count) throw new Error('Delete blocked — run supabase-setup.sql')
      setAccounts(accounts.filter(a => a.id !== id))
      notify('Account deleted')
    } catch (e: any) {
      notify(e.message || 'Failed to delete', false)
    }
  }

  const deleteTransaction = async (id: string) => {
    const tx = transactions.find(t => t.id === id)
    if (!(await confirm(`Delete "${tx?.description}"?`))) return
    try {
      const { error, count } = await supabase.from('transactions').delete({ count: 'exact' }).eq('id', id)
      if (error) throw error
      if (!count) throw new Error('Delete blocked — run supabase-setup.sql')
      setTransactions(transactions.filter(t => t.id !== id))
      notify('Transaction deleted')
    } catch (e: any) {
      notify(e.message || 'Failed to delete', false)
    }
  }

  if (loading) {
    return <div className={ui.page}><Loader label="Loading your data..." /></div>
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const monthIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthSpent = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const budgetRows = budgets.map(b => {
    const cat = categories.find(c => c.id === b.category_id) as any
    const isIncome = cat?.type === 'income'
    const childIds = (categories as any[]).filter(c => c.parent_id === b.category_id).map(c => c.id)
    const spent = (monthTx as any[])
      .filter(t =>
        (t.category_id === b.category_id || childIds.includes(t.category_id)) &&
        t.type === (isIncome ? 'income' : 'expense'))
      .reduce((s, t) => s + t.amount, 0)
    return { id: b.id, name: cat?.name || 'Category', icon: cat?.icon, spent, limit: b.limit_amount, isIncome }
  })

  return (
    <div className={ui.page}>
      <Toast notice={notice} />
      {confirmDialog}

      {/* Fresh user: point them at the budget — the heart of the app */}
      {accounts.length === 0 && transactions.length === 0 && budgets.length === 0 && (
        <Link to="/budget" className="block bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-3 text-white hover:opacity-95 transition">
          <p className="text-sm font-semibold">👋 Start here: create your first budget</p>
          <p className="text-[11px] text-blue-100 mt-0.5">
            Set up categories & subcategories once — track every month in minutes. Tap to begin →
          </p>
        </Link>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-900/20 rounded-lg p-2.5">
          <p className={ui.sub}>Balance</p>
          <p className="text-sm md:text-lg font-semibold text-blue-900 dark:text-blue-300 truncate">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-900/20 rounded-lg p-2.5">
          <p className={ui.sub}>Income ({format(new Date(), 'MMM')})</p>
          <p className="text-sm md:text-lg font-semibold text-green-900 dark:text-green-300 truncate">{formatCurrency(monthIncome)}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/40 dark:to-red-900/20 rounded-lg p-2.5">
          <p className={ui.sub}>Spent ({format(new Date(), 'MMM')})</p>
          <p className="text-sm md:text-lg font-semibold text-red-900 dark:text-red-300 truncate">{formatCurrency(monthSpent)}</p>
        </div>
      </div>

      {/* Accounts */}
      <div className={ui.card}>
        <div className="flex items-center justify-between mb-2">
          <h2 className={ui.h2}>Accounts</h2>
          <Link to="/accounts" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="space-y-1.5 mb-2.5">
          {accounts.length === 0 ? (
            <p className={ui.empty}>No accounts yet — add your first one below.</p>
          ) : (
            accounts.map(account => (
              <div key={account.id} className={ui.row}>
                <div className="flex-1 min-w-0">
                  <p className={`${ui.strong} truncate`}>{account.name}</p>
                  <p className={`${ui.sub} capitalize`}>{account.type}</p>
                </div>
                <p className={`${ui.strong} mr-2 whitespace-nowrap`}>{formatCurrency(account.balance)}</p>
                <button onClick={() => deleteAccount(account.id)} aria-label={`Delete ${account.name}`} className={ui.iconBtnDanger}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-1.5">
          <input
            type="text"
            value={newAccountName}
            onChange={e => setNewAccountName(e.target.value)}
            placeholder="Name"
            className={ui.input}
          />
          <Select
            className="w-28"
            value={newAccountType}
            onChange={setNewAccountType}
            options={[
              { value: 'savings', label: 'Savings' },
              { value: 'checking', label: 'Checking' },
              { value: 'credit', label: 'Credit' },
              { value: 'cash', label: 'Cash' },
            ]}
          />
          <input
            type="number"
            value={newAccountBalance}
            onChange={e => setNewAccountBalance(e.target.value)}
            placeholder="Balance"
            className={`${ui.input} w-24`}
          />
          <button onClick={() => run(addAccount)} disabled={busy} className={ui.btnPrimary}>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Budget snapshot */}
      <div className={ui.card}>
        <div className="flex items-center justify-between mb-2">
          <h2 className={ui.h2}>Budget — {format(new Date(), 'MMMM')}</h2>
          <Link to="/budget" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
            Details <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {budgetRows.length === 0 ? (
            <p className={ui.empty}>No budgets for this month — set limits on the Budget page.</p>
          ) : (
            budgetRows.map(b => {
              const pct = b.limit > 0 ? (b.spent / b.limit) * 100 : 0
              const color = b.isIncome ? 'bg-violet-500' : pct > 100 ? 'bg-red-500' : pct > 75 ? 'bg-yellow-500' : 'bg-green-500'
              return (
                <div key={b.id}>
                  <div className="flex justify-between items-center mb-0.5">
                    <p className={ui.strong}>{b.icon ? `${b.icon} ` : ''}{b.name}</p>
                    <p className={ui.sub}>
                      {formatCurrency(b.spent)} / {formatCurrency(b.limit)} {b.isIncome ? 'earned' : ''}
                    </p>
                  </div>
                  <div className={ui.progressTrack}>
                    <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className={ui.card}>
        <div className="flex items-center justify-between mb-2">
          <h2 className={ui.h2}>Recent Transactions</h2>
          <Link to="/transactions" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-1.5">
          {transactions.length === 0 ? (
            <p className={ui.empty}>No transactions yet — add them on the Transactions page.</p>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className={ui.row}>
                <div className="flex-1 min-w-0">
                  <p className={`${ui.strong} truncate`}>{tx.description}</p>
                  <p className={ui.sub}>{new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <p className={`text-xs font-semibold mx-2 whitespace-nowrap ${
                  tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </p>
                <button onClick={() => deleteTransaction(tx.id)} aria-label="Delete transaction" className={ui.iconBtnDanger}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer attribution */}
      <div className="text-center pt-2 border-t border-gray-200 dark:border-gray-700">
        <p className={ui.sub}>
          Developed by{' '}
          <a href="https://ashishbaboo.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
            Ashish Baboo
          </a>
        </p>
      </div>
    </div>
  )
}
