import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Trash2, Star } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/currency'
import { ui } from '../lib/ui'
import { Toast, BusyPill, useNotify } from '../components/Toast'
import Loader from '../components/Loader'
import { formatTxDate, sortTx } from '../lib/tx'
import { useConfirm } from '../components/ConfirmDialog'
import { useBusy } from '../lib/useBusy'

interface Account { id: string; name: string; type: string; balance: number; is_default?: boolean | null }
interface Tx {
  id: string; description: string; amount: number; type: string; date: string
  occurred_at?: string | null; category_id: string | null; account_id: string | null
}
interface Category { id: string; name: string; icon: string | null }

export default function AccountDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [account, setAccount] = useState<Account | null>(null)
  const [txs, setTxs] = useState<Tx[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all')
  const [loading, setLoading] = useState(true)
  const { notice, notify } = useNotify()
  const { confirm, confirmDialog } = useConfirm()
  const { busy, run } = useBusy()

  useEffect(() => { load() }, [id])

  const load = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !id) return
      const [accRes, txRes, catRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('id', id).single(),
        supabase.from('transactions').select('*').eq('user_id', user.id).eq('account_id', id).limit(500),
        supabase.from('categories').select('id,name,icon').eq('user_id', user.id),
      ])
      if (accRes.error) throw accRes.error
      setAccount({ ...accRes.data, balance: Number(accRes.data.balance) })
      setTxs(sortTx((txRes.data || []).map((t: any) => ({ ...t, amount: Number(t.amount) }))))
      setCategories(catRes.data || [])
    } catch (e: any) {
      notify(e.message || 'Failed to load account', false)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className={ui.page}><Loader label="Loading account..." /></div>
  if (!account) return <div className={ui.page}><p className={ui.empty}>Account not found.</p></div>

  const catById = new Map(categories.map(c => [c.id, c]))

  // effect of a tx on THIS account's balance
  const effectOf = (t: Tx) =>
    t.type === 'transfer' ? t.amount : t.type === 'income' ? t.amount : -t.amount

  const deleteTx = async (t: Tx) => {
    if (!(await confirm(`Delete "${t.description}" (${formatCurrency(Math.abs(t.amount))})? The balance will be adjusted back.`))) return
    try {
      const { error, count } = await supabase.from('transactions').delete({ count: 'exact' }).eq('id', t.id)
      if (error) throw error
      if (!count) throw new Error('Delete failed')
      const newBalance = account.balance - effectOf(t)
      await supabase.from('accounts').update({ balance: newBalance }).eq('id', account.id)
      setAccount({ ...account, balance: newBalance })
      setTxs(txs.filter(x => x.id !== t.id))
      notify('Transaction deleted — balance adjusted')
    } catch (e: any) {
      notify(e.message || 'Failed to delete', false)
    }
  }

  const filtered = txs.filter(t => filter === 'all' || t.type === filter)
  const totalIn = txs.filter(t => effectOf(t) > 0).reduce((s, t) => s + effectOf(t), 0)
  const totalOut = txs.filter(t => effectOf(t) < 0).reduce((s, t) => s - effectOf(t), 0)

  // group by month for display
  const groups: { month: string; items: Tx[] }[] = []
  for (const t of filtered) {
    const m = t.date.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.month === m) last.items.push(t)
    else groups.push({ month: m, items: [t] })
  }

  const txVisual = (t: Tx) => {
    if (t.type === 'transfer') {
      return {
        icon: <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
        bg: 'bg-blue-50 dark:bg-blue-900/40',
        amountClass: t.amount >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-blue-600 dark:text-blue-400',
        amountText: `${t.amount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(t.amount))}`,
      }
    }
    if (t.type === 'income') {
      return {
        icon: <ArrowDownLeft className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />,
        bg: 'bg-green-50 dark:bg-green-900/40',
        amountClass: 'text-green-600 dark:text-green-400',
        amountText: `+${formatCurrency(t.amount)}`,
      }
    }
    return {
      icon: <ArrowUpRight className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />,
      bg: 'bg-red-50 dark:bg-red-900/40',
      amountClass: 'text-red-600 dark:text-red-400',
      amountText: `-${formatCurrency(t.amount)}`,
    }
  }

  return (
    <div className={ui.page}>
      <Toast notice={notice} />
      <BusyPill show={busy} />
      {confirmDialog}

      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/accounts')} aria-label="Back to accounts" className={ui.iconBtn}>
          <ArrowLeft className="w-4 h-4 text-gray-700 dark:text-gray-200" />
        </button>
        <h1 className={`${ui.h1} flex-1 truncate flex items-center gap-1.5`}>
          {account.name}
          {account.is_default && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
        </h1>
        <p className={`${ui.sub} capitalize`}>{account.type}</p>
      </div>

      {/* Balance strip */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-3 text-white">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[11px] text-blue-100">Balance</p>
            <p className="text-base font-semibold">{formatCurrency(account.balance)}</p>
          </div>
          <div>
            <p className="text-[11px] text-blue-100">Money In</p>
            <p className="text-sm font-semibold text-green-300">+{formatCurrency(totalIn)}</p>
          </div>
          <div>
            <p className="text-[11px] text-blue-100">Money Out</p>
            <p className="text-sm font-semibold text-red-300">-{formatCurrency(totalOut)}</p>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5">
        {(['all', 'income', 'expense', 'transfer'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium capitalize transition ${
              filter === f
                ? f === 'income' ? 'bg-green-600 text-white'
                  : f === 'expense' ? 'bg-red-600 text-white'
                  : f === 'transfer' ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {f === 'transfer' ? 'Transfers' : f}
          </button>
        ))}
      </div>

      {/* Transactions grouped by month */}
      {groups.length === 0 ? (
        <div className={ui.card}><p className={ui.empty}>No transactions for this account yet.</p></div>
      ) : (
        groups.map(g => (
          <div key={g.month} className={ui.card}>
            <h2 className={`${ui.h2} mb-1.5`}>{format(new Date(`${g.month}-01T00:00:00`), 'MMMM yyyy')}</h2>
            <div className="space-y-1">
              {g.items.map(t => {
                const v = txVisual(t)
                const cat = t.category_id ? catById.get(t.category_id) : null
                return (
                  <div key={t.id} className={ui.row}>
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mr-2 ${v.bg}`}>
                      {v.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`${ui.strong} truncate`}>{t.description}</p>
                      <p className={ui.sub}>
                        {formatTxDate(t)}
                        {cat ? ` • ${cat.icon ? `${cat.icon} ` : ''}${cat.name}` : ''}
                      </p>
                    </div>
                    <p className={`text-xs font-semibold whitespace-nowrap mx-1.5 ${v.amountClass}`}>{v.amountText}</p>
                    <button onClick={() => run(() => deleteTx(t))} aria-label="Delete transaction" className={ui.iconBtnDanger}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
