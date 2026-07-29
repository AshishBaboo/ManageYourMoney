import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Send, Trash2, X, Wallet, PiggyBank, CreditCard, Banknote, Pencil, Check, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/currency'
import { ui } from '../lib/ui'
import { Toast, useNotify } from '../components/Toast'
import Loader from '../components/Loader'
import Select from '../components/Select'
import { useConfirm } from '../components/ConfirmDialog'
import { useBusy } from '../lib/useBusy'

const TYPE_OPTIONS = [
  { value: 'savings', label: 'Savings' },
  { value: 'checking', label: 'Checking' },
  { value: 'credit', label: 'Credit' },
  { value: 'cash', label: 'Cash' },
]

interface Account {
  id: string
  name: string
  type: string
  balance: number
  is_default?: boolean | null
}

const TYPE_META: Record<string, { label: string; icon: typeof Wallet }> = {
  savings: { label: 'Savings', icon: PiggyBank },
  checking: { label: 'Checking', icon: Wallet },
  credit: { label: 'Credit', icon: CreditCard },
  cash: { label: 'Cash', icon: Banknote },
}

export default function Accounts(): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'savings', balance: '' })
  const [transfer, setTransfer] = useState({ from: '', to: '', amount: '' })
  const [editing, setEditing] = useState<{ id: string; name: string; type: string; balance: string } | null>(null)
  const { notice, notify } = useNotify()
  const { confirm, confirmDialog } = useConfirm()
  const { busy, run } = useBusy()
  const navigate = useNavigate()

  const setFavorite = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error: e1 } = await supabase.from('accounts').update({ is_default: false }).eq('user_id', user.id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('accounts').update({ is_default: true }).eq('id', id)
      if (e2) throw e2
      setAccounts(accounts.map(a => ({ ...a, is_default: a.id === id })))
      notify('Favorite account saved — it will be pre-selected everywhere')
    } catch (e: any) {
      notify(/is_default/i.test(e.message || '') ? 'Run supabase-migration-3 first' : (e.message || 'Failed'), false)
    }
  }

  const saveEdit = async () => {
    if (!editing) return
    if (!editing.name.trim()) return notify('Enter a name', false)
    try {
      const { error } = await supabase.from('accounts').update({
        name: editing.name.trim(),
        type: editing.type,
        balance: parseFloat(editing.balance) || 0,
      }).eq('id', editing.id)
      if (error) throw error
      setAccounts(accounts.map(a => a.id === editing.id
        ? { ...a, name: editing.name.trim(), type: editing.type, balance: parseFloat(editing.balance) || 0 }
        : a))
      setEditing(null)
      notify('Account updated')
    } catch (e: any) {
      notify(e.message || 'Failed to update', false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at')
      if (error) throw error
      setAccounts((data || []).map(a => ({ ...a, balance: Number(a.balance) })))
    } catch (e: any) {
      notify(e.message || 'Failed to load accounts', false)
    } finally {
      setLoading(false)
    }
  }

  const addAccount = async () => {
    if (!form.name.trim()) return notify('Enter an account name', false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          name: form.name.trim(),
          type: form.type,
          balance: parseFloat(form.balance) || 0,
        })
        .select()
      if (error) throw error
      setAccounts([...accounts, { ...data[0], balance: Number(data[0].balance) }])
      setForm({ name: '', type: 'savings', balance: '' })
      setShowAdd(false)
      notify('Account added')
    } catch (e: any) {
      notify(e.message || 'Failed to add account', false)
    }
  }

  const deleteAccount = async (id: string) => {
    const acc = accounts.find(a => a.id === id)
    if (!(await confirm(`Delete account "${acc?.name}"? Its transactions keep existing but lose the account link.`))) return
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

  const doTransfer = async () => {
    const amount = parseFloat(transfer.amount)
    const from = accounts.find(a => a.id === transfer.from)
    const to = accounts.find(a => a.id === transfer.to)
    if (!from || !to || from.id === to.id) return notify('Pick two different accounts', false)
    if (!amount || amount <= 0) return notify('Enter a valid amount', false)
    if (from.balance < amount) return notify('Insufficient balance', false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error: e1 } = await supabase.from('accounts').update({ balance: from.balance - amount }).eq('id', from.id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('accounts').update({ balance: to.balance + amount }).eq('id', to.id)
      if (e2) throw e2

      // record both sides as ONE transfer (linked by transfer_group; the
      // transactions list shows a single merged entry, each account its side)
      const today = new Date().toISOString().slice(0, 10)
      const group = crypto.randomUUID()
      const baseRows = [
        { user_id: user.id, account_id: from.id, description: `Transfer to ${to.name}`, amount: -amount, type: 'transfer', date: today, occurred_at: new Date().toISOString(), transfer_group: group },
        { user_id: user.id, account_id: to.id, description: `Transfer from ${from.name}`, amount, type: 'transfer', date: today, occurred_at: new Date().toISOString(), transfer_group: group },
      ]
      let { error: txErr } = await supabase.from('transactions').insert(baseRows)
      if (txErr && /transfer_group|occurred_at/i.test(txErr.message)) {
        // older DB — retry without the optional columns
        ;({ error: txErr } = await supabase.from('transactions').insert(
          baseRows.map(({ occurred_at: _o, transfer_group: _g, ...rest }) => rest)
        ))
      }
      if (txErr && /type_check/i.test(txErr.message)) {
        notify('Transfer done — run supabase-migration-4 to also record transfers as transactions', false)
      } else if (txErr) {
        notify(`Transfer done, but recording failed: ${txErr.message}`, false)
      }

      setAccounts(accounts.map(a =>
        a.id === from.id ? { ...a, balance: a.balance - amount } :
        a.id === to.id ? { ...a, balance: a.balance + amount } : a
      ))
      setTransfer({ from: '', to: '', amount: '' })
      setShowTransfer(false)
      notify(`Transferred ${formatCurrency(amount)} — recorded in both accounts`)
    } catch (e: any) {
      notify(e.message || 'Transfer failed', false)
    }
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  if (loading) {
    return <div className={ui.page}><Loader label="Loading accounts..." /></div>
  }

  return (
    <div className={ui.page}>
      <Toast notice={notice} />
      {confirmDialog}

      <div className="flex items-center justify-between">
        <div>
          <h1 className={ui.h1}>Accounts</h1>
          <p className={ui.sub}>Manage your accounts and transfers</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => { setShowTransfer(!showTransfer); setShowAdd(false) }}
            className={ui.btnSecondary}
            disabled={accounts.length < 2}
          >
            <span className="flex items-center gap-1"><Send className="w-3 h-3" /> Transfer</span>
          </button>
          <button onClick={() => { setShowAdd(!showAdd); setShowTransfer(false) }} className={ui.btnPrimary}>
            <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> Add Account</span>
          </button>
        </div>
      </div>

      {/* Total balance strip */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-3 text-white">
        <p className="text-[11px] text-blue-100">Total Balance</p>
        <p className="text-xl font-semibold">{formatCurrency(totalBalance)}</p>
        <p className="text-[11px] text-blue-100 mt-0.5">{accounts.length} account{accounts.length === 1 ? '' : 's'}</p>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className={ui.card}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={ui.h2}>New Account</h2>
            <button onClick={() => setShowAdd(false)} className={ui.iconBtn}><X className="w-3.5 h-3.5 text-gray-500" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className={ui.label}>Name</label>
              <input className={ui.input} placeholder="e.g. HDFC Savings" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className={ui.label}>Type</label>
              <Select value={form.type} onChange={v => setForm({ ...form, type: v })} options={TYPE_OPTIONS} />
            </div>
            <div>
              <label className={ui.label}>Opening Balance</label>
              <input className={ui.input} type="number" placeholder="0" value={form.balance}
                onChange={e => setForm({ ...form, balance: e.target.value })} />
            </div>
          </div>
          <button onClick={() => run(addAccount)} disabled={busy} className={`${ui.btnPrimary} mt-2 w-full md:w-auto`}>{busy ? 'Saving...' : 'Save Account'}</button>
        </div>
      )}

      {/* Transfer form */}
      {showTransfer && (
        <div className={ui.card}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={ui.h2}>Transfer Between Accounts</h2>
            <button onClick={() => setShowTransfer(false)} className={ui.iconBtn}><X className="w-3.5 h-3.5 text-gray-500" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className={ui.label}>From</label>
              <Select
                value={transfer.from}
                onChange={v => setTransfer({ ...transfer, from: v })}
                placeholder="Select account"
                options={accounts.map(a => ({ value: a.id, label: a.name, hint: formatCurrency(a.balance) }))}
              />
            </div>
            <div>
              <label className={ui.label}>To</label>
              <Select
                value={transfer.to}
                onChange={v => setTransfer({ ...transfer, to: v })}
                placeholder="Select account"
                options={accounts.filter(a => a.id !== transfer.from).map(a => ({ value: a.id, label: a.name }))}
              />
            </div>
            <div>
              <label className={ui.label}>Amount</label>
              <input className={ui.input} type="number" placeholder="0" value={transfer.amount}
                onChange={e => setTransfer({ ...transfer, amount: e.target.value })} />
            </div>
          </div>
          <button onClick={() => run(doTransfer)} disabled={busy} className={`${ui.btnPrimary} mt-2 w-full md:w-auto`}>{busy ? 'Transferring...' : 'Transfer Now'}</button>
        </div>
      )}

      {/* Accounts list */}
      <div className={ui.card}>
        <h2 className={`${ui.h2} mb-2`}>Your Accounts</h2>
        {accounts.length === 0 ? (
          <p className={ui.empty}>No accounts yet — tap "Add Account" to create your first one.</p>
        ) : (
          <div className="space-y-1.5">
            {accounts.map(account => {
              const meta = TYPE_META[account.type] || TYPE_META.savings
              const Icon = meta.icon
              if (editing?.id === account.id) {
                return (
                  <div key={account.id} className="p-2 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20 space-y-1.5">
                    <div className="flex gap-1.5">
                      <input className={ui.input} value={editing.name} placeholder="Account name"
                        onChange={e => setEditing({ ...editing, name: e.target.value })} autoFocus />
                      <Select
                        className="w-28"
                        value={editing.type}
                        onChange={v => setEditing({ ...editing, type: v })}
                        options={TYPE_OPTIONS}
                      />
                      <input className={`${ui.input} !w-28`} type="number" value={editing.balance} placeholder="Balance"
                        onChange={e => setEditing({ ...editing, balance: e.target.value })} />
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => run(saveEdit)} disabled={busy} className={ui.btnPrimary}>
                        <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Save</span>
                      </button>
                      <button onClick={() => setEditing(null)} className={ui.btnSecondary}>Cancel</button>
                    </div>
                  </div>
                )
              }
              return (
                <div key={account.id} className={ui.row}>
                  <button
                    onClick={() => navigate(`/accounts/${account.id}`)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                    aria-label={`Open ${account.name}`}
                  >
                    <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className={`${ui.strong} truncate`}>{account.name}</p>
                      <p className={ui.sub}>{meta.label} • tap for history</p>
                    </div>
                  </button>
                  <p className={`${ui.strong} mr-2 whitespace-nowrap`}>{formatCurrency(account.balance)}</p>
                  <button
                    onClick={() => setFavorite(account.id)}
                    aria-label={`Set ${account.name} as favorite`}
                    title="Favorite — pre-selected in transaction forms"
                    className={ui.iconBtn}
                  >
                    <Star className={`w-3.5 h-3.5 ${account.is_default ? 'text-amber-400 fill-amber-400' : 'text-gray-400'}`} />
                  </button>
                  <button
                    onClick={() => setEditing({ id: account.id, name: account.name, type: account.type, balance: String(account.balance) })}
                    aria-label={`Edit ${account.name}`} className={ui.iconBtn}
                  >
                    <Pencil className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button onClick={() => deleteAccount(account.id)} aria-label={`Delete ${account.name}`} className={ui.iconBtnDanger}>
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
