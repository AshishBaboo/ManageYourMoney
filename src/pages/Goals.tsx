import { useEffect, useState } from 'react'
import { Plus, Trash2, X, PlusCircle, Pencil, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency, currencySymbol } from '../lib/currency'
import { ui } from '../lib/ui'
import { Toast, useNotify } from '../components/Toast'
import Loader from '../components/Loader'

interface Goal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string
  icon: string | null
}

const SUGGESTED = [
  { name: 'Emergency Fund', icon: '🚨', target: 100000 },
  { name: 'Vacation', icon: '✈️', target: 50000 },
  { name: 'New Vehicle', icon: '🚗', target: 200000 },
]

export default function Goals(): JSX.Element {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', icon: '', target: '', deadline: '' })
  const [addingFunds, setAddingFunds] = useState<{ goalId: string; value: string } | null>(null)
  const [editing, setEditing] = useState<{ id: string; name: string; target: string; deadline: string } | null>(null)
  const { notice, notify } = useNotify()

  const saveEdit = async () => {
    if (!editing) return
    const target = parseFloat(editing.target)
    if (!editing.name.trim()) return notify('Enter a name', false)
    if (!target || target <= 0) return notify('Enter a valid target', false)
    if (!editing.deadline) return notify('Pick a deadline', false)
    try {
      const { error } = await supabase.from('savings_goals').update({
        name: editing.name.trim(), target_amount: target, deadline: editing.deadline,
      }).eq('id', editing.id)
      if (error) throw error
      setGoals(goals.map(g => g.id === editing.id
        ? { ...g, name: editing.name.trim(), target_amount: target, deadline: editing.deadline }
        : g))
      setEditing(null)
      notify('Goal updated')
    } catch (e: any) {
      notify(e.message || 'Failed to update', false)
    }
  }

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at')
      if (error) throw error
      setGoals((data || []).map(g => ({
        ...g,
        target_amount: Number(g.target_amount),
        current_amount: Number(g.current_amount),
      })))
    } catch (e: any) {
      notify(e.message || 'Failed to load goals', false)
    } finally {
      setLoading(false)
    }
  }

  const addGoal = async (preset?: { name: string; icon: string; target: number }) => {
    const name = preset?.name || form.name.trim()
    const target = preset?.target || parseFloat(form.target)
    const icon = preset?.icon || form.icon.trim() || '🎯'
    const deadline = preset ? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10) : form.deadline
    if (!name) return notify('Enter a goal name', false)
    if (!target || target <= 0) return notify('Enter a valid target amount', false)
    if (!deadline) return notify('Pick a deadline', false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase.from('savings_goals').insert({
        user_id: user.id,
        name,
        target_amount: target,
        current_amount: 0,
        deadline,
        icon,
      }).select()
      if (error) throw error
      setGoals([...goals, { ...data[0], target_amount: Number(data[0].target_amount), current_amount: Number(data[0].current_amount) }])
      setForm({ name: '', icon: '', target: '', deadline: '' })
      setShowAdd(false)
      notify('Goal created')
    } catch (e: any) {
      notify(e.message || 'Failed to create goal', false)
    }
  }

  const deleteGoal = async (id: string) => {
    try {
      const { error, count } = await supabase.from('savings_goals').delete({ count: 'exact' }).eq('id', id)
      if (error) throw error
      if (!count) throw new Error('Delete blocked — run supabase-setup.sql')
      setGoals(goals.filter(g => g.id !== id))
      notify('Goal deleted')
    } catch (e: any) {
      notify(e.message || 'Failed to delete', false)
    }
  }

  const addFunds = async () => {
    if (!addingFunds) return
    const amount = parseFloat(addingFunds.value)
    if (!amount || amount <= 0) return notify('Enter a valid amount', false)
    const goal = goals.find(g => g.id === addingFunds.goalId)
    if (!goal) return
    try {
      const newAmount = goal.current_amount + amount
      const { error } = await supabase.from('savings_goals').update({ current_amount: newAmount }).eq('id', goal.id)
      if (error) throw error
      setGoals(goals.map(g => g.id === goal.id ? { ...g, current_amount: newAmount } : g))
      setAddingFunds(null)
      notify(`Added ${formatCurrency(amount)} to ${goal.name}`)
    } catch (e: any) {
      notify(e.message || 'Failed to add funds', false)
    }
  }

  const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0)
  const totalProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0

  if (loading) return <div className={ui.page}><Loader label="Loading goals..." /></div>

  return (
    <div className={ui.page}>
      <Toast notice={notice} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className={ui.h1}>Savings Goals</h1>
          <p className={ui.sub}>Track your progress</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className={ui.btnPrimary}>
          <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> New Goal</span>
        </button>
      </div>

      {/* Overall progress */}
      {goals.length > 0 && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg p-3 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-green-100">Total Saved</p>
              <p className="text-lg font-semibold">{formatCurrency(totalSaved)}</p>
              <p className="text-[11px] text-green-100">of {formatCurrency(totalTarget)}</p>
            </div>
            <p className="text-2xl font-semibold">{Math.round(totalProgress)}%</p>
          </div>
          <div className="mt-2 w-full bg-white/20 rounded-full h-1.5">
            <div className="bg-white h-1.5 rounded-full transition-all" style={{ width: `${Math.min(totalProgress, 100)}%` }} />
          </div>
        </div>
      )}

      {/* Add goal form */}
      {showAdd && (
        <div className={ui.card}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={ui.h2}>New Goal</h2>
            <button onClick={() => setShowAdd(false)} className={ui.iconBtn}><X className="w-3.5 h-3.5 text-gray-500" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className={ui.label}>Name</label>
              <input className={ui.input} placeholder="e.g. New Laptop" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className={ui.label}>Emoji (optional)</label>
              <input className={ui.input} placeholder="💻" value={form.icon}
                onChange={e => setForm({ ...form, icon: e.target.value })} />
            </div>
            <div>
              <label className={ui.label}>Target ({currencySymbol()})</label>
              <input className={ui.input} type="number" placeholder="0" value={form.target}
                onChange={e => setForm({ ...form, target: e.target.value })} />
            </div>
            <div>
              <label className={ui.label}>Deadline</label>
              <input className={ui.input} type="date" value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })} />
            </div>
          </div>
          <button onClick={() => addGoal()} className={`${ui.btnPrimary} mt-2 w-full md:w-auto`}>Create Goal</button>
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 ? (
        <div className={ui.card}>
          <p className={ui.empty}>No goals yet — create one above or pick a suggestion below.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {goals.map(goal => {
            const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0
            const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000)
            return (
              <div key={goal.id} className={ui.card}>
                {editing?.id === goal.id ? (
                  <div className="space-y-1.5 mb-2">
                    <input className={ui.input} value={editing.name} placeholder="Goal name"
                      onChange={e => setEditing({ ...editing, name: e.target.value })} autoFocus />
                    <div className="flex gap-1.5">
                      <input className={ui.input} type="number" value={editing.target} placeholder="Target"
                        onChange={e => setEditing({ ...editing, target: e.target.value })} />
                      <input className={ui.input} type="date" value={editing.deadline}
                        onChange={e => setEditing({ ...editing, deadline: e.target.value })} />
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={saveEdit} className={ui.btnPrimary}>
                        <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Save</span>
                      </button>
                      <button onClick={() => setEditing(null)} className={ui.btnSecondary}>Cancel</button>
                    </div>
                  </div>
                ) : (
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl">{goal.icon || '🎯'}</span>
                    <div className="min-w-0">
                      <p className={`${ui.strong} truncate`}>{goal.name}</p>
                      <p className={ui.sub}>{daysLeft > 0 ? `${daysLeft} days left` : 'Deadline passed'}</p>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => setEditing({ id: goal.id, name: goal.name, target: String(goal.target_amount), deadline: goal.deadline })}
                      aria-label={`Edit ${goal.name}`} className={ui.iconBtn}
                    >
                      <Pencil className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button onClick={() => deleteGoal(goal.id)} aria-label={`Delete ${goal.name}`} className={ui.iconBtnDanger}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                )}

                <div className="flex items-center justify-between mb-1">
                  <p className={ui.sub}>{formatCurrency(goal.current_amount)} of {formatCurrency(goal.target_amount)}</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{Math.round(progress)}%</p>
                </div>
                <div className={ui.progressTrack}>
                  <div
                    className={`h-1.5 rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>

                {addingFunds?.goalId === goal.id ? (
                  <div className="flex gap-1.5 mt-2">
                    <input
                      className={ui.input}
                      type="number"
                      placeholder="Amount"
                      value={addingFunds.value}
                      onChange={e => setAddingFunds({ ...addingFunds, value: e.target.value })}
                      autoFocus
                    />
                    <button onClick={addFunds} className={ui.btnPrimary}>Add</button>
                    <button onClick={() => setAddingFunds(null)} className={ui.btnSecondary}>Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingFunds({ goalId: goal.id, value: '' })}
                    className={`${ui.btnSecondary} mt-2 w-full`}
                  >
                    <span className="flex items-center justify-center gap-1"><PlusCircle className="w-3 h-3" /> Add Funds</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Suggestions */}
      <div className={ui.card}>
        <h2 className={`${ui.h2} mb-2`}>Suggestions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {SUGGESTED.map((s, idx) => (
            <div key={idx} className="p-2.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-md">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">{s.icon}</span>
                <p className={ui.strong}>{s.name}</p>
              </div>
              <p className={`${ui.sub} mb-2`}>Target: {formatCurrency(s.target)}</p>
              <button onClick={() => addGoal(s)} className={`${ui.btnSecondary} w-full`}>Create</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
