import { useEffect, useMemo, useState } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/currency'
import { ui } from '../lib/ui'
import { Toast, useNotify } from '../components/Toast'
import Loader from '../components/Loader'
import { formatTxDate, sortTx } from '../lib/tx'

interface Category { id: string; name: string; type: string; icon: string | null; parent_id: string | null; color: string | null }
interface Tx { id: string; category_id: string | null; description: string; amount: number; type: string; date: string; occurred_at?: string | null }
interface BudgetRow { category_id: string; month: string; limit_amount: number }

type Preset = 'this_month' | 'last_month' | 'last_3' | 'this_year' | 'all' | 'custom'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'last_3', label: 'Last 3 Months' },
  { key: 'this_year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
]

const PALETTE = ['#22c55e', '#3b82f6', '#f97316', '#ec4899', '#ef4444', '#8b5cf6', '#14b8a6', '#eab308', '#6366f1', '#84cc16']

export default function Reports(): JSX.Element {
  const [preset, setPreset] = useState<Preset>('this_month')
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [categories, setCategories] = useState<Category[]>([])
  const [txs, setTxs] = useState<Tx[]>([])
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([])
  const [showAllExpenses, setShowAllExpenses] = useState(false)
  const [loading, setLoading] = useState(true)
  const { notice, notify } = useNotify()

  const range = useMemo((): { from: string | null; to: string | null } => {
    const now = new Date()
    switch (preset) {
      case 'this_month': return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }
      case 'last_month': {
        const lm = subMonths(now, 1)
        return { from: format(startOfMonth(lm), 'yyyy-MM-dd'), to: format(endOfMonth(lm), 'yyyy-MM-dd') }
      }
      case 'last_3': return { from: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }
      case 'this_year': return { from: format(startOfYear(now), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
      case 'all': return { from: null, to: null }
      case 'custom': return { from: customFrom, to: customTo }
    }
  }, [preset, customFrom, customTo])

  useEffect(() => { load() }, [range.from, range.to])

  const load = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      let q = supabase.from('transactions').select('*').eq('user_id', user.id)
      if (range.from) q = q.gte('date', range.from)
      if (range.to) q = q.lte('date', range.to)
      // when the range is a single month, also compare against that month's budget
      const singleMonth = range.from && range.to && range.from.slice(0, 7) === range.to.slice(0, 7) ? range.from.slice(0, 7) : null
      const [tx, cat, bud] = await Promise.all([
        q,
        supabase.from('categories').select('*').eq('user_id', user.id),
        singleMonth
          ? supabase.from('budgets').select('category_id,month,limit_amount').eq('user_id', user.id).eq('month', singleMonth)
          : Promise.resolve({ data: [], error: null } as any),
      ])
      if (tx.error) throw tx.error
      setTxs(sortTx((tx.data || []).map((t: any) => ({ ...t, amount: Number(t.amount) }))))
      setCategories(cat.data || [])
      setBudgetRows(((bud.data || []) as any[]).map(b => ({ ...b, limit_amount: Number(b.limit_amount) })))
    } catch (e: any) {
      notify(e.message || 'Failed to load report', false)
    } finally {
      setLoading(false)
    }
  }

  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  // roll subcategory spend up to its top-level category for the breakdown
  const topFor = (catId: string | null): Category | null => {
    if (!catId) return null
    const c = catById.get(catId)
    if (!c) return null
    return c.parent_id ? (catById.get(c.parent_id) || c) : c
  }

  const income = txs.filter(t => t.type === 'income')
  const expense = txs.filter(t => t.type === 'expense')
  const totalIncome = income.reduce((s, t) => s + t.amount, 0)
  const totalExpense = expense.reduce((s, t) => s + t.amount, 0)

  const breakdown = (list: Tx[]) => {
    const map = new Map<string, { name: string; icon: string | null; total: number }>()
    for (const t of list) {
      const top = topFor(t.category_id)
      const key = top?.id || 'uncat'
      const cur = map.get(key) || { name: top?.name || 'Uncategorised', icon: top?.icon || null, total: 0 }
      cur.total += t.amount
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }

  const expenseBreakdown = breakdown(expense)
  const incomeBreakdown = breakdown(income)
  const sortedExpenses = [...expense].sort((a, b) => b.amount - a.amount)
  const topExpenses = showAllExpenses ? sortedExpenses : sortedExpenses.slice(0, 8)
  const topIncome = [...income].sort((a, b) => b.amount - a.amount).slice(0, 5)

  // subcategory-level breakdown (exact category, labelled "Parent · Sub")
  const subBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; icon: string | null; total: number }>()
    for (const t of expense) {
      const c = t.category_id ? catById.get(t.category_id) : null
      const parent = c?.parent_id ? catById.get(c.parent_id) : null
      const name = c ? (parent ? `${parent.name} · ${c.name}` : c.name) : 'Uncategorised'
      const key = c?.id || 'uncat'
      const cur = map.get(key) || { name, icon: c?.icon || null, total: 0 }
      cur.total += t.amount
      map.set(key, cur)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [expense, catById])

  // budget vs actual (single-month ranges only)
  const budgetVsActual = useMemo(() => {
    if (!budgetRows.length) return []
    return budgetRows.map(b => {
      const cat = catById.get(b.category_id)
      if (!cat) return null
      const isIncome = (cat.parent_id ? catById.get(cat.parent_id)?.type : cat.type) === 'income'
      if (isIncome) return null
      const childIds = categories.filter(c => c.parent_id === b.category_id).map(c => c.id)
      const spent = expense
        .filter(t => t.category_id === b.category_id || childIds.includes(t.category_id || ''))
        .reduce((s, t) => s + t.amount, 0)
      return { name: cat.name, icon: cat.icon, limit: b.limit_amount, spent, diff: b.limit_amount - spent }
    }).filter((x): x is NonNullable<typeof x> => x !== null && x.limit > 0)
      .sort((a, b) => (a.diff) - (b.diff))
  }, [budgetRows, catById, categories, expense])

  // month-by-month totals (when the range spans months)
  const monthly = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    for (const t of txs) {
      const m = t.date.slice(0, 7)
      const cur = map.get(m) || { income: 0, expense: 0 }
      cur[t.type as 'income' | 'expense'] += t.amount
      map.set(m, cur)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [txs])

  const days = range.from && range.to
    ? Math.max(1, Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86400000) + 1)
    : null

  const renderBreakdown = (rows: { name: string; icon: string | null; total: number }[], total: number, color: 'expense' | 'income') => (
    <div className="space-y-2">
      {rows.length === 0 ? <p className={ui.empty}>Nothing in this period</p> : rows.map((r, i) => {
        const pctShare = total > 0 ? (r.total / total) * 100 : 0
        return (
          <div key={i}>
            <div className="flex justify-between items-center mb-0.5">
              <p className={ui.strong}>{r.icon ? `${r.icon} ` : ''}{r.name}</p>
              <p className={ui.sub}>{formatCurrency(r.total)} • {pctShare.toFixed(1)}%</p>
            </div>
            <div className={ui.progressTrack}>
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${pctShare}%`, backgroundColor: color === 'income' ? '#22c55e' : PALETTE[i % PALETTE.length] }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className={ui.page}>
      <Toast notice={notice} />

      <div>
        <h1 className={ui.h1}>Insights</h1>
        <p className={ui.sub}>Reports for any period</p>
      </div>

      {/* Period picker */}
      <div className={ui.card}>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                preset === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex gap-2 mt-2">
            <div className="flex-1">
              <label className={ui.label}>From</label>
              <input className={ui.input} type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className={ui.label}>To</label>
              <input className={ui.input} type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {loading ? <Loader label="Crunching numbers..." /> : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className={ui.card}>
              <p className={ui.sub}>Income</p>
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(totalIncome)}</p>
            </div>
            <div className={ui.card}>
              <p className={ui.sub}>Expenses</p>
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(totalExpense)}</p>
            </div>
            <div className={ui.card}>
              <p className={ui.sub}>Net (Saved)</p>
              <p className={`text-sm font-semibold ${totalIncome - totalExpense >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(totalIncome - totalExpense)}
              </p>
            </div>
            <div className={ui.card}>
              <p className={ui.sub}>{days ? 'Avg spend / day' : 'Transactions'}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {days ? formatCurrency(totalExpense / days) : txs.length}
              </p>
            </div>
          </div>

          {/* Budget vs actual (single month) */}
          {budgetVsActual.length > 0 && (
            <div className={ui.card}>
              <h2 className={`${ui.h2} mb-2`}>Budget vs Actual</h2>
              <div className="space-y-1.5">
                {budgetVsActual.map((r, i) => (
                  <div key={i} className={ui.row}>
                    <p className={`${ui.strong} flex-1 truncate`}>{r.icon ? `${r.icon} ` : ''}{r.name}</p>
                    <div className="text-right">
                      <p className={ui.sub}>{formatCurrency(r.spent)} of {formatCurrency(r.limit)}</p>
                      <p className={`text-[10px] font-semibold ${r.diff < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                        {r.diff < 0 ? `${formatCurrency(-r.diff)} over` : `${formatCurrency(r.diff)} under`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spending by category — largest first */}
          <div className={ui.card}>
            <h2 className={`${ui.h2} mb-2`}>Spending by Category</h2>
            {renderBreakdown(expenseBreakdown, totalExpense, 'expense')}
          </div>

          {/* Spending by subcategory — largest first */}
          {subBreakdown.length > expenseBreakdown.length && (
            <div className={ui.card}>
              <h2 className={`${ui.h2} mb-2`}>Spending by Subcategory</h2>
              {renderBreakdown(subBreakdown, totalExpense, 'expense')}
            </div>
          )}

          {/* Income by category */}
          <div className={ui.card}>
            <h2 className={`${ui.h2} mb-2`}>Income by Category</h2>
            {renderBreakdown(incomeBreakdown, totalIncome, 'income')}
          </div>

          {/* Top income entries */}
          {topIncome.length > 0 && (
            <div className={ui.card}>
              <h2 className={`${ui.h2} mb-2`}>Largest Income Entries</h2>
              <div className="space-y-1.5">
                {topIncome.map(t => (
                  <div key={t.id} className={ui.row}>
                    <div className="flex-1 min-w-0">
                      <p className={`${ui.strong} truncate`}>{t.description}</p>
                      <p className={ui.sub}>{formatTxDate(t)}</p>
                    </div>
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400">+{formatCurrency(t.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Month by month */}
          {monthly.length > 1 && (
            <div className={ui.card}>
              <h2 className={`${ui.h2} mb-2`}>Month by Month</h2>
              <div className="space-y-1.5">
                {monthly.map(([m, v]) => (
                  <div key={m} className={ui.row}>
                    <p className={ui.strong}>{format(new Date(`${m}-01T00:00:00`), 'MMMM yyyy')}</p>
                    <div className="text-right">
                      <p className="text-xs font-medium text-green-600 dark:text-green-400">+{formatCurrency(v.income)}</p>
                      <p className="text-xs font-medium text-red-600 dark:text-red-400">-{formatCurrency(v.expense)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All expenses, largest first */}
          <div className={ui.card}>
            <h2 className={`${ui.h2} mb-2`}>Expenses — Largest First</h2>
            <div className="space-y-1.5">
              {topExpenses.length === 0 ? <p className={ui.empty}>No expenses in this period</p> : topExpenses.map(t => (
                <div key={t.id} className={ui.row}>
                  <div className="flex-1 min-w-0">
                    <p className={`${ui.strong} truncate`}>{t.description}</p>
                    <p className={ui.sub}>{formatTxDate(t)}{topFor(t.category_id) ? ` • ${topFor(t.category_id)!.name}` : ''}</p>
                  </div>
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">-{formatCurrency(t.amount)}</p>
                </div>
              ))}
              {sortedExpenses.length > 8 && (
                <button onClick={() => setShowAllExpenses(!showAllExpenses)} className="w-full text-center text-[11px] text-blue-600 dark:text-blue-400 hover:underline py-1">
                  {showAllExpenses ? 'Show less' : `Show all ${sortedExpenses.length} expenses`}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
